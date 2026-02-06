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
# RDS Aurora PostgreSQL (Smaller capacity for staging)
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
  max_capacity            = 4  # Lower max for staging
  backup_retention_period = 7  # Shorter retention for staging
  deletion_protection     = false
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

# Note: HTTPS listener requires ACM certificate
# Uncomment after certificate is created
# resource "aws_lb_listener" "https" {
#   load_balancer_arn = aws_lb.api.arn
#   port              = 443
#   protocol          = "HTTPS"
#   ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
#   certificate_arn   = aws_acm_certificate.main.arn
#
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.api.arn
#   }
# }

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
  secrets_arns          = [module.rds.db_credentials_secret_arn]
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
    }
  ]
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
