output "documents_bucket_id" {
  description = "Documents bucket ID"
  value       = aws_s3_bucket.documents.id
}

output "documents_bucket_arn" {
  description = "Documents bucket ARN"
  value       = aws_s3_bucket.documents.arn
}

output "frontend_bucket_id" {
  description = "Frontend bucket ID"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_bucket_arn" {
  description = "Frontend bucket ARN"
  value       = aws_s3_bucket.frontend.arn
}

output "frontend_bucket_domain" {
  description = "Frontend bucket regional domain"
  value       = aws_s3_bucket.frontend.bucket_regional_domain_name
}

output "logs_bucket_id" {
  description = "Logs bucket ID"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "Logs bucket ARN"
  value       = aws_s3_bucket.logs.arn
}

output "backups_bucket_id" {
  description = "Backups bucket ID"
  value       = aws_s3_bucket.backups.id
}

output "backups_bucket_arn" {
  description = "Backups bucket ARN"
  value       = aws_s3_bucket.backups.arn
}
