$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$region  = "ap-northeast-1"
$cluster = "ecsite-dev-ecs-cluster"
$service = "ecsite-dev-ecs-service-web"
$db      = "ecsite"

Write-Host "[1/5] RDS を起動"
$status = aws rds describe-db-instances --region $region --db-instance-identifier $db --query "DBInstances[0].DBInstanceStatus" --output text
if ($status -eq "stopped") {
  aws rds start-db-instance --region $region --db-instance-identifier $db | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "RDS の起動に失敗しました" }
}

Write-Host "[2/5] Terraform apply (NAT / ALB / Redis / DNS)"
terraform apply -auto-approve
if ($LASTEXITCODE -ne 0) { throw "terraform apply に失敗しました" }

Write-Host "[3/5] RDS が利用可能になるまで待機"
aws rds wait db-instance-available --region $region --db-instance-identifier $db
if ($LASTEXITCODE -ne 0) { throw "RDS の待機に失敗しました" }

Write-Host "[4/5] ECS を起動 (タスク数 1)"
aws ecs update-service --region $region --cluster $cluster --service $service --desired-count 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ECS の更新に失敗しました" }
aws ecs wait services-stable --region $region --cluster $cluster --services $service
if ($LASTEXITCODE -ne 0) { throw "ECS が安定しませんでした" }

Write-Host "[5/5] ヘルスチェック"
curl.exe -s https://kai-page.net/health
Write-Host ""
Write-Host "完了しました"