# =============================================================================
# Legience - Production Terraform Variables
# =============================================================================
# DO NOT commit sensitive values to version control
# Use environment variables or Terraform Cloud for secrets
# =============================================================================

region             = "us-east-1"
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]

# Update with your ECR repository URL after creation
# api_image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/legience-api:latest"
