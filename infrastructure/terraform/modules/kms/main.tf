# =============================================================================
# Legience - KMS Module
# =============================================================================
# Customer Managed Keys for encryption - SOC 2 and HIPAA compliant
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_caller_identity" "current" {}

# -----------------------------------------------------------------------------
# KMS Key for RDS Encryption
# -----------------------------------------------------------------------------
resource "aws_kms_key" "rds" {
  description             = "KMS key for Legience RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-rds-key"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    Purpose     = "rds-encryption"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/legience-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for S3 Encryption
# -----------------------------------------------------------------------------
resource "aws_kms_key" "s3" {
  description             = "KMS key for Legience S3 encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-s3-key"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    Purpose     = "s3-encryption"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/legience-${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for Secrets Manager
# -----------------------------------------------------------------------------
resource "aws_kms_key" "secrets" {
  description             = "KMS key for Legience Secrets Manager"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Secrets Manager to use the key"
        Effect = "Allow"
        Principal = {
          Service = "secretsmanager.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-secrets-key"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    Purpose     = "secrets-encryption"
  }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/legience-${var.environment}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# -----------------------------------------------------------------------------
# KMS Key for ECS/CloudWatch Logs
# -----------------------------------------------------------------------------
resource "aws_kms_key" "logs" {
  description             = "KMS key for Legience CloudWatch Logs encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs to use the key"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-logs-key"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    Purpose     = "logs-encryption"
  }
}

resource "aws_kms_alias" "logs" {
  name          = "alias/legience-${var.environment}-logs"
  target_key_id = aws_kms_key.logs.key_id
}
