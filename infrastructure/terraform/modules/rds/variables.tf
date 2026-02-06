# =============================================================================
# Legience - RDS Module Variables
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "data_subnet_ids" {
  description = "List of data subnet IDs for RDS"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "Security groups allowed to connect to RDS"
  type        = list(string)
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "secrets_kms_key_arn" {
  description = "KMS key ARN for Secrets Manager"
  type        = string
}

variable "database_name" {
  description = "Name of the database"
  type        = string
  default     = "legience"
}

variable "master_username" {
  description = "Master username for the database"
  type        = string
  default     = "legience_admin"
}

variable "engine_version" {
  description = "Aurora PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "min_capacity" {
  description = "Minimum Aurora Serverless v2 capacity (ACU)"
  type        = number
  default     = 0.5
}

variable "max_capacity" {
  description = "Maximum Aurora Serverless v2 capacity (ACU)"
  type        = number
  default     = 16
}

variable "backup_retention_period" {
  description = "Number of days to retain backups (HIPAA: minimum 35)"
  type        = number
  default     = 35
}

variable "backup_window" {
  description = "Preferred backup window"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds"
  type        = number
  default     = 60
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}
