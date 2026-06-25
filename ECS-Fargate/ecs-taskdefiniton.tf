resource "aws_ecs_task_definition" "TD" {
  family                   = "task-manager"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  execution_role_arn       = aws_iam_role.iam-role.arn

  cpu    = 1024
  memory = 2048

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "081212343968.dkr.ecr.us-east-1.amazonaws.com/frontend:2"
      essential = true

      cpu    = 512
      memory = 1024

      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
          protocol      = "tcp"
        }
      ]
    },

    {
      name      = "backend"
      image     = "081212343968.dkr.ecr.us-east-1.amazonaws.com/backend:19"
      essential = true

      cpu    = 512
      memory = 1024

      portMappings = [
        {
          containerPort = 3500
          hostPort      = 3500
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "MONGO_URI"
          value = "mongodb+srv://xxxx"
        },
        {
          name  = "PORT"
          value = "3500"
        }
      ]
    }
  ])
}
