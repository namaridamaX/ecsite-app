$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$region  = "ap-northeast-1"
$cluster = "ecsite-dev-ecs-cluster"
$service = "ecsite-dev-ecs-service-web"
$db      = "ecsite"

Write-Host "[1/5] Start RDS"
$status = aws rds describe-db-instances --region $region --db-instance-identifier $db --query "DBInstances[0].DBInstanceStatus" --output text
if ($status -eq "stopped") {
  aws rds start-db-instance --region $region --db-instance-identifier $db | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to start RDS" }
}

Write-Host "[2/5] Terraform apply (NAT, ALB, Redis, DNS)"
terraform apply -auto-approve
if ($LASTEXITCODE -ne 0) { throw "terraform apply failed" }

Write-Host "[3/5] Wait for RDS to become available"
aws rds wait db-instance-available --region $region --db-instance-identifier $db
if ($LASTEXITCODE -ne 0) { throw "Waiting for RDS failed" }

Write-Host "[4/5] Start ECS (desired count 1)"
aws ecs update-service --region $region --cluster $cluster --service $service --desired-count 1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to update ECS service" }
aws ecs wait services-stable --region $region --cluster $cluster --services $service
if ($LASTEXITCODE -ne 0) { throw "ECS service did not become stable" }

Write-Host "[5/5] Health check"
curl.exe -s https://kai-page.net/health
Write-Host ""
Write-Host "Done"