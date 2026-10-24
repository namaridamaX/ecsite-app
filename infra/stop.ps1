$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$region  = "ap-northeast-1"
$cluster = "ecsite-dev-ecs-cluster"
$service = "ecsite-dev-ecs-service-web"
$db      = "ecsite"

Write-Host "[1/3] ECS を停止 (タスク数 0)"
aws ecs update-service --region $region --cluster $cluster --service $service --desired-count 0 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ECS の更新に失敗しました" }
aws ecs wait services-stable --region $region --cluster $cluster --services $service

Write-Host "[2/3] Terraform destroy (NAT / ALB / Redis / DNS を削除)"
terraform destroy -auto-approve
if ($LASTEXITCODE -ne 0) { throw "terraform destroy に失敗しました" }

Write-Host "[3/3] RDS を停止"
$status = aws rds describe-db-instances --region $region --db-instance-identifier $db --query "DBInstances[0].DBInstanceStatus" --output text
if ($status -eq "available") {
  aws rds stop-db-instance --region $region --db-instance-identifier $db | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "RDS の停止に失敗しました" }
}
Write-Host "完了しました。課金はほぼ 0 円になりました"