# ---- サブネット ----
data "aws_subnet" "public_1a" {
  filter {
    name   = "tag:Name"
    values = ["ecsite-dev-vpc-subnet-public1-ap-northeast-1a"]
  }
}

data "aws_subnet" "public_1c" {
  filter {
    name   = "tag:Name"
    values = ["ecsite-dev-vpc-subnet-public2-ap-northeast-1c"]
  }
}

# ---- ルートテーブル ----
data "aws_route_table" "private_1a" {
  filter {
    name   = "tag:Name"
    values = ["ecsite-dev-vpc-rtb-private1-ap-northeast-1a"]
  }
}

data "aws_route_table" "private_1c" {
  filter {
    name   = "tag:Name"
    values = ["ecsite-dev-vpc-rtb-private2-ap-northeast-1c"]
  }
}

# ---- セキュリティグループ ----
data "aws_security_group" "alb" {
  filter {
    name   = "group-name"
    values = ["ecsite-dev-sg-alb"]
  }
}

data "aws_security_group" "redis" {
  filter {
    name   = "group-name"
    values = ["ecsite-dev-sg-redis"]
  }
}

# ---- ターゲットグループ、証明書、DNSゾーン ----
data "aws_lb_target_group" "web" {
  name = "ecsite-dev-tg-web"
}

data "aws_acm_certificate" "main" {
  domain      = "kai-page.net"
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_route53_zone" "main" {
  name         = "kai-page.net"
  private_zone = false
}