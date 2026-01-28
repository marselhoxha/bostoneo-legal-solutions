# =============================================================================
# Legience - ECS Module Outputs
# =============================================================================

output "cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "api_service_id" {
  description = "ECS API service ID"
  value       = aws_ecs_service.api.id
}

output "api_service_name" {
  description = "ECS API service name"
  value       = aws_ecs_service.api.name
}

output "api_task_definition_arn" {
  description = "ECS API task definition ARN"
  value       = aws_ecs_task_definition.api.arn
}

output "api_security_group_id" {
  description = "Security group ID for API tasks"
  value       = aws_security_group.ecs_api.id
}

output "execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_execution.arn
}

output "task_role_arn" {
  description = "ECS task role ARN"
  value       = aws_iam_role.ecs_task.arn
}

output "api_log_group_name" {
  description = "CloudWatch log group name for API"
  value       = aws_cloudwatch_log_group.api.name
}
