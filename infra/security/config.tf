# ① 記録の保存先S3
resource "aws_s3_bucket" "config" {
  bucket        = "ecsite-dev-config-416530265625"
  force_destroy = true
}

# ② Configが使うIAMロール
resource "aws_iam_role" "config" {
  name = "ecsite-dev-role-config"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "config.amazonaws.com" }
      }
    ]
  })
}

# ③ AWS管理ポリシーのアタッチ
resource "aws_iam_role_policy_attachment" "config" {
  role       = aws_iam_role.config.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

# ④ S3への書き込み許可
resource "aws_iam_role_policy" "config_s3" {
  name = "config-s3"
  role = aws_iam_role.config.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.config.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.config.arn
      }
    ]
  })
}

# ⑤ レコーダー(記録対象を3種類に限定)
resource "aws_config_configuration_recorder" "main" {
  name     = "ecsite-dev-config-recorder"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported = false
    resource_types = [
      "AWS::EC2::SecurityGroup",
      "AWS::S3::Bucket",
      "AWS::RDS::DBInstance",
    ]
  }
}

# ⑥ 配信チャンネル
resource "aws_config_delivery_channel" "main" {
  name           = "ecsite-dev-config-delivery"
  s3_bucket_name = aws_s3_bucket.config.bucket

  depends_on = [aws_config_configuration_recorder.main]
}

# ⑦ 記録の開始
resource "aws_config_configuration_recorder_status" "main" {
  name       = aws_config_configuration_recorder.main.name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

# ⑧ ルール: S3の公開チェック
resource "aws_config_config_rule" "s3_public" {
  name = "s3-public-read-prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }

  depends_on = [aws_config_configuration_recorder.main]
}

# ⑨ ルール: RDSの公開チェック
resource "aws_config_config_rule" "rds_public" {
  name = "rds-instance-public-access-check"

  source {
    owner             = "AWS"
    source_identifier = "RDS_INSTANCE_PUBLIC_ACCESS_CHECK"
  }

  depends_on = [aws_config_configuration_recorder.main]
}