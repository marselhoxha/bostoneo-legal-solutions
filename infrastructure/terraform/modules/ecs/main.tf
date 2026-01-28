# =============================================================================
# Legience - ECS Fargate Module
# =============================================================================
# ECS Fargate cluster with API service - SOC 2 and HIPAA compliant
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
# ECS Cluster
# -----------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "legience-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      kms_key_id = var.kms_key_id
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_exec.name
      }
    }
  }

  tags = {
    Name        = "legience-${var.environment}-cluster"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# -----------------------------------------------------------------------------
# CloudWatch Log Groups
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/aws/ecs/legience-${var.environment}/exec"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_id

  tags = {
    Name        = "legience-${var.environment}-ecs-exec-logs"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/legience-${var.environment}-api"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_id

  tags = {
    Name        = "legience-${var.environment}-api-logs"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

# -----------------------------------------------------------------------------
# ECS Task Execution Role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ecs_execution" {
  name = "legience-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-ecs-execution-role"
    Environment = var.environment
    Project     = "legience"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "legience-${var.environment}-ecs-secrets-policy"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [var.kms_key_arn]
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# ECS Task Role
# -----------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task" {
  name = "legience-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "legience-${var.environment}-ecs-task-role"
    Environment = var.environment
    Project     = "legience"
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "legience-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = var.s3_bucket_arns
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secrets_arns
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [var.kms_key_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Security Group for ECS Tasks
# -----------------------------------------------------------------------------
resource "aws_security_group" "ecs_api" {
  name        = "legience-${var.environment}-ecs-api-sg"
  description = "Security group for Legience API ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
    description     = "Allow traffic from ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name        = "legience-${var.environment}-ecs-api-sg"
    Environment = var.environment
    Project     = "legience"
  }
}

# -----------------------------------------------------------------------------
# ECS Task Definition
# -----------------------------------------------------------------------------
resource "aws_ecs_task_definition" "api" {
  family                   = "legience-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.api_image

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "SPRING_PROFILES_ACTIVE"
          value = var.environment
        },
        {
          name  = "SERVER_PORT"
          value = tostring(var.container_port)
        },
        {
          name  = "JAVA_OPTS"
          value = "-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
        }
      ]

      secrets = [
        for secret in var.container_secrets : {
          name      = secret.name
          valueFrom = secret.value_from
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/actuator/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 120
      }

      # Security hardening
      readonlyRootFilesystem = false
      user                   = "1000:1000"
    }
  ])

  tags = {
    Name        = "legience-${var.environment}-api-task"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }
}

# -----------------------------------------------------------------------------
# ECS Service
# -----------------------------------------------------------------------------
resource "aws_ecs_service" "api" {
  name                               = "legience-${var.environment}-api"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = var.api_desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = true

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = {
    Name        = "legience-${var.environment}-api-service"
    Environment = var.environment
    Project     = "legience"
    Compliance  = "soc2-hipaa"
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# -----------------------------------------------------------------------------
# Auto Scaling
# -----------------------------------------------------------------------------
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.api_max_count
  min_capacity       = var.api_min_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "legience-${var.environment}-api-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "legience-${var.environment}-api-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
