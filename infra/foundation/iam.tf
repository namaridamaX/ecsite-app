# ① ECSタスクロール
resource "aws_iam_role" "ecs_task" {
  name        = "ecsite-dev-ecs-task-role"
  description = "Allows ECS tasks to call AWS services on your behalf."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = ""
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# ② DynamoDBへのアクセス権限
resource "aws_iam_role_policy" "ecs_task_dynamodb" {
  name = "ecsite-dev-policy-ecs-dynamodb"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "VisualEditor0"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:BatchGetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          "arn:aws:dynamodb:ap-northeast-1:416530265625:table/ecsite-dev-dynamodb-cart",
          "arn:aws:dynamodb:ap-northeast-1:416530265625:table/ecsite-dev-dynamodb-browsing-history",
          "arn:aws:dynamodb:*:416530265625:table/*/index/*",
        ]
      }
    ]
  })
}

# ③ SQSへのメッセージ送信権限
resource "aws_iam_role_policy" "ecs_task_sqs_send" {
  name = "ecsite-dev-policy-ecs-sqs-send"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "sqs:SendMessage"
        Resource = "arn:aws:sqs:ap-northeast-1:416530265625:ecsite-dev-sqs-order-processing"
      }
    ]
  })
}