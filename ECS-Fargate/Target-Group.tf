resource "aws_lb_target_group" "frontend_tg" {
  name        = "Frontend-TG"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.vpc.id

  tags = {
    Name = "Frontend-TG"
  }
}

resource "aws_lb_target_group" "backend_tg" {
  name        = "Backend-TG"
  port        = 3500
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.vpc.id

  health_check {
    path                = "/"
    protocol            = "HTTP"
    port                = "3500"
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
  }

  tags = {
    Name = "Backend-TG"
  }
}
