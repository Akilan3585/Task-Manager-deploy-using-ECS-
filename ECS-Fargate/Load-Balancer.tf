resource "aws_lb" "LB" {
  name               = "Main-LB"
  internal           = false
  load_balancer_type = "application"

  security_groups = [
    aws_security_group.SG.id
  ]

  subnets = [
    aws_subnet.subnet1.id,
    aws_subnet.subnet2.id
  ]

  tags = {
    Name = "Main-LB"
  }
}
resource "aws_lb_listener" "frontend" {
  load_balancer_arn = aws_lb.LB.arn

  port     = 80
  protocol = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend_tg.arn
  }
}
resource "aws_lb_listener_rule" "backend_rule" {
  listener_arn = aws_lb_listener.frontend.arn

  priority = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}
