param(
  [string]$BaseUrl = "http://supply.comp",
  [string]$AdminUser = "admin",
  [string]$AdminPassword = "change-me-before-production",
  [string]$ClientUser = "demo",
  [string]$ClientPassword = "demo-password"
)

$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$credential = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${AdminUser}:${AdminPassword}"))
$adminHeaders = @{ Authorization = "Basic $credential"; "Content-Type" = "application/json" }
$clientSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResponse = Invoke-WebRequest -Method POST -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" `
  -Body (@{ username=$ClientUser; password=$ClientPassword } | ConvertTo-Json) -WebSession $clientSession -UseBasicParsing -Proxy $null
$jsonHeaders = @{ "Content-Type" = "application/json"; "X-Test-Client" = "1" }

function Test-Case {
  param([string]$Name, [scriptblock]$Action)
  try {
    & $Action
    $script:Passed++
    Write-Host "PASS $Name" -ForegroundColor Green
  } catch {
    $script:Failed++
    Write-Host "FAIL $Name :: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Invoke-Json {
  param([string]$Method, [string]$Path, [object]$Body, [hashtable]$Headers = $jsonHeaders)
  $wireHeaders=@{}+$Headers
  $useClientSession=$wireHeaders.ContainsKey("X-Test-Client")
  $wireHeaders.Remove("X-Test-Client")
  $arguments = @{ Method = $Method; Uri = "$BaseUrl$Path"; Headers = $wireHeaders; UseBasicParsing = $true }
  if($useClientSession){$arguments.WebSession=$clientSession}
  if ($null -ne $Body) { $arguments.Body = ($Body | ConvertTo-Json -Depth 8) }
  try {
    $response = Invoke-WebRequest @arguments
    $content = $response.Content
    $status = [int]$response.StatusCode
  } catch {
    if ($null -eq $_.Exception.Response) { throw }
    $status = [int]$_.Exception.Response.StatusCode
    $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
    $content = $reader.ReadToEnd()
    $reader.Dispose()
  }
  $payload = if ($content) { $content | ConvertFrom-Json } else { $null }
  [pscustomobject]@{ Status = $status; Data = $payload }
}

Test-Case "DEP-001 Web入口" {
  $r = Invoke-WebRequest "$BaseUrl/web/" -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
}
Test-Case "DEP-002 管理后台入口" {
  $r = Invoke-WebRequest "$BaseUrl/admin/" -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
}
Test-Case "DEP-003 H5入口" {
  $r = Invoke-WebRequest "$BaseUrl/h5/" -UseBasicParsing
  if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
}
Test-Case "DEP-004 系统健康" {
  $r = Invoke-Json GET "/api/public/status" $null
  if ($r.Status -ne 200 -or $r.Data.status -ne "UP") { throw "系统未就绪" }
}
Test-Case "ADM-016 未认证拒绝" {
  $r = Invoke-Json GET "/api/admin/system/users" $null @{}
  if ($r.Status -ne 401) { throw "期望401，实际$($r.Status)" }
}
Test-Case "AUTH-001 未登录客户端接口被拒绝" {
  $r = Invoke-Json GET "/api/client/profile" $null @{}
  if ($r.Status -ne 401) { throw "期望401，实际$($r.Status)" }
}
Test-Case "ADM-001 用户列表" {
  $r = Invoke-Json GET "/api/admin/system/users" $null $adminHeaders
  if ($r.Status -ne 200 -or $r.Data.Count -lt 3) { throw "用户数据不完整" }
}
Test-Case "ADM-011 权限列表" {
  $r = Invoke-Json GET "/api/admin/system/permissions" $null $adminHeaders
  if ($r.Status -ne 200 -or $r.Data.Count -lt 9) { throw "权限数据不完整" }
}
Test-Case "ADM-002 新增编辑删除用户" {
  $username = "test_$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
  $create = Invoke-Json POST "/api/admin/system/users" @{
    username=$username; password="test-password"; realName="自动化测试用户"; phone="13800138000";
    email="test@example.local"; status=1; roleIds=@(2)
  } $adminHeaders
  if ($create.Status -ne 201) { throw "创建失败 $($create.Status)" }
  $id = $create.Data.id
  $update = Invoke-Json PUT "/api/admin/system/users/$id" @{
    username=$username; password=""; realName="自动化测试用户（已更新）"; phone="13800138000";
    email="test@example.local"; status=0; roleIds=@(3)
  } $adminHeaders
  if ($update.Status -notin @(200,204)) { throw "更新失败 $($update.Status)" }
  $delete = Invoke-Json DELETE "/api/admin/system/users/$id" $null $adminHeaders
  if ($delete.Status -notin @(200,204)) { throw "删除失败 $($delete.Status)" }
}
Test-Case "ADM-007 保护超级管理员" {
  $r = Invoke-Json DELETE "/api/admin/system/users/1" $null $adminHeaders
  if ($r.Status -ne 400) { throw "期望400，实际$($r.Status)" }
}
Test-Case "ADM-013 配置查询" {
  $r = Invoke-Json GET "/api/admin/system/configs" $null $adminHeaders
  if ($r.Status -ne 200 -or $r.Data.Count -lt 5) { throw "配置数据不完整" }
}
Test-Case "ADM-012 操作日志" {
  $r = Invoke-Json GET "/api/admin/system/logs" $null $adminHeaders
  if ($r.Status -ne 200 -or $r.Data.Count -lt 1) { throw "操作日志为空" }
}
Test-Case "SEC-001 游客不泄露协议价" {
  $r = Invoke-Json GET "/api/public/catalog/products?enterpriseId=1" $null @{}
  $agreementProducts = @($r.Data | Where-Object { $null -ne $_.agreementPrice })
  if ($r.Status -ne 200 -or $agreementProducts.Count -ne 0) { throw "游客接口泄露协议价" }
}
Test-Case "CLI-001 登录后返回协议商品" {
  $r = Invoke-Json GET "/api/public/catalog/products" $null
  $agreementProducts = @($r.Data | Where-Object { $null -ne $_.agreementPrice })
  if ($r.Status -ne 200 -or $agreementProducts.Count -lt 1) { throw "协议商品不完整" }
}
Test-Case "CLI-016 企业资料" {
  $r = Invoke-Json GET "/api/client/profile" $null
  if ($r.Status -ne 200 -or !$r.Data.enterpriseName -or !$r.Data.agreementName) { throw "企业资料不完整" }
}
Test-Case "CLI-017 地址列表" {
  $r = Invoke-Json GET "/api/client/addresses" $null
  if ($r.Status -ne 200 -or $r.Data.Count -lt 1 -or $r.Data[0].isDefault -ne 1) { throw "默认地址异常" }
}
Test-Case "CLI-003/004 购物车合并" {
  $before = Invoke-Json GET "/api/client/cart" $null
  $add = Invoke-Json POST "/api/client/cart" @{skuId=1;quantity=1}
  $addAgain = Invoke-Json POST "/api/client/cart" @{skuId=1;quantity=1}
  $after = Invoke-Json GET "/api/client/cart" $null
  if ($add.Status -ne 201 -or $addAgain.Status -ne 201) { throw "加入失败" }
  $lines = @($after.Data | Where-Object skuId -eq 1)
  if ($lines.Count -ne 1) { throw "相同SKU未合并" }
}
Test-Case "CLI-006 数量为零被拒绝" {
  $cart = Invoke-Json GET "/api/client/cart" $null
  $r = Invoke-Json PUT "/api/client/cart/$($cart.Data[0].id)" @{quantity=0;selected=1}
  if ($r.Status -ne 400) { throw "期望400，实际$($r.Status)" }
}
Test-Case "CLI-007 超库存被拒绝" {
  $cart = Invoke-Json GET "/api/client/cart" $null
  $r = Invoke-Json PUT "/api/client/cart/$($cart.Data[0].id)" @{quantity=9999;selected=1}
  if ($r.Status -ne 400) { throw "期望400，实际$($r.Status)" }
}
Test-Case "CLI-011/012 下单与幂等" {
  $cart = Invoke-Json GET "/api/client/cart" $null
  if ($cart.Data.Count -eq 0) { [void](Invoke-Json POST "/api/client/cart" @{skuId=1;quantity=1}) }
  $key = "smoke-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())"
  $first = Invoke-Json POST "/api/client/orders" @{idempotencyKey=$key}
  $second = Invoke-Json POST "/api/client/orders" @{idempotencyKey=$key}
  if ($first.Status -ne 201 -or $second.Status -ne 201 -or $first.Data.id -ne $second.Data.id) { throw "幂等下单失败" }
}
Test-Case "CLI-010 空购物车结算被拒绝" {
  $r = Invoke-Json POST "/api/client/orders" @{idempotencyKey="empty-$([guid]::NewGuid())"}
  if ($r.Status -ne 400) { throw "期望400，实际$($r.Status)" }
}
Test-Case "CLI-014 订单列表" {
  $r = Invoke-Json GET "/api/client/orders" $null
  if ($r.Status -ne 200 -or $r.Data.Count -lt 3) { throw "订单列表不完整" }
}

Write-Host "`n测试完成：通过 $script:Passed，失败 $script:Failed"
if ($script:Failed -gt 0) { exit 1 }
