# =============================================================================
# Legience - ECS Module Variables
# =============================================================================

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID of the ALB"
  type        = string
}

variable "target_group_arn" {
  description = "ARN of the target group"
  type        = string
}

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "secrets_arns" {
  description = "List of Secrets Manager secret ARNs"
  type        = list(string)
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs for task access"
  type        = list(string)
  default     = []
}

variable "api_image" {
  description = "Docker image for the API"
  type        = string
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 8085
}

variable "api_cpu" {
  description = "CPU units for API task"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "Memory for API task in MB"
  type        = number
  default     = 2048
}

variable "api_desired_count" {
  description = "Desired number of API tasks"
  type        = number
  default     = 2
}

variable "api_min_count" {
  description = "Minimum number of API tasks"
  type        = number
  default     = 2
}

variable "api_max_count" {
  description = "Maximum number of API tasks"
  type        = number
  default     = 10
}

variable "container_secrets" {
  description = "List of secrets to inject into container"
  type = list(object({
    name       = string
    value_from = string
  }))
  default = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 90
}
