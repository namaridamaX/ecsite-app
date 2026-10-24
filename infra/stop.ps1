$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$region  = "ap-northeast-1"
$cluster = "ecsite-dev-ecs-cluster"
$service = "ecsite-dev-ecs-service-web"
$db      = "ecsite"

Write-Host "[1/3] Stop ECS (desired count 0)"
aws ecs update-service --region $region --cluster $cluster --service $service --desired-count 0 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to update ECS service" }
aws ecs wait services-stable --region $region --cluster $cluster --services $service

Write-Host "[2/3] Terraform destroy (NAT, ALB, Redis, DNS)"
terraform destroy -auto-approve
if ($LASTEXITCODE -ne 0) { throw "terraform destroy failed" }

Write-Host "[3/3] Stop RDS"
$status = aws rds describe-db-instances --region $region --db-instance-identifier $db --query "DBInstances[0].DBInstanceStatus" --output text
if ($status -eq "available") {
  aws rds stop-db-instance --region $region --db-instance-identifier $db | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to stop RDS" }
}
Write-Host "Done. Billing is now close to zero."