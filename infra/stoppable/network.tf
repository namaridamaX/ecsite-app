resource "aws_eip" "nat" {
  domain = "vpc"
  tags = {
    Name = "ecsite-dev-natgw-1a-eip"
  }
}
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = data.aws_subnet.public_1a.id

  tags = {
    Name = "ecsite-dev-natgw-1a"
  }
}
resource "aws_route" "private_1a_default" {
  route_table_id         = data.aws_route_table.private_1a.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}
resource "aws_route" "private_1c_default" {
  route_table_id         = data.aws_route_table.private_1c.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main.id
}