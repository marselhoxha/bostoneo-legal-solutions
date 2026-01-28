# =============================================================================
# Legience - VPC Module Outputs
# =============================================================================

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "List of data subnet IDs"
  value       = aws_subnet.data[*].id
}

output "public_subnet_cidrs" {
  description = "List of public subnet CIDR blocks"
  value       = aws_subnet.public[*].cidr_block
}

output "private_subnet_cidrs" {
  description = "List of private subnet CIDR blocks"
  value       = aws_subnet.private[*].cidr_block
}

output "data_subnet_cidrs" {
  description = "List of data subnet CIDR blocks"
  value       = aws_subnet.data[*].cidr_block
}

output "nat_gateway_ids" {
  description = "List of NAT Gateway IDs"
  value       = aws_nat_gateway.main[*].id
}

output "nat_public_ips" {
  description = "List of NAT Gateway public IPs"
  value       = aws_eip.nat[*].public_ip
}

output "internet_gateway_id" {
  description = "The ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

output "public_route_table_id" {
  description = "The ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "List of private route table IDs"
  value       = aws_route_table.private[*].id
}

output "data_route_table_id" {
  description = "The ID of the data route table"
  value       = aws_route_table.data.id
}

output "vpc_endpoint_s3_id" {
  description = "The ID of the S3 VPC endpoint"
  value       = var.enable_vpc_endpoints ? aws_vpc_endpoint.s3[0].id : null
}

output "vpc_endpoints_security_group_id" {
  description = "The ID of the VPC endpoints security group"
  value       = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}

output "flow_log_group_name" {
  description = "The name of the VPC Flow Logs CloudWatch Log Group"
  value       = var.enable_flow_logs ? aws_cloudwatch_log_group.flow_log[0].name : null
}

output "availability_zones" {
  description = "List of availability zones used"
  value       = var.availability_zones
}
