# =============================================================================
# Legience - RDS Aurora MySQL Module
# =============================================================================
# Aurora MySQL Serverless v2 - HIPAA and SOC 2 compliant
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Random Password for Master User
# -----------------------------------------------------------------------------
resource "random_password" "master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# -----------------------------------------------------------------------------
# DB Subnet Group
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name        = "legience-${var.environment}-db-subnet-group"
  description = "Database subnet group for Legience ${var.environment}"
  subnet_ids  = var.data_subnet_ids

  tags = {
    Name        = "legience-${var.environment}-db-subnet-group"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

# -----------------------------------------------------------------------------
# RDS Security Group
# -----------------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "legience-${var.environment}-rds-sg"
  description = "Security group for Legience RDS Aurora"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
    description     = "MySQL from allowed security groups"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "legience-${var.environment}-rds-sg"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# -----------------------------------------------------------------------------
# DB Parameter Group
# -----------------------------------------------------------------------------
resource "aws_rds_cluster_parameter_group" "main" {
  family      = "aurora-mysql8.0"
  name        = "legience-${var.environment}-aurora-params"
  description = "Aurora MySQL parameter group for Legience"

  # Performance and security parameters
  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "character_set_client"
    value = "utf8mb4"
  }

  parameter {
    name  = "slow_query_log"
    value = "1"
  }

  parameter {
    name  = "long_query_time"
    value = "2"
  }

  parameter {
    name  = "log_output"
    value = "FILE"
  }

  # Security parameters
  parameter {
    name  = "require_secure_transport"
    value = "ON"
  }

  tags = {
    Name        = "legience-${var.environment}-aurora-params"
    Environment = var.environment
    Project     = "legience"
  }
}

# -----------------------------------------------------------------------------
# Aurora MySQL Serverless v2 Cluster
# -----------------------------------------------------------------------------
resource "aws_rds_cluster" "main" {
  cluster_identifier = "legience-${var.environment}"
  engine             = "aurora-mysql"
  engine_mode        = "provisioned"
  engine_version     = var.engine_version
  database_name      = var.database_name
  master_username    = var.master_username
  master_password    = random_password.master.result

  # Serverless v2 configuration
  serverlessv2_scaling_configuration {
    min_capacity = var.min_capacity
    max_capacity = var.max_capacity
  }

  # Security
  storage_encrypted                   = true
  kms_key_id                          = var.kms_key_arn
  iam_database_authentication_enabled = true
  deletion_protection                 = var.deletion_protection

  # Network
  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.rds.id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  # Backup (HIPAA: 35 days retention)
  backup_retention_period      = var.backup_retention_period
  preferred_backup_window      = var.backup_window
  preferred_maintenance_window = var.maintenance_window
  copy_tags_to_snapshot        = true
  skip_final_snapshot          = var.environment == "staging" ? true : false
  final_snapshot_identifier    = var.environment == "production" ? "legience-${var.environment}-final-${formatdate("YYYY-MM-DD", timestamp())}" : null

  # Logging (SOC 2 requirement)
  enabled_cloudwatch_logs_exports = ["audit", "error", "slowquery"]

  tags = {
    Name        = "legience-${var.environment}-aurora"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    DataClass   = "confidential"
  }

  lifecycle {
    ignore_changes = [
      final_snapshot_identifier
    ]
  }
}

# -----------------------------------------------------------------------------
# Aurora Cluster Instances
# -----------------------------------------------------------------------------
resource "aws_rds_cluster_instance" "writer" {
  identifier           = "legience-${var.environment}-writer"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  publicly_accessible  = false

  # Monitoring (SOC 2)
  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_arn
  monitoring_interval             = var.monitoring_interval
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  tags = {
    Name        = "legience-${var.environment}-writer"
    Environment = var.environment
    Project     = "legience"
    Role        = "writer"
  }
}

resource "aws_rds_cluster_instance" "reader" {
  count                = var.environment == "production" ? 1 : 0
  identifier           = "legience-${var.environment}-reader-${count.index + 1}"
  cluster_identifier   = aws_rds_cluster.main.id
  instance_class       = "db.serverless"
  engine               = aws_rds_cluster.main.engine
  engine_version       = aws_rds_cluster.main.engine_version
  publicly_accessible  = false

  performance_insights_enabled    = true
  performance_insights_kms_key_id = var.kms_key_arn
  monitoring_interval             = var.monitoring_interval
  monitoring_role_arn             = aws_iam_role.rds_monitoring.arn

  tags = {
    Name        = "legience-${var.environment}-reader-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
    Role        = "reader"
  }
}

# -----------------------------------------------------------------------------
# Enhanced Monitoring IAM Role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "rds_monitoring" {
  name = "legience-${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-rds-monitoring-role"
    Environment = var.environment
    Project     = "legience"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# -----------------------------------------------------------------------------
# Store Credentials in Secrets Manager
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "legience/${var.environment}/database"
  description = "Database credentials for Legience ${var.environment}"
  kms_key_id  = var.secrets_kms_key_arn

  tags = {
    Name        = "legience-${var.environment}-db-credentials"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    host     = aws_rds_cluster.main.endpoint
    port     = aws_rds_cluster.main.port
    dbname   = var.database_name
    url      = "jdbc:mysql://${aws_rds_cluster.main.endpoint}:${aws_rds_cluster.main.port}/${var.database_name}"
  })
}
