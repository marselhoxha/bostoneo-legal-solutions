# =============================================================================
# Legience - Production Environment
# =============================================================================
# Main Terraform configuration for production deployment
# Owner: Bostoneo Solutions LLC
# Product: Legience (Legal Practice SaaS)
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
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "legience-terraform-locks"
  }
}

# -----------------------------------------------------------------------------
# Provider Configuration
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Environment = "production"
      Project     = "legience"
      Owner       = "Bostoneo Solutions LLC"
      Compliance  = "soc2-hipaa"
      ManagedBy   = "terraform"
    }
  }
}

# Provider for CloudFront/ACM (must be us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Environment = "production"
      Project     = "legience"
      Owner       = "Bostoneo Solutions LLC"
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Local Variables
# -----------------------------------------------------------------------------
locals {
  environment = "production"
  domain      = "legience.com"
  app_domain  = "app.legience.com"
  api_domain  = "api.legience.com"
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
# VPC
# -----------------------------------------------------------------------------
module "vpc" {
  source = "../../modules/vpc"

  environment        = local.environment
  region             = var.region
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  enable_nat_gateway  = true
  single_nat_gateway  = false  # HA: one NAT per AZ in production
  enable_flow_logs    = true
  enable_vpc_endpoints = true
  flow_log_retention_days = 90
}

# -----------------------------------------------------------------------------
# S3 Buckets
# -----------------------------------------------------------------------------
module "s3" {
  source = "../../modules/s3"

  environment        = local.environment
  kms_key_arn        = module.kms.s3_key_arn
  enable_object_lock = true  # Enable for compliance in production
}

# -----------------------------------------------------------------------------
# RDS Aurora PostgreSQL
# -----------------------------------------------------------------------------
module "rds" {
  source = "../../modules/rds"

  environment             = local.environment
  vpc_id                  = module.vpc.vpc_id
  data_subnet_ids         = module.vpc.data_subnet_ids
  allowed_security_groups = [module.ecs.api_security_group_id]
  kms_key_arn             = module.kms.rds_key_arn
  secrets_kms_key_arn     = module.kms.secrets_key_arn

  database_name           = "legience"
  master_username         = "legience_admin"
  min_capacity            = 0.5
  max_capacity            = 16
  backup_retention_period = 35  # HIPAA requirement
  deletion_protection     = true
}

# -----------------------------------------------------------------------------
# Application Load Balancer
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
    description = "HTTP (redirects to HTTPS)"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
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

  enable_deletion_protection = true

  access_logs {
    bucket  = module.s3.logs_bucket_id
    prefix  = "alb-logs"
    enabled = true
  }

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
    path                = "/actuator/health"
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
# aws secretsmanager put-secret-value --secret-id legience/production/app-secrets --secret-string '{...}'

# -----------------------------------------------------------------------------
# ECS Cluster and Services
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
  secrets_arns          = [module.rds.db_credentials_secret_arn, aws_secretsmanager_secret.app_secrets.arn]
  s3_bucket_arns        = [
    module.s3.documents_bucket_arn,
    "${module.s3.documents_bucket_arn}/*"
  ]

  api_image         = var.api_image
  api_cpu           = 1024
  api_memory        = 2048
  api_desired_count = 3
  api_min_count     = 2
  api_max_count     = 10

  container_environment = [
    {
      name  = "UI_APP_URL"
      value = "https://app.legience.com"
    },
    {
      name  = "CORS_ALLOWED_ORIGINS"
      value = "https://app.legience.com"
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
    }
  ]

  container_secrets = [
    {
      name       = "DB_URL"
      value_from = "${module.rds.db_credentials_secret_arn}:url::"
    },
    {
      name       = "DB_USERNAME"
      value_from = "${module.rds.db_credentials_secret_arn}:username::"
    },
    {
      name       = "DB_PASSWORD"
      value_from = "${module.rds.db_credentials_secret_arn}:password::"
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
# Outputs
# -----------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.api.dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "rds_endpoint" {
  description = "RDS cluster endpoint"
  value       = module.rds.cluster_endpoint
}

output "documents_bucket" {
  description = "Documents S3 bucket"
  value       = module.s3.documents_bucket_id
}

output "frontend_bucket" {
  description = "Frontend S3 bucket"
  value       = module.s3.frontend_bucket_id
}
