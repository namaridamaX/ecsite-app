resource "aws_ecr_repository" "web" {
  name                 = "ecsite-dev-ecr-web"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
  encryption_configuration {
    encryption_type = "AES256"
  }
}