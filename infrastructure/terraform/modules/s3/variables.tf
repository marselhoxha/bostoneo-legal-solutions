variable "environment" {
  description = "Environment name"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "enable_object_lock" {
  description = "Enable S3 Object Lock for compliance"
  type        = bool
  default     = false
}
