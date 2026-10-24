resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ecsite-dev-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t4g.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = "ecsite-dev-elasticache-subnet-group"
  security_group_ids   = [data.aws_security_group.redis.id]
}

resource "aws_route53_record" "redis" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "redis.kai-page.net"
  type    = "CNAME"
  ttl     = 60
  records = [aws_elasticache_cluster.redis.cache_nodes[0].address]
}