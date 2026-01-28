# =============================================================================
# Legience - VPC Module
# =============================================================================
# Creates a production-ready VPC with public, private, and data subnets
# Compliant with SOC 2 and HIPAA requirements
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "legience-${var.environment}-vpc"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
    ManagedBy   = "terraform"
  }
}

# -----------------------------------------------------------------------------
# Internet Gateway
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "legience-${var.environment}-igw"
    Environment = var.environment
    Project     = "legience"
  }
}

# -----------------------------------------------------------------------------
# Public Subnets (for ALB, NAT Gateway)
# -----------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "legience-${var.environment}-public-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
    Tier        = "public"
  }
}

# -----------------------------------------------------------------------------
# Private Subnets (for ECS Fargate)
# -----------------------------------------------------------------------------
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "legience-${var.environment}-private-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
    Tier        = "private"
  }
}

# -----------------------------------------------------------------------------
# Data Subnets (for RDS, ElastiCache)
# -----------------------------------------------------------------------------
resource "aws_subnet" "data" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 8)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "legience-${var.environment}-data-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
    Tier        = "data"
    DataClass   = "confidential"
  }
}

# -----------------------------------------------------------------------------
# Elastic IPs for NAT Gateways
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  domain = "vpc"

  tags = {
    Name        = "legience-${var.environment}-nat-eip-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
  }

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# NAT Gateways
# -----------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name        = "legience-${var.environment}-nat-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
  }

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# Route Tables - Public
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "legience-${var.environment}-public-rt"
    Environment = var.environment
    Project     = "legience"
    Tier        = "public"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# Route Tables - Private
# -----------------------------------------------------------------------------
resource "aws_route_table" "private" {
  count  = var.single_nat_gateway ? 1 : length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "legience-${var.environment}-private-rt-${count.index + 1}"
    Environment = var.environment
    Project     = "legience"
    Tier        = "private"
  }
}

resource "aws_route" "private_nat" {
  count                  = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : length(var.availability_zones)) : 0
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[var.single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[var.single_nat_gateway ? 0 : count.index].id
}

# -----------------------------------------------------------------------------
# Route Tables - Data
# -----------------------------------------------------------------------------
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "legience-${var.environment}-data-rt"
    Environment = var.environment
    Project     = "legience"
    Tier        = "data"
  }
}

resource "aws_route_table_association" "data" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.data.id
}

# -----------------------------------------------------------------------------
# VPC Flow Logs (Required for SOC 2 / HIPAA)
# -----------------------------------------------------------------------------
resource "aws_flow_log" "main" {
  count                = var.enable_flow_logs ? 1 : 0
  vpc_id               = aws_vpc.main.id
  traffic_type         = "ALL"
  iam_role_arn         = aws_iam_role.flow_log[0].arn
  log_destination      = aws_cloudwatch_log_group.flow_log[0].arn
  log_destination_type = "cloud-watch-logs"

  tags = {
    Name        = "legience-${var.environment}-flow-logs"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

resource "aws_cloudwatch_log_group" "flow_log" {
  count             = var.enable_flow_logs ? 1 : 0
  name              = "/aws/vpc/legience-${var.environment}-flow-logs"
  retention_in_days = var.flow_log_retention_days

  tags = {
    Name        = "legience-${var.environment}-flow-logs"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

resource "aws_iam_role" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0
  name  = "legience-${var.environment}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-flow-log-role"
    Environment = var.environment
    Project     = "legience"
  }
}

resource "aws_iam_role_policy" "flow_log" {
  count = var.enable_flow_logs ? 1 : 0
  name  = "legience-${var.environment}-flow-log-policy"
  role  = aws_iam_role.flow_log[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# VPC Endpoints (Cost optimization - avoid NAT charges for AWS services)
# -----------------------------------------------------------------------------

# S3 Gateway Endpoint (free)
resource "aws_vpc_endpoint" "s3" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(
    aws_route_table.private[*].id,
    [aws_route_table.data.id]
  )

  tags = {
    Name        = "legience-${var.environment}-s3-endpoint"
    Environment = var.environment
    Project     = "legience"
  }
}

# DynamoDB Gateway Endpoint (free)
resource "aws_vpc_endpoint" "dynamodb" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat(
    aws_route_table.private[*].id,
    [aws_route_table.data.id]
  )

  tags = {
    Name        = "legience-${var.environment}-dynamodb-endpoint"
    Environment = var.environment
    Project     = "legience"
  }
}

# Security Group for Interface Endpoints
resource "aws_security_group" "vpc_endpoints" {
  count       = var.enable_vpc_endpoints ? 1 : 0
  name        = "legience-${var.environment}-vpc-endpoints-sg"
  description = "Security group for VPC Interface Endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "HTTPS from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "legience-${var.environment}-vpc-endpoints-sg"
    Environment = var.environment
    Project     = "legience"
  }
}

# ECR API Endpoint
resource "aws_vpc_endpoint" "ecr_api" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "legience-${var.environment}-ecr-api-endpoint"
    Environment = var.environment
    Project     = "legience"
  }
}

# ECR DKR Endpoint
resource "aws_vpc_endpoint" "ecr_dkr" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "legience-${var.environment}-ecr-dkr-endpoint"
    Environment = var.environment
    Project     = "legience"
  }
}

# Secrets Manager Endpoint
resource "aws_vpc_endpoint" "secretsmanager" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "legience-${var.environment}-secretsmanager-endpoint"
    Environment = var.environment
    Project     = "legience"
  }
}

# CloudWatch Logs Endpoint
resource "aws_vpc_endpoint" "logs" {
  count               = var.enable_vpc_endpoints ? 1 : 0
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.logs"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = {
    Name        = "legience-${var.environment}-logs-endpoint"
    Environment = var.environment
    Project     = "legience"
  }
}
