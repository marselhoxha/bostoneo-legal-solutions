# =============================================================================
# Legience - RDS Module Outputs
# =============================================================================

output "cluster_id" {
  description = "The Aurora cluster identifier"
  value       = aws_rds_cluster.main.id
}

output "cluster_arn" {
  description = "The Aurora cluster ARN"
  value       = aws_rds_cluster.main.arn
}

output "cluster_endpoint" {
  description = "Writer endpoint for the Aurora cluster"
  value       = aws_rds_cluster.main.endpoint
}

output "cluster_reader_endpoint" {
  description = "Reader endpoint for the Aurora cluster"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "cluster_port" {
  description = "The port on which the cluster accepts connections"
  value       = aws_rds_cluster.main.port
}

output "database_name" {
  description = "The name of the database"
  value       = aws_rds_cluster.main.database_name
}

output "master_username" {
  description = "The master username"
  value       = aws_rds_cluster.main.master_username
  sensitive   = true
}

output "security_group_id" {
  description = "The security group ID for the RDS cluster"
  value       = aws_security_group.rds.id
}

output "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret containing DB credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_credentials_secret_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}
