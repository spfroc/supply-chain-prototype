param(
  [string]$BaseUrl = "http://supply.comp",
  [string]$AdminUser = "admin",
  [string]$AdminPassword = "change-me-before-production"
)

$ErrorActionPreference = "Stop"
$script:Passed = 0
$script:Failed = 0
$stamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$credential = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${AdminUser}:${AdminPassword}"))
$adminHeaders = @{ Authorization = "Basic $credential"; "Content-Type" = "application/json" }
$clientSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResponse = Invoke-WebRequest -Method POST -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" `
  -Body (@{ enterpriseId=1; username="demo"; password="demo-password" } | ConvertTo-Json) -WebSession $clientSession -UseBasicParsing
$jsonHeaders = @{ "Content-Type" = "application/json"; "X-Test-Client" = "1" }

function Invoke-Api {
  param([string]$Method, [string]$Path, [object]$Body, [hashtable]$Headers = $jsonHeaders)
  $wireHeaders=@{}+$Headers
  $useClientSession=$wireHeaders.ContainsKey("X-Test-Client")
  $wireHeaders.Remove("X-Test-Client")
  $arguments = @{ Method=$Method; Uri="$BaseUrl$Path"; Headers=$wireHeaders; UseBasicParsing=$true }
  if($useClientSession){$arguments.WebSession=$clientSession}
  if ($null -ne $Body) { $arguments.Body = ($Body | ConvertTo-Json -Depth 10) }
  try {
    $response = Invoke-WebRequest @arguments
    $status = [int]$response.StatusCode
    $content = $response.Content
  } catch {
    if ($null -eq $_.Exception.Response) { throw }
    $status = [int]$_.Exception.Response.StatusCode
    $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
    $content = $reader.ReadToEnd()
    $reader.Dispose()
  }
  $data = if ($content) { $content | ConvertFrom-Json } else { $null }
  [pscustomobject]@{ Status=$status; Data=$data }
}

function Case {
  param([string]$Id, [string]$Name, [scriptblock]$Action)
  try {
    & $Action
    $script:Passed++
    Write-Host "PASS $Id $Name" -ForegroundColor Green
  } catch {
    $script:Failed++
    Write-Host "FAIL $Id $Name :: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Expect-Status($Response, [int[]]$Expected) {
  if ($Response.Status -notin $Expected) {
    throw "期望 HTTP $($Expected -join '/')，实际 $($Response.Status)"
  }
}

# ---------- 权限、角色、后台用户 ----------
$permissions = (Invoke-Api GET "/api/admin/system/permissions" $null $adminHeaders).Data
$permissionIds = @($permissions | Select-Object -First 2 | ForEach-Object { [long]$_.id })
$roleCode = "QA_ROLE_$stamp"
$roleId = $null
$username = "qa_user_$stamp"
$userId = $null

Case "SYS-PERM-001" "权限清单字段完整且编码唯一" {
  if ($permissions.Count -lt 9) { throw "权限数量不足" }
  if (@($permissions.permissionCode | Sort-Object -Unique).Count -ne $permissions.Count) { throw "权限编码重复" }
  if (@($permissions | Where-Object { !$_.module -or !$_.name }).Count -gt 0) { throw "权限名称或模块为空" }
}
Case "SYS-ROLE-001" "新增角色并配置权限" {
  $r = Invoke-Api POST "/api/admin/system/roles" @{
    roleCode=$roleCode; name="自动化测试角色"; description="详细回归测试"; status=1; permissionIds=$permissionIds
  } $adminHeaders
  Expect-Status $r @(201)
  $script:roleId = [long]$r.Data.id
  $saved = (Invoke-Api GET "/api/admin/system/roles" $null $adminHeaders).Data |
    Where-Object id -eq $script:roleId | Select-Object -First 1
  if (!$saved -or "$($saved.permissionIds)" -notmatch "$($permissionIds[0])") { throw "角色权限未保存" }
}
Case "SYS-ROLE-002" "重复角色编码被拒绝" {
  $r = Invoke-Api POST "/api/admin/system/roles" @{
    roleCode=$roleCode; name="重复角色"; description=""; status=1; permissionIds=$permissionIds
  } $adminHeaders
  Expect-Status $r @(409)
}
Case "SYS-ROLE-003" "角色名称与权限必填校验" {
  $r = Invoke-Api POST "/api/admin/system/roles" @{
    roleCode=""; name=""; description=""; status=1; permissionIds=@()
  } $adminHeaders
  Expect-Status $r @(400)
}
Case "SYS-USER-001" "新增后台用户并分配指定角色" {
  $r = Invoke-Api POST "/api/admin/system/users" @{
    username=$username; password="Qa-password-2026"; realName="自动化测试用户"; phone="13800138101";
    email="qa-$stamp@example.local"; status=1; roleIds=@($script:roleId)
  } $adminHeaders
  Expect-Status $r @(201)
  $script:userId = [long]$r.Data.id
  $saved = (Invoke-Api GET "/api/admin/system/users" $null $adminHeaders).Data |
    Where-Object id -eq $script:userId | Select-Object -First 1
  if (!$saved -or "$($saved.roleIds)" -notmatch "$($script:roleId)" -or $saved.status -ne 1) {
    throw "用户角色或启用状态未保存"
  }
}
Case "AUTH-ISOLATION-001" "后台用户只能登录管理后台，不能登录 Web/H5" {
  $qaCredential = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${username}:Qa-password-2026"))
  $qaHeaders = @{ Authorization="Basic $qaCredential"; "Content-Type"="application/json" }
  $me = Invoke-Api GET "/api/admin/system/me" $null $qaHeaders
  Expect-Status $me @(200)
  if ($me.Data.username -ne $username) { throw "后台登录身份不正确" }
  Expect-Status (Invoke-Api POST "/api/auth/login" @{username=$username;password="Qa-password-2026"} @{}) @(400)
}
Case "AUTH-ISOLATION-002" "企业成员账号不能登录管理后台" {
  $enterpriseCredential = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("demo:demo-password"))
  Expect-Status (Invoke-Api GET "/api/admin/system/me" $null @{Authorization="Basic $enterpriseCredential"}) @(401)
}
Case "SYS-USER-002" "重复后台账号被拒绝" {
  $r = Invoke-Api POST "/api/admin/system/users" @{
    username=$username; password="Qa-password-2026"; realName="重复账号"; phone="";
    email=""; status=1; roleIds=@($script:roleId)
  } $adminHeaders
  Expect-Status $r @(409)
}
Case "SYS-USER-003" "后台用户必填字段与角色必选校验" {
  $r = Invoke-Api POST "/api/admin/system/users" @{
    username=""; password="x"; realName=""; phone=""; email=""; status=1; roleIds=@()
  } $adminHeaders
  Expect-Status $r @(400)
}
Case "SYS-ROLE-004" "仍有关联用户的角色禁止删除" {
  $r = Invoke-Api DELETE "/api/admin/system/roles/$($script:roleId)" $null $adminHeaders
  Expect-Status $r @(400)
}
Case "SYS-USER-004" "编辑用户、停用并切换角色" {
  $r = Invoke-Api PUT "/api/admin/system/users/$($script:userId)" @{
    username=$username; password=""; realName="自动化用户（已编辑）"; phone="13800138102";
    email="qa-updated-$stamp@example.local"; status=0; roleIds=@(3)
  } $adminHeaders
  Expect-Status $r @(200,204)
  $saved = (Invoke-Api GET "/api/admin/system/users" $null $adminHeaders).Data |
    Where-Object id -eq $script:userId | Select-Object -First 1
  if ($saved.status -ne 0 -or "$($saved.roleIds)" -ne "3") { throw "用户状态或角色切换失败" }
}
Case "SYS-USER-005" "不存在的后台用户编辑返回业务错误" {
  $r = Invoke-Api PUT "/api/admin/system/users/99999999" @{
    username="missing"; password=""; realName="不存在"; phone=""; email=""; status=0; roleIds=@(3)
  } $adminHeaders
  Expect-Status $r @(400)
}
Case "SYS-USER-006" "删除后台用户后列表不可见" {
  Expect-Status (Invoke-Api DELETE "/api/admin/system/users/$($script:userId)" $null $adminHeaders) @(200,204)
  $saved = (Invoke-Api GET "/api/admin/system/users" $null $adminHeaders).Data |
    Where-Object id -eq $script:userId
  if ($saved) { throw "软删除用户仍出现在列表中" }
}
Case "SYS-ROLE-005" "解除用户关联后角色可以删除" {
  Expect-Status (Invoke-Api DELETE "/api/admin/system/roles/$($script:roleId)" $null $adminHeaders) @(200,204)
  $saved = (Invoke-Api GET "/api/admin/system/roles" $null $adminHeaders).Data |
    Where-Object id -eq $script:roleId
  if ($saved) { throw "已删除角色仍出现在列表中" }
}
Case "SYS-SAFE-001" "超级管理员账号和角色受保护" {
  Expect-Status (Invoke-Api DELETE "/api/admin/system/users/1" $null $adminHeaders) @(400)
  Expect-Status (Invoke-Api DELETE "/api/admin/system/roles/1" $null $adminHeaders) @(400)
}
Case "SYS-LOG-001" "用户和角色变更写入操作日志" {
  $logs = (Invoke-Api GET "/api/admin/system/logs" $null $adminHeaders).Data
  $related = @($logs | Where-Object { $_.targetId -in @("$($script:userId)","$($script:roleId)") })
  if ($related.Count -lt 4) { throw "预期至少4条增删改日志，实际 $($related.Count)" }
}
Case "SYS-CONFIG-001" "基本配置修改后同步到 Web/H5 公开配置并可恢复" {
  $configs = (Invoke-Api GET "/api/admin/system/configs" $null $adminHeaders).Data
  $config = $configs | Select-Object -First 1
  $original = "$($config.configValue)"
  $testValue = "$original-QA"
  Expect-Status (Invoke-Api PUT "/api/admin/system/configs/$($config.id)" @{
    configValue=$testValue; description=$config.description; isPublic=$config.isPublic
  } $adminHeaders) @(200,204)
  $saved = (Invoke-Api GET "/api/admin/system/configs" $null $adminHeaders).Data |
    Where-Object id -eq $config.id | Select-Object -First 1
  if ($saved.configValue -ne $testValue) { throw "配置修改后未读到新值" }
  if ([int]$config.isPublic -eq 1) {
    $publicConfig = (Invoke-Api GET "/api/public/config" $null @{}).Data
    if ($publicConfig.($config.configKey) -ne $testValue) {
      throw "公开配置接口未同步后台修改值"
    }
  }
  Expect-Status (Invoke-Api PUT "/api/admin/system/configs/$($config.id)" @{
    configValue=$original; description=$config.description; isPublic=$config.isPublic
  } $adminHeaders) @(200,204)
}

# ---------- 门户内容 ----------
Case "PORTAL-CONTENT-001" "导航、轮播、平台、方案和内容支持增删改并同步客户端" {
  foreach ($type in @("navigation","banner","platform","solution","content")) {
    $created = Invoke-Api POST "/api/admin/content/$type" @{
      title="QA-$type-$stamp"; subtitle="创建测试"; imageUrl=""; linkUrl="/web/"; sortOrder=99; status=1
    } $adminHeaders
    Expect-Status $created @(201)
    $id = [long]$created.Data.id
    Expect-Status (Invoke-Api PUT "/api/admin/content/$type/$id" @{
      title="QA-$type-$stamp-UPDATED"; subtitle="编辑测试"; imageUrl=""; linkUrl="/h5/"; sortOrder=98; status=1
    } $adminHeaders) @(200,204)
    $public = (Invoke-Api GET "/api/public/portal" $null @{}).Data
    $group = if($type -eq "navigation"){$public.navigation}elseif($type -eq "banner"){$public.banner}elseif($type -eq "platform"){$public.platform}elseif($type -eq "solution"){$public.solution}else{$public.content}
    if (!($group | Where-Object id -eq $id)) { throw "$type 未同步到客户端门户接口" }
    Expect-Status (Invoke-Api DELETE "/api/admin/content/$type/$id" $null $adminHeaders) @(200,204)
  }
}
Case "PORTAL-BRAND-001" "品牌支持新增、编辑和删除" {
  $created = Invoke-Api POST "/api/admin/content/brands/list" @{
    name="QA-BRAND-$stamp"; logo=""; description="测试品牌"; sortOrder=99; status=1
  } $adminHeaders
  Expect-Status $created @(201)
  $id = [long]$created.Data.id
  Expect-Status (Invoke-Api PUT "/api/admin/content/brands/list/$id" @{
    name="QA-BRAND-$stamp-UPDATED"; logo=""; description="已更新"; sortOrder=98; status=1
  } $adminHeaders) @(200,204)
  $saved = (Invoke-Api GET "/api/admin/content/brands/list" $null $adminHeaders).Data | Where-Object id -eq $id
  if (!$saved -or $saved.name -notmatch "UPDATED") { throw "品牌编辑未保存" }
  Expect-Status (Invoke-Api DELETE "/api/admin/content/brands/list/$id" $null $adminHeaders) @(200,204)
}
Case "PORTAL-PLATFORM-PRODUCT-001" "平台与商品多对多关联并保存平台价格和链接" {
  $platformCreated=Invoke-Api POST "/api/admin/content/platform" @{
    title="QA-PLATFORM-$stamp";subtitle="平台商品测试";imageUrl="";linkUrl="";sortOrder=99;status=1
  } $adminHeaders
  Expect-Status $platformCreated @(201)
  $platformId=[long]$platformCreated.Data.id
  $sku=(Invoke-Api GET "/api/public/catalog/products?enterpriseId=1" $null @{}).Data|Select-Object -First 1
  $relation=Invoke-Api POST "/api/admin/content/platform/$platformId/products" @{
    skuId=$sku.skuId;platformPrice=123.45;productUrl="https://example.com/item/$stamp";listingStatus=1
  } $adminHeaders
  Expect-Status $relation @(201)
  $relationId=[long]$relation.Data.id
  $public=(Invoke-Api GET "/api/public/portal/platforms/$platformId/products" $null @{}).Data
  if($public.products.Count -ne 1 -or [decimal]$public.products[0].platformPrice -ne 123.45 -or $public.products[0].productUrl -notmatch "$stamp"){
    throw "平台商品关联或平台字段未同步"
  }
  Expect-Status (Invoke-Api PUT "/api/admin/content/platform/$platformId/products/$relationId" @{
    skuId=$sku.skuId;platformPrice=120.00;productUrl="https://example.com/item/updated";listingStatus=0
  } $adminHeaders) @(200,204)
  $public=(Invoke-Api GET "/api/public/portal/platforms/$platformId/products" $null @{}).Data
  if($public.products.Count -ne 0){throw "平台商品下架后仍在客户端展示"}
  Expect-Status (Invoke-Api DELETE "/api/admin/content/platform/$platformId/products/$relationId" $null $adminHeaders) @(200,204)
  Expect-Status (Invoke-Api DELETE "/api/admin/content/platform/$platformId" $null $adminHeaders) @(200,204)
}

# ---------- 商品分类 ----------
$categoryLevel1=$null
$categoryLevel2=$null
$categoryLevel3=$null
Case "BIZ-CAT-001" "新增三级分类并保持正确父子关系" {
  Expect-Status (Invoke-Api POST "/api/admin/business/categories" @{name="QA-L1-$stamp";parentId=$null;level=1;sortOrder=90;icon="测";status=1} $adminHeaders) @(201)
  $script:categoryLevel1=[long]((Invoke-Api GET "/api/admin/business/categories" $null $adminHeaders).Data|Where-Object name -eq "QA-L1-$stamp"|Select-Object -First 1).id
  Expect-Status (Invoke-Api POST "/api/admin/business/categories" @{name="QA-L2-$stamp";parentId=$script:categoryLevel1;level=2;sortOrder=91;icon="";status=1} $adminHeaders) @(201)
  $script:categoryLevel2=[long]((Invoke-Api GET "/api/admin/business/categories" $null $adminHeaders).Data|Where-Object name -eq "QA-L2-$stamp"|Select-Object -First 1).id
  Expect-Status (Invoke-Api POST "/api/admin/business/categories" @{name="QA-L3-$stamp";parentId=$script:categoryLevel2;level=3;sortOrder=92;icon="";status=1} $adminHeaders) @(201)
  $script:categoryLevel3=[long]((Invoke-Api GET "/api/admin/business/categories" $null $adminHeaders).Data|Where-Object name -eq "QA-L3-$stamp"|Select-Object -First 1).id
  if(!$script:categoryLevel3){throw "三级分类未保存"}
}
Case "BIZ-CAT-002" "分类父级级别不匹配时拒绝保存" {
  Expect-Status (Invoke-Api POST "/api/admin/business/categories" @{name="INVALID-$stamp";parentId=$script:categoryLevel1;level=3;sortOrder=0;icon="";status=1} $adminHeaders) @(400)
}
Case "BIZ-CAT-003" "存在子分类时禁止删除父分类" {
  Expect-Status (Invoke-Api DELETE "/api/admin/business/categories/$($script:categoryLevel1)" $null $adminHeaders) @(400)
}

# ---------- 商品 ----------
$productTitle = "QA-PRODUCT-$stamp"
$productId = $null
$skuId = $null
$validProduct = @{
  title=$productTitle; categoryId=$script:categoryLevel3; brandId=1; summary="QA-SUMMARY"; spec="QA-SPEC";
  mainImage="https://example.com/main.jpg"; gallery="https://example.com/1.jpg`nhttps://example.com/2.jpg";
  attributes="颜色：黑色；保修：三年"; detailHtml="<p>QA 商品详情</p>";
  marketPrice=999.00; memberPrice=899.00; stock=20; status=1
}
Case "BIZ-PROD-SEED-001" "Web/H5 商品目录至少包含十款在售商品" {
  $catalog = (Invoke-Api GET "/api/public/catalog/products?enterpriseId=1" $null @{}).Data
  if (@($catalog).Count -lt 10) { throw "公开商品不足10款，实际 $(@($catalog).Count) 款" }
}
Case "BIZ-PROD-001" "新增商品并保存标题、价格、规格和库存" {
  $r = Invoke-Api POST "/api/admin/business/products" $validProduct $adminHeaders
  Expect-Status $r @(201)
  $script:productId = [long]$r.Data.id
  $saved = (Invoke-Api GET "/api/admin/business/products" $null $adminHeaders).Data |
    Where-Object id -eq $script:productId | Select-Object -First 1
  $script:skuId = [long]$saved.skuId
  if (!$saved -or $saved.title -ne $productTitle -or [decimal]$saved.memberPrice -ne 899 -or $saved.stock -ne 20 -or $saved.mainImage -ne "https://example.com/main.jpg" -or $saved.detailHtml -notmatch "QA") {
    throw "商品字段保存不完整"
  }
}
Case "BIZ-PROD-002" "商品标题必填校验" {
  $body = $validProduct.Clone(); $body.title = ""
  Expect-Status (Invoke-Api POST "/api/admin/business/products" $body $adminHeaders) @(400)
}
Case "BIZ-PROD-003" "商品价格不能为负数" {
  $body = $validProduct.Clone(); $body.title = "NEGATIVE-$stamp"; $body.memberPrice = -1
  Expect-Status (Invoke-Api POST "/api/admin/business/products" $body $adminHeaders) @(400)
}
Case "BIZ-PROD-004" "无效分类或品牌被数据库约束拒绝" {
  $body = $validProduct.Clone(); $body.title = "INVALID-CATEGORY-$stamp"; $body.categoryId = 999999
  Expect-Status (Invoke-Api POST "/api/admin/business/products" $body $adminHeaders) @(409)
}
Case "BIZ-PROD-005" "编辑商品后字段立即更新" {
  $body = $validProduct.Clone()
  $body.title = "$productTitle-UPDATED"; $body.summary = "UPDATED-SUMMARY"; $body.memberPrice = 859; $body.stock = 30
  Expect-Status (Invoke-Api PUT "/api/admin/business/products/$($script:productId)" $body $adminHeaders) @(200,204)
  $saved = (Invoke-Api GET "/api/admin/business/products" $null $adminHeaders).Data |
    Where-Object id -eq $script:productId | Select-Object -First 1
  if ($saved.title -ne "$productTitle-UPDATED" -or [decimal]$saved.memberPrice -ne 859 -or $saved.stock -ne 30) {
    throw "商品编辑结果不正确"
  }
}
Case "BIZ-PROD-006" "库存不能小于订单占用库存" {
  $seed = (Invoke-Api GET "/api/admin/business/products" $null $adminHeaders).Data |
    Where-Object { $_.reservedStock -gt 0 } | Select-Object -First 1
  if (!$seed) { throw "缺少带占用库存的基础商品" }
  Expect-Status (Invoke-Api PUT "/api/admin/business/products/$($seed.id)/stock" @{
    stock=([int]$seed.reservedStock - 1)
  } $adminHeaders) @(400)
}
Case "BIZ-PROD-007" "商品下架、重新上架状态生效" {
  Expect-Status (Invoke-Api PUT "/api/admin/business/products/$($script:productId)/status" @{status=2} $adminHeaders) @(200,204)
  $down = (Invoke-Api GET "/api/admin/business/products" $null $adminHeaders).Data |
    Where-Object id -eq $script:productId | Select-Object -First 1
  if ($down.status -ne 2) { throw "商品未下架" }
  $cart = Invoke-Api POST "/api/client/cart" @{skuId=$script:skuId;quantity=1}
  Expect-Status $cart @(400)
  Expect-Status (Invoke-Api PUT "/api/admin/business/products/$($script:productId)/status" @{status=1} $adminHeaders) @(200,204)
}

# ---------- 企业与协议 ----------
$creditCode = "QA$stamp"
$enterpriseId = $null
$agreement1 = $null
$agreement2 = $null
Case "BIZ-ENT-001" "新增企业并保存联系人信息" {
  Expect-Status (Invoke-Api POST "/api/admin/business/enterprises" @{
    name="QA-ENTERPRISE-$stamp"; creditCode=$creditCode; contactName="QA-CONTACT";
    contactPhone="13800138201"; address="JINAN"; status=1
  } $adminHeaders) @(201)
  $saved = (Invoke-Api GET "/api/admin/business/enterprises" $null $adminHeaders).Data |
    Where-Object creditCode -eq $creditCode | Select-Object -First 1
  if (!$saved -or $saved.contactPhone -ne "13800138201") { throw "企业字段未保存" }
  $script:enterpriseId = [long]$saved.id
}
Case "BIZ-ENT-002" "企业统一信用代码不可重复" {
  Expect-Status (Invoke-Api POST "/api/admin/business/enterprises" @{
    name="重复企业"; creditCode=$creditCode; contactName="联系人";
    contactPhone="13800138202"; address=""; status=1
  } $adminHeaders) @(409)
}
Case "BIZ-ENT-003" "企业名称、信用代码和联系人必填" {
  Expect-Status (Invoke-Api POST "/api/admin/business/enterprises" @{
    name=""; creditCode=""; contactName=""; contactPhone=""; address=""; status=1
  } $adminHeaders) @(400)
}
Case "BIZ-ENT-004" "后台为指定企业添加、编辑和删除成员" {
  $memberUsername = "admin_member_$stamp"
  $initialPassword = "Initial-$stamp!"
  $changedPassword = "Changed-$stamp!"
  Expect-Status (Invoke-Api POST "/api/admin/business/enterprises/$($script:enterpriseId)/members" @{
    username=$memberUsername; password=$initialPassword; realName="ADMIN-MEMBER"; phone="13800138211"; roleCode="BUYER"; status=1
  } $adminHeaders) @(201)
  $saved = (Invoke-Api GET "/api/admin/business/enterprises/$($script:enterpriseId)/members" $null $adminHeaders).Data |
    Where-Object username -eq $memberUsername | Select-Object -First 1
  if (!$saved) { throw "后台新增企业成员后未查询到" }
  Expect-Status (Invoke-Api POST "/api/auth/login" @{
    enterpriseId=$script:enterpriseId; username=$memberUsername; password=$initialPassword
  }) @(200)
  Expect-Status (Invoke-Api PUT "/api/admin/business/enterprises/$($script:enterpriseId)/members/$($saved.id)" @{
    username=$memberUsername; password=$changedPassword; realName="ADMIN-MEMBER-UPDATED"; phone="13800138212"; roleCode="BUYER"; status=1
  } $adminHeaders) @(200,204)
  $updated = (Invoke-Api GET "/api/admin/business/enterprises/$($script:enterpriseId)/members" $null $adminHeaders).Data |
    Where-Object id -eq $saved.id | Select-Object -First 1
  if ($updated.status -ne 1 -or $updated.phone -ne "13800138212") { throw "后台企业成员编辑未生效" }
  Expect-Status (Invoke-Api POST "/api/auth/login" @{
    enterpriseId=$script:enterpriseId; username=$memberUsername; password=$initialPassword
  }) @(400)
  Expect-Status (Invoke-Api POST "/api/auth/login" @{
    enterpriseId=$script:enterpriseId; username=$memberUsername; password=$changedPassword
  }) @(200)
  Expect-Status (Invoke-Api DELETE "/api/admin/business/enterprises/$($script:enterpriseId)/members/$($saved.id)" $null $adminHeaders) @(200,204)
  $null = Invoke-WebRequest -Method POST -Uri "$BaseUrl/api/auth/login" -ContentType "application/json" `
    -Body (@{ enterpriseId=1; username="demo"; password="demo-password" } | ConvertTo-Json) `
    -WebSession $clientSession -UseBasicParsing
}
Case "BIZ-ENT-005" "企业至少保留一名管理员" {
  $memberUsername = "only_admin_$stamp"
  Expect-Status (Invoke-Api POST "/api/admin/business/enterprises/$($script:enterpriseId)/members" @{
    username=$memberUsername; password="Initial-$stamp!"; realName="ONLY-ADMIN"; phone="13800138213"; roleCode="ENTERPRISE_ADMIN"; status=1
  } $adminHeaders) @(201)
  $saved = (Invoke-Api GET "/api/admin/business/enterprises/$($script:enterpriseId)/members" $null $adminHeaders).Data |
    Where-Object username -eq $memberUsername | Select-Object -First 1
  Expect-Status (Invoke-Api DELETE "/api/admin/business/enterprises/$($script:enterpriseId)/members/$($saved.id)" $null $adminHeaders) @(400)
  Expect-Status (Invoke-Api PUT "/api/admin/business/enterprises/$($script:enterpriseId)/members/$($saved.id)" @{
    username=$memberUsername; password=""; realName="ONLY-ADMIN"; phone="13800138213"; roleCode="BUYER"; status=1
  } $adminHeaders) @(200,204)
  Expect-Status (Invoke-Api DELETE "/api/admin/business/enterprises/$($script:enterpriseId)/members/$($saved.id)" $null $adminHeaders) @(200,204)
}
Case "BIZ-ENT-006" "新增企业成员必须设置合规的初始密码" {
  Expect-Status (Invoke-Api POST "/api/admin/business/enterprises/$($script:enterpriseId)/members" @{
    username="short_password_$stamp"; password="1234567"; realName="SHORT-PASSWORD"; phone="13800138214"; roleCode="BUYER"; status=1
  } $adminHeaders) @(400)
}
Case "BIZ-AGR-001" "新增生效协议" {
  Expect-Status (Invoke-Api POST "/api/admin/business/agreements" @{
    enterpriseId=$script:enterpriseId; name="QA-AGREEMENT-ONE-$stamp"; amount=10000;
    effectiveDate="2026-01-01"; expiryDate="2027-12-31"; status=1
  } $adminHeaders) @(201)
  $saved = (Invoke-Api GET "/api/admin/business/agreements" $null $adminHeaders).Data |
    Where-Object { $_.enterpriseId -eq $script:enterpriseId -and $_.name -eq "QA-AGREEMENT-ONE-$stamp" } | Select-Object -First 1
  if (!$saved -or $saved.status -ne 1) { throw "协议未生效" }
  $script:agreement1 = [long]$saved.id
}
Case "BIZ-AGR-002" "同一企业同时只能有一个生效协议" {
  Expect-Status (Invoke-Api POST "/api/admin/business/agreements" @{
    enterpriseId=$script:enterpriseId; name="QA-AGREEMENT-TWO-$stamp"; amount=20000;
    effectiveDate="2026-02-01"; expiryDate="2028-01-31"; status=1
  } $adminHeaders) @(201)
  $all = (Invoke-Api GET "/api/admin/business/agreements" $null $adminHeaders).Data |
    Where-Object enterpriseId -eq $script:enterpriseId
  $active = @($all | Where-Object status -eq 1)
  if ($active.Count -ne 1) { throw "生效协议数量为 $($active.Count)" }
  $script:agreement2 = [long]$active[0].id
  $old = $all | Where-Object id -eq $script:agreement1 | Select-Object -First 1
  if ($old.status -ne 2) { throw "旧协议未自动失效" }
}
Case "BIZ-AGR-003" "协议商品添加、重复添加改价、移除" {
  Expect-Status (Invoke-Api POST "/api/admin/agreements/$($script:agreement2)/items" @{
    skuId=$script:skuId; agreementPrice=800
  } $adminHeaders) @(201)
  Expect-Status (Invoke-Api POST "/api/admin/agreements/$($script:agreement2)/items" @{
    skuId=$script:skuId; agreementPrice=780
  } $adminHeaders) @(201)
  $items = (Invoke-Api GET "/api/admin/agreements/$($script:agreement2)/items" $null $adminHeaders).Data
  $item = $items | Where-Object skuId -eq $script:skuId | Select-Object -First 1
  if (@($items | Where-Object skuId -eq $script:skuId).Count -ne 1 -or [decimal]$item.agreementPrice -ne 780) {
    throw "重复添加未执行改价合并"
  }
  Expect-Status (Invoke-Api DELETE "/api/admin/agreements/$($script:agreement2)/items/$($item.id)" $null $adminHeaders) @(200,204)
}
Case "BIZ-AGR-004" "无效签约企业被约束拒绝" {
  Expect-Status (Invoke-Api POST "/api/admin/business/agreements" @{
    enterpriseId=99999999; name="无效企业协议"; amount=1;
    effectiveDate="2026-01-01"; expiryDate="2026-12-31"; status=0
  } $adminHeaders) @(409)
}

# ---------- 客户端资料及只读数据 ----------
$addressPhone = "13800138301"
$memberName = "qa_member_$stamp"
Case "CLI-ADDR-001" "地址新增、编辑、删除后列表同步" {
  Expect-Status (Invoke-Api POST "/api/client/addresses" @{
    contactName="QA-CONSIGNEE"; contactPhone=$addressPhone; province="SHANDONG"; city="JINAN";
    district="LIXIA"; detail="QA-ROAD-1"; isDefault=0
  }) @(201)
  $saved = (Invoke-Api GET "/api/client/addresses" $null).Data |
    Where-Object contactPhone -eq $addressPhone | Select-Object -First 1
  if (!$saved) { throw "新增地址未出现在列表中" }
  Expect-Status (Invoke-Api PUT "/api/client/addresses/$($saved.id)" @{
    contactName="QA-CONSIGNEE-UPDATED"; contactPhone=$addressPhone; province="SHANDONG"; city="JINAN";
    district="LIXIA"; detail="QA-ROAD-2"; isDefault=0
  }) @(200,204)
  $updated = (Invoke-Api GET "/api/client/addresses" $null).Data |
    Where-Object id -eq $saved.id | Select-Object -First 1
  if ($updated.detail -ne "QA-ROAD-2") { throw "地址编辑未生效" }
  Expect-Status (Invoke-Api DELETE "/api/client/addresses/$($saved.id)" $null) @(200,204)
}
Case "CLI-ADDR-002" "地址必填字段校验" {
  Expect-Status (Invoke-Api POST "/api/client/addresses" @{
    contactName=""; contactPhone=""; province=""; city=""; district=""; detail=""; isDefault=0
  }) @(400)
}
Case "CLI-MEMBER-001" "企业成员新增、配置角色、停用和删除" {
  Expect-Status (Invoke-Api POST "/api/client/members" @{
    username=$memberName; realName="QA成员"; phone="13800138302"; roleCode="BUYER"; status=1
  }) @(201)
  $saved = (Invoke-Api GET "/api/client/members" $null).Data |
    Where-Object username -eq $memberName | Select-Object -First 1
  if (!$saved -or $saved.roleCode -ne "BUYER") { throw "成员角色未保存" }
  Expect-Status (Invoke-Api PUT "/api/client/members/$($saved.id)" @{
    username=$memberName; realName="QA成员-已停用"; phone="13800138302"; roleCode="ENTERPRISE_ADMIN"; status=0
  }) @(200,204)
  $updated = (Invoke-Api GET "/api/client/members" $null).Data |
    Where-Object id -eq $saved.id | Select-Object -First 1
  if ($updated.status -ne 0 -or $updated.roleCode -ne "ENTERPRISE_ADMIN") { throw "成员状态或角色未更新" }
  Expect-Status (Invoke-Api DELETE "/api/client/members/$($saved.id)" $null) @(200,204)
}
Case "CLI-MEMBER-002" "同一企业成员账号不可重复" {
  $name = "duplicate_$stamp"
  Expect-Status (Invoke-Api POST "/api/client/members" @{
    username=$name; realName="成员一"; phone="13800138303"; roleCode="BUYER"; status=1
  }) @(201)
  $saved = (Invoke-Api GET "/api/client/members" $null).Data |
    Where-Object username -eq $name | Select-Object -First 1
  try {
    Expect-Status (Invoke-Api POST "/api/client/members" @{
      username=$name; realName="成员二"; phone="13800138304"; roleCode="BUYER"; status=1
    }) @(409)
  } finally {
    if ($saved) { [void](Invoke-Api DELETE "/api/client/members/$($saved.id)" $null) }
  }
}
Case "CLI-MEMBER-003" "企业主账号禁止删除" {
  Expect-Status (Invoke-Api DELETE "/api/client/members/1" $null) @(400)
}
Case "CLI-ORDER-001" "不存在订单详情返回业务错误" {
  Expect-Status (Invoke-Api GET "/api/client/orders/99999999" $null) @(400)
}
Case "CLI-INVOICE-001" "发票记录关联订单且金额有效" {
  $invoices = (Invoke-Api GET "/api/client/invoices" $null).Data
  if ($invoices.Count -lt 1) { throw "发票记录为空" }
  if (@($invoices | Where-Object { !$_.orderNo -or [decimal]$_.amount -le 0 }).Count -gt 0) {
    throw "发票缺少订单号或金额无效"
  }
}

# ---------- 清理测试业务数据 ----------
Case "CLEAN-001" "清理协议、企业和商品测试数据" {
  if ($script:agreement1) { Expect-Status (Invoke-Api DELETE "/api/admin/business/agreements/$($script:agreement1)" $null $adminHeaders) @(200,204) }
  if ($script:agreement2) { Expect-Status (Invoke-Api DELETE "/api/admin/business/agreements/$($script:agreement2)" $null $adminHeaders) @(200,204) }
  if ($script:enterpriseId) { Expect-Status (Invoke-Api DELETE "/api/admin/business/enterprises/$($script:enterpriseId)" $null $adminHeaders) @(200,204) }
  if ($script:productId) { Expect-Status (Invoke-Api DELETE "/api/admin/business/products/$($script:productId)" $null $adminHeaders) @(200,204) }
  if ($script:categoryLevel3) { Expect-Status (Invoke-Api DELETE "/api/admin/business/categories/$($script:categoryLevel3)" $null $adminHeaders) @(200,204) }
  if ($script:categoryLevel2) { Expect-Status (Invoke-Api DELETE "/api/admin/business/categories/$($script:categoryLevel2)" $null $adminHeaders) @(200,204) }
  if ($script:categoryLevel1) { Expect-Status (Invoke-Api DELETE "/api/admin/business/categories/$($script:categoryLevel1)" $null $adminHeaders) @(200,204) }
}

Write-Host "`n详细回归测试完成：通过 $script:Passed，失败 $script:Failed"
if ($script:Failed -gt 0) { exit 1 }
