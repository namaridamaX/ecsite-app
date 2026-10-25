param(
  [string]$Base = "https://kai-page.net",
  [int]$TimeoutSeconds = 300
)
$ErrorActionPreference = "Stop"

$region  = "ap-northeast-1"
$aclName = "ecsite-dev-waf"
$ruleMetric = "common"
$runId   = Get-Date -Format "yyyyMMddHHmmss"
$big     = "a" * 10000

# Expect: block = 403 expected / allow = anything except 403 expected
$cases = @(
  @{ Name = "normal";         Expect = "allow"; Args = @("$Base/health") },
  @{ Name = "xss";            Expect = "block"; Args = @("$Base/?q=%3Cscript%3Ealert(1)%3C/script%3E") },
  @{ Name = "path-traversal"; Expect = "block"; Args = @("$Base/?file=..%2F..%2Fetc%2Fpasswd") },
  # PowerShell 5.1 drops empty-string args, so remove the header with "User-Agent:" instead of -A ""
  @{ Name = "no-user-agent";  Expect = "block"; Args = @("-H", "User-Agent:", "$Base/health") },
  @{ Name = "oversized-body"; Expect = "block"; Args = @("-X", "POST", "--data", $big, "$Base/api/cart") },
  # Not covered by AWSManagedRulesCommonRuleSet yet
  @{ Name = "sqli";           Expect = "allow"; Args = @("$Base/?id=1%27%20OR%20%271%27=%271") }
)

function Format-Utc($d) { $d.ToString("yyyy-MM-ddTHH:mm:ssZ") }

Write-Host "[1/4] Look up Web ACL"
$aclArn = aws wafv2 list-web-acls --region $region --scope REGIONAL --query "WebACLs[?Name=='$aclName'].ARN | [0]" --output text
if ($LASTEXITCODE -ne 0 -or -not $aclArn -or $aclArn -eq "None") {
  throw "Web ACL '$aclName' not found. Run start.ps1 first."
}

Write-Host "[2/4] Send test requests (run id: $runId)"
$startUtc = (Get-Date).ToUniversalTime().AddMinutes(-1)
$results = foreach ($c in $cases) {
  $code = curl.exe -s -o NUL -w '%{http_code}' -H "X-Waf-Test: $runId-$($c.Name)" $c.Args
  $blocked = $code -eq "403"
  $ok = if ($c.Expect -eq "block") { $blocked } else { -not $blocked }
  [pscustomobject]@{
    Case      = $c.Name
    Expect    = $c.Expect
    Status    = $code
    Result    = if ($ok) { "PASS" } else { "FAIL" }
    WafAction = "-"
    WafRule   = "-"
  }
}
$results | Format-Table Case, Expect, Status, Result -AutoSize

Write-Host "[3/4] Wait for WAF sampled requests (timeout ${TimeoutSeconds}s)"
$expectedHits = @($results | Where-Object { $_.Status -eq "403" }).Count
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  Start-Sleep -Seconds 20
  $window = "StartTime=$(Format-Utc $startUtc),EndTime=$(Format-Utc (Get-Date).ToUniversalTime())"
  $json = aws wafv2 get-sampled-requests --region $region --scope REGIONAL --web-acl-arn $aclArn `
    --rule-metric-name $ruleMetric --time-window $window --max-items 500 --output json
  if ($LASTEXITCODE -ne 0) { throw "get-sampled-requests failed" }

  foreach ($s in ($json | Out-String | ConvertFrom-Json).SampledRequests) {
    $tag = ($s.Request.Headers | Where-Object { $_.Name -eq "x-waf-test" } | Select-Object -First 1).Value
    if (-not $tag -or -not $tag.StartsWith("$runId-")) { continue }
    $r = $results | Where-Object { $_.Case -eq $tag.Substring($runId.Length + 1) }
    if ($r) {
      $r.WafAction = $s.Action
      $r.WafRule   = $s.RuleNameWithinRuleGroup
    }
  }
  $found = @($results | Where-Object { $_.WafRule -ne "-" }).Count
  Write-Host "  matched $found / $expectedHits blocked requests"
} while ($found -lt $expectedHits -and (Get-Date) -lt $deadline)

$results | Format-Table -AutoSize

Write-Host "[4/4] CloudWatch metrics since $(Format-Utc $startUtc) (may lag a few minutes, includes other traffic)"
$endUtc = (Get-Date).ToUniversalTime()
foreach ($m in @(
  @{ Metric = "BlockedRequests"; Rule = "ALL" },
  @{ Metric = "AllowedRequests"; Rule = "ALL" },
  @{ Metric = "BlockedRequests"; Rule = $ruleMetric }
)) {
  $sum = aws cloudwatch get-metric-statistics --region $region --namespace AWS/WAFV2 --metric-name $m.Metric `
    --dimensions Name=WebACL,Value=$aclName Name=Region,Value=$region Name=Rule,Value=$($m.Rule) `
    --start-time (Format-Utc $startUtc) --end-time (Format-Utc $endUtc) --period 60 --statistics Sum `
    --query "sum(Datapoints[].Sum)" --output text
  Write-Host ("  {0,-16} Rule={1,-7} {2}" -f $m.Metric, $m.Rule, $sum)
}

$failed = @($results | Where-Object { $_.Result -eq "FAIL" }).Count
if ($failed -gt 0) {
  Write-Host "$failed case(s) FAILED"
  exit 1
}
Write-Host "All cases passed"
