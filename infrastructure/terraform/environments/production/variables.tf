# =============================================================================
# Legience - Production Variables
# =============================================================================

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "api_image" {
  description = "Docker image for API"
  type        = string
  default     = "724629565287.dkr.ecr.us-east-1.amazonaws.com/legience-api:latest"
}
