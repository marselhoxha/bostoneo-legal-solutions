variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.1.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "api_image" {
  description = "Docker image for API"
  type        = string
  default     = "724629565287.dkr.ecr.us-east-1.amazonaws.com/legience-api:staging"
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = "arn:aws:acm:us-east-1:724629565287:certificate/fceaa5d3-fbf1-4d97-9a6d-51855625db70"
}
