param(
  [string]$BaseUrl = "http://supply.comp",
  [string]$AdminUser = "admin",
  [string]$AdminPassword = "change-me-before-production"
)

$ErrorActionPreference = "Stop"
$credential = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${AdminUser}:${AdminPassword}"))
$adminHeaders = @{ Authorization = "Basic $credential"; "Content-Type" = "application/json" }
$jsonHeaders = @{ "Content-Type" = "application/json" }
$stamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$script:Passed = 0

function Call-Api {
  param([string]$Method, [string]$Path, $Body, $Headers = $jsonHeaders)
  $args = @{ Method=$Method; Uri="$BaseUrl$Path"; Headers=$Headers; UseBasicParsing=$true }
  if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Depth 8) }
  $response = Invoke-WebRequest @args
  if ($response.Content) { return $response.Content | ConvertFrom-Json }
}

function Pass([string]$Name) {
  $script:Passed++
  Write-Host "PASS $Name" -ForegroundColor Green
}

$product = Call-Api POST "/api/admin/business/products" @{
  title="交互测试商品-$stamp"; categoryId=3; brandId=1; summary="创建"; spec="标准";
  marketPrice=199; memberPrice=169; stock=20; status=1
} $adminHeaders
Call-Api PUT "/api/admin/business/products/$($product.id)" @{
  title="交互测试商品-$stamp-已编辑"; categoryId=3; brandId=1; summary="编辑"; spec="升级";
  marketPrice=209; memberPrice=179; stock=25; status=1
} $adminHeaders | Out-Null
Call-Api PUT "/api/admin/business/products/$($product.id)/stock" @{ stock=30 } $adminHeaders | Out-Null
Call-Api PUT "/api/admin/business/products/$($product.id)/status" @{ status=2 } $adminHeaders | Out-Null
Call-Api PUT "/api/admin/business/products/$($product.id)/status" @{ status=1 } $adminHeaders | Out-Null
Pass "ADM-BIZ-001 商品新增/编辑/库存/上下架"

$enterpriseName = "自动化企业-$stamp"
Call-Api POST "/api/admin/business/enterprises" @{
  name=$enterpriseName; creditCode="TEST$stamp"; contactName="测试联系人";
  contactPhone="13800138000"; address="济南市"; status=1
} $adminHeaders
$enterprise = (Call-Api GET "/api/admin/business/enterprises" $null $adminHeaders) |
  Where-Object { $_.creditCode -eq "TEST$stamp" } | Select-Object -First 1
Call-Api PUT "/api/admin/business/enterprises/$($enterprise.id)" @{
  name="$enterpriseName-已编辑"; creditCode="TEST$stamp"; contactName="更新联系人";
  contactPhone="13800138001"; address="济南市历下区"; status=1
} $adminHeaders
Pass "ADM-BIZ-002 企业新增/编辑"

$agreementName = "自动化协议-$stamp"
Call-Api POST "/api/admin/business/agreements" @{
  enterpriseId=$enterprise.id; name=$agreementName; amount=10000;
  effectiveDate="2026-07-01"; expiryDate="2027-06-30"; status=0
} $adminHeaders
$agreement = (Call-Api GET "/api/admin/business/agreements" $null $adminHeaders) |
  Where-Object { $_.enterpriseId -eq $enterprise.id } | Select-Object -First 1
$products = Call-Api GET "/api/admin/business/products" $null $adminHeaders
$skuId = ($products | Where-Object { $_.id -eq $product.id } | Select-Object -First 1).skuId
Call-Api POST "/api/admin/agreements/$($agreement.id)/items" @{ skuId=$skuId; agreementPrice=150 } $adminHeaders | Out-Null
$item = (Call-Api GET "/api/admin/agreements/$($agreement.id)/items" $null $adminHeaders) | Select-Object -First 1
Call-Api PUT "/api/admin/agreements/$($agreement.id)/items/$($item.id)" @{ agreementPrice=145 } $adminHeaders | Out-Null
Call-Api DELETE "/api/admin/agreements/$($agreement.id)/items/$($item.id)" $null $adminHeaders
Pass "ADM-BIZ-003 协议商品添加/改价/移除"

$addressName = "收货人-$stamp"
Call-Api POST "/api/client/addresses" @{
  contactName=$addressName; contactPhone="13800138002"; province="山东省"; city="济南市";
  district="历下区"; detail="测试路1号"; isDefault=0
}
$address = (Call-Api GET "/api/client/addresses" $null) |
  Where-Object { $_.contactPhone -eq "13800138002" } | Select-Object -First 1
Call-Api PUT "/api/client/addresses/$($address.id)" @{
  contactName="$addressName-已编辑"; contactPhone="13800138003"; province="山东省"; city="济南市";
  district="历下区"; detail="测试路2号"; isDefault=0
}
Call-Api DELETE "/api/client/addresses/$($address.id)" $null
Pass "CLI-018 地址新增/编辑/删除"

$username = "member$stamp"
Call-Api POST "/api/client/members" @{
  username=$username; realName="自动化成员"; phone="13800138004"; roleCode="BUYER"; status=1
}
$member = (Call-Api GET "/api/client/members" $null) |
  Where-Object { $_.username -eq $username } | Select-Object -First 1
Call-Api PUT "/api/client/members/$($member.id)" @{
  username=$username; realName="自动化成员-已编辑"; phone="13800138005"; roleCode="BUYER"; status=0
}
Call-Api DELETE "/api/client/members/$($member.id)" $null
Pass "CLI-019 企业成员新增/编辑/停用/删除"

$orders = Call-Api GET "/api/client/orders" $null
Call-Api GET "/api/client/orders/$($orders[0].id)" $null | Out-Null
Call-Api GET "/api/client/invoices" $null | Out-Null
Pass "CLI-020 订单详情与发票记录"

Call-Api DELETE "/api/admin/business/agreements/$($agreement.id)" $null $adminHeaders
Call-Api DELETE "/api/admin/business/enterprises/$($enterprise.id)" $null $adminHeaders
Call-Api DELETE "/api/admin/business/products/$($product.id)" $null $adminHeaders
Pass "ADM-BIZ-004 商品/协议/企业删除"

Write-Host "交互测试完成：通过 $script:Passed，失败 0"
