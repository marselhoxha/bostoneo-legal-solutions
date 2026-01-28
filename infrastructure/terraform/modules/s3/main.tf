# =============================================================================
# Legience - S3 Module
# =============================================================================
# S3 buckets for documents and frontend - SOC 2 and HIPAA compliant
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
# Documents Bucket (PHI/Confidential Data)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "documents" {
  bucket = "legience-${var.environment}-documents-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "legience-${var.environment}-documents"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    DataClass   = "confidential"
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_logging" "documents" {
  bucket = aws_s3_bucket.documents.id

  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/documents/"
}

# -----------------------------------------------------------------------------
# Frontend Bucket (Static Website)
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "frontend" {
  bucket = "legience-${var.environment}-frontend-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "legience-${var.environment}-frontend"
    Environment = var.environment
    Project     = "legience"
    DataClass   = "public"
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# -----------------------------------------------------------------------------
# Logs Bucket
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "logs" {
  bucket = "legience-${var.environment}-logs-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "legience-${var.environment}-logs"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    DataClass   = "internal"
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# -----------------------------------------------------------------------------
# Backups Bucket
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "backups" {
  bucket = "legience-${var.environment}-backups-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "legience-${var.environment}-backups"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    DataClass   = "confidential"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Object Lock for compliance (WORM - Write Once Read Many)
resource "aws_s3_bucket_object_lock_configuration" "backups" {
  count  = var.enable_object_lock ? 1 : 0
  bucket = aws_s3_bucket.backups.id

  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = 365
    }
  }
}
