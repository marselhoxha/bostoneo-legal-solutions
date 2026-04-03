# =============================================================================
# Legience - Staging Environment
# =============================================================================
# Staging configuration with cost-optimized settings
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

  backend "s3" {
    bucket         = "legience-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "legience-terraform-locks"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = "staging"
      Project     = "legience"
      Owner       = "Bostoneo Solutions LLC"
      ManagedBy   = "terraform"
    }
  }
}

locals {
  environment = "staging"
}

# -----------------------------------------------------------------------------
# KMS Keys
# -----------------------------------------------------------------------------
module "kms" {
  source = "../../modules/kms"

  environment = local.environment
  region      = var.region
}

# -----------------------------------------------------------------------------
# VPC (Cost-optimized: single NAT gateway)
# -----------------------------------------------------------------------------
module "vpc" {
  source = "../../modules/vpc"

  environment        = local.environment
  region             = var.region
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  enable_nat_gateway   = true
  single_nat_gateway   = true  # Cost savings for staging
  enable_flow_logs     = true
  enable_vpc_endpoints = true
  flow_log_retention_days = 30
}

# -----------------------------------------------------------------------------
# S3 Buckets
# -----------------------------------------------------------------------------
module "s3" {
  source = "../../modules/s3"

  environment        = local.environment
  kms_key_arn        = module.kms.s3_key_arn
  enable_object_lock = false  # Not needed for staging
}

# -----------------------------------------------------------------------------
# RDS PostgreSQL (Standard instance for free tier account)
# -----------------------------------------------------------------------------
resource "random_password" "db_master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "main" {
  name        = "legience-${local.environment}-db-subnet-group"
  description = "Database subnet group for Legience ${local.environment}"
  subnet_ids  = module.vpc.data_subnet_ids

  tags = {
    Name = "legience-${local.environment}-db-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name        = "legience-${local.environment}-rds-sg"
  description = "Security group for Legience RDS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.ecs.api_security_group_id]
    description     = "PostgreSQL from ECS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "legience-${local.environment}-rds-sg"
  }
}

resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "legience-${local.environment}-pg-params"

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "2000"
  }

  tags = {
    Name = "legience-${local.environment}-pg-params"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "legience-${local.environment}"
  engine         = "postgres"
  engine_version = "15.10"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = module.kms.rds_key_arn

  db_name  = "legience"
  username = "legience_admin"
  password = random_password.db_master.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false

  backup_retention_period = 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot   = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "legience-staging-final"
  deletion_protection     = true

  tags = {
    Name = "legience-${local.environment}-db"
  }
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "legience/${local.environment}/database-v2"
  description = "Database credentials for Legience ${local.environment}"
  kms_key_id  = module.kms.secrets_key_arn

  tags = {
    Name = "legience-${local.environment}-db-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "legience_admin"
    password = random_password.db_master.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = "legience"
    url      = "jdbc:postgresql://${aws_db_instance.main.address}:${aws_db_instance.main.port}/legience"
  })
}

# -----------------------------------------------------------------------------
# ALB
# -----------------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "legience-${local.environment}-alb-sg"
  description = "Security group for Legience ALB"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "legience-${local.environment}-alb-sg"
  }
}

resource "aws_lb" "api" {
  name               = "legience-${local.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnet_ids

  enable_deletion_protection = false

  tags = {
    Name = "legience-${local.environment}-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "legience-${local.environment}-api-tg"
  port        = 8085
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = {
    Name = "legience-${local.environment}-api-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# -----------------------------------------------------------------------------
# App Secrets (API keys, JWT, encryption, etc.)
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "legience/${local.environment}/app-secrets"
  description = "Application secrets for Legience ${local.environment}"
  kms_key_id  = module.kms.secrets_key_arn

  tags = {
    Name        = "legience-${local.environment}-app-secrets"
    Environment = local.environment
  }
}

# NOTE: Secret values must be populated manually via AWS Console or CLI:
# aws secretsmanager put-secret-value --secret-id legience/staging/app-secrets --secret-string '{
#   "JWT_SECRET": "...",
#   "ENCRYPTION_SECRET": "...",
#   "ENCRYPTION_SALT": "...",
#   "OPENAI_API_KEY": "...",
#   "ANTHROPIC_API_KEY": "...",
#   "STRIPE_API_KEY": "...",
#   "STRIPE_WEBHOOK_SECRET": "...",
#   "TWILIO_ACCOUNT_SID": "...",
#   "TWILIO_AUTH_TOKEN": "...",
#   "TWILIO_PHONE_NUMBER": "...",
#   "BOLDSIGN_API_KEY": "...",
#   "COURTLISTENER_API_KEY": "...",
#   "EMAIL_ID": "...",
#   "EMAIL_PASSWORD": "..."
# }'

# -----------------------------------------------------------------------------
# ECS (Smaller capacity for staging)
# -----------------------------------------------------------------------------
module "ecs" {
  source = "../../modules/ecs"

  environment           = local.environment
  region                = var.region
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = aws_security_group.alb.id
  target_group_arn      = aws_lb_target_group.api.arn
  kms_key_id            = module.kms.logs_key_id
  kms_key_arn           = module.kms.logs_key_arn
  secrets_arns          = [aws_secretsmanager_secret.db_credentials.arn, aws_secretsmanager_secret.app_secrets.arn]
  s3_bucket_arns        = [
    module.s3.documents_bucket_arn,
    "${module.s3.documents_bucket_arn}/*"
  ]

  api_image         = var.api_image
  api_cpu           = 512
  api_memory        = 1024
  api_desired_count = 1
  api_min_count     = 1
  api_max_count     = 3

  container_environment = [
    {
      name  = "UI_APP_URL"
      value = "https://app-staging.legience.com"
    },
    {
      name  = "CORS_ALLOWED_ORIGINS"
      value = "https://app-staging.legience.com"
    },
    {
      name  = "EMAIL_FROM_ADDRESS"
      value = "hello@legience.com"
    },
    {
      name  = "EMAIL_FROM_NAME"
      value = "Legience"
    },
    {
      name  = "REDIS_HOST"
      value = "localhost"
    },
    {
      name  = "REDIS_PORT"
      value = "6379"
    },
    {
      name  = "FILE_STORAGE_TYPE"
      value = "s3"
    },
    {
      name  = "S3_BUCKET_NAME"
      value = module.s3.documents_bucket_id
    },
    {
      name  = "S3_REGION"
      value = var.region
    },
    {
      name  = "AWS_REGION"
      value = var.region
    }
  ]

  container_secrets = [
    {
      name       = "DB_URL"
      value_from = "${aws_secretsmanager_secret.db_credentials.arn}:url::"
    },
    {
      name       = "DB_USERNAME"
      value_from = "${aws_secretsmanager_secret.db_credentials.arn}:username::"
    },
    {
      name       = "DB_PASSWORD"
      value_from = "${aws_secretsmanager_secret.db_credentials.arn}:password::"
    },
    {
      name       = "JWT_SECRET"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_SECRET::"
    },
    {
      name       = "ENCRYPTION_SECRET"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:ENCRYPTION_SECRET::"
    },
    {
      name       = "ENCRYPTION_SALT"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:ENCRYPTION_SALT::"
    },
    {
      name       = "OPENAI_API_KEY"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:OPENAI_API_KEY::"
    },
    {
      name       = "ANTHROPIC_API_KEY"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:ANTHROPIC_API_KEY::"
    },
    {
      name       = "STRIPE_API_KEY"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:STRIPE_API_KEY::"
    },
    {
      name       = "STRIPE_WEBHOOK_SECRET"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:STRIPE_WEBHOOK_SECRET::"
    },
    {
      name       = "TWILIO_ACCOUNT_SID"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:TWILIO_ACCOUNT_SID::"
    },
    {
      name       = "TWILIO_AUTH_TOKEN"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:TWILIO_AUTH_TOKEN::"
    },
    {
      name       = "TWILIO_PHONE_NUMBER"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:TWILIO_PHONE_NUMBER::"
    },
    {
      name       = "BOLDSIGN_API_KEY"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:BOLDSIGN_API_KEY::"
    },
    {
      name       = "COURTLISTENER_API_KEY"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:COURTLISTENER_API_KEY::"
    },
    {
      name       = "EMAIL_ID"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:EMAIL_ID::"
    },
    {
      name       = "EMAIL_PASSWORD"
      value_from = "${aws_secretsmanager_secret.app_secrets.arn}:EMAIL_PASSWORD::"
    }
  ]
}

# -----------------------------------------------------------------------------
# SES (Email sending via Amazon SES instead of Gmail SMTP)
# -----------------------------------------------------------------------------
resource "aws_ses_domain_identity" "legience" {
  domain = "legience.com"
}

resource "aws_ses_domain_dkim" "legience" {
  domain = aws_ses_domain_identity.legience.domain
}

resource "aws_iam_user" "ses_smtp" {
  name = "legience-${local.environment}-ses-smtp"
}

resource "aws_iam_user_policy" "ses_smtp" {
  name = "ses-send-email"
  user = aws_iam_user.ses_smtp.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_access_key" "ses_smtp" {
  user = aws_iam_user.ses_smtp.name
}

output "ses_dkim_tokens" {
  description = "SES DKIM tokens - add as CNAME records in DNS"
  value       = aws_ses_domain_dkim.legience.dkim_tokens
}

output "ses_smtp_username" {
  description = "SES SMTP username (use as EMAIL_ID in Secrets Manager)"
  value       = aws_iam_access_key.ses_smtp.id
}

output "ses_smtp_password" {
  description = "SES SMTP password (use as EMAIL_PASSWORD in Secrets Manager)"
  value       = aws_iam_access_key.ses_smtp.ses_smtp_password_v4
  sensitive   = true
}

# -----------------------------------------------------------------------------
# GitHub Actions OIDC Role (shared across staging/production)
# -----------------------------------------------------------------------------
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_role" "github_actions" {
  name = "GitHubActionsRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
            "token.actions.githubusercontent.com:sub" = [
              "repo:marselhoxha/bostoneo-legal-solutions:ref:refs/heads/main",
              "repo:marselhoxha/bostoneo-legal-solutions:ref:refs/heads/staging"
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name        = "GitHubActionsRole"
    Environment = "shared"
    Project     = "legience"
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "GitHubActionsDeployPolicy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:us-east-1:724629565287:repository/legience-api"
      },
      {
        Sid    = "ECS"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters"
        ]
        Resource = [
          "arn:aws:ecs:us-east-1:724629565287:cluster/legience-*",
          "arn:aws:ecs:us-east-1:724629565287:service/legience-*/*"
        ]
      },
      {
        Sid    = "ALBHealthCheckDescribe"
        Effect = "Allow"
        Action = ["elasticloadbalancing:DescribeTargetGroups"]
        Resource = "*"
      },
      {
        Sid    = "ALBHealthCheckModify"
        Effect = "Allow"
        Action = ["elasticloadbalancing:ModifyTargetGroup"]
        Resource = "arn:aws:elasticloadbalancing:us-east-1:724629565287:targetgroup/legience-*/*"
      },
      {
        Sid    = "S3Frontend"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::legience-*-frontend-*",
          "arn:aws:s3:::legience-*-frontend-*/*",
          "arn:aws:s3:::app-staging.legience.com",
          "arn:aws:s3:::app-staging.legience.com/*",
          "arn:aws:s3:::app.legience.com",
          "arn:aws:s3:::app.legience.com/*"
        ]
      },
      {
        Sid    = "CloudFrontInvalidation"
        Effect = "Allow"
        Action = ["cloudfront:CreateInvalidation"]
        Resource = "arn:aws:cloudfront::724629565287:distribution/E1UWEPT9HA7VQX"
      },
      {
        Sid    = "SecretsRead"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:us-east-1:724629565287:secret:legience/*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------
output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}
