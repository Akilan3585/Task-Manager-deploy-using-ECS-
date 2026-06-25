resource "aws_ecs_service" "ECS-Service" {
  name            = "First-Service"
  cluster         = aws_ecs_cluster.ECS.id
  task_definition = aws_ecs_task_definition.TD.arn
  launch_type     = "FARGATE"

  desired_count                      = 2
  platform_version                   = "LATEST"
  scheduling_strategy                = "REPLICA"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  depends_on = [
    aws_lb_listener.frontend
  ]

  # Frontend Target Group
  load_balancer {
    target_group_arn = aws_lb_target_group.frontend_tg.arn
    container_name   = "frontend"
    container_port   = 80
  }

  # Backend Target Group
  load_balancer {
    target_group_arn = aws_lb_target_group.backend_tg.arn
    container_name   = "backend"
    container_port   = 3500
  }

  network_configuration {
    assign_public_ip = true

    security_groups = [
      aws_security_group.SG.id
    ]

    subnets = [
      aws_subnet.subnet1.id,
      aws_subnet.subnet2.id
    ]
  }
}
