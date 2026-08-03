param([string]$BaseUrl = "http://supply.comp")

$ErrorActionPreference = "Stop"
$passed = 0
$failed = 0

function Case([string]$Name,[scriptblock]$Action) {
  try { & $Action; $script:passed++; Write-Host "PASS $Name" -ForegroundColor Green }
  catch { $script:failed++; Write-Host "FAIL $Name :: $($_.Exception.Message)" -ForegroundColor Red }
}
function Request([string]$Method,[string]$Path) {
  try {
    $response=Invoke-WebRequest -Method $Method -Uri "$BaseUrl$Path" -UseBasicParsing -Proxy $null
    [pscustomobject]@{Status=[int]$response.StatusCode;Content=$response.Content}
  } catch {
    if(!$_.Exception.Response){throw}
    $response=$_.Exception.Response
    $reader=New-Object IO.StreamReader($response.GetResponseStream())
    $content=$reader.ReadToEnd();$reader.Dispose()
    [pscustomobject]@{Status=[int]$response.StatusCode;Content=$content}
  }
}
function Json([string]$Path) {
  $result=Request GET $Path
  [pscustomobject]@{Status=$result.Status;Data=if($result.Content){$result.Content|ConvertFrom-Json}else{$null}}
}

Case "DEP-001 Web 页面可访问" { if((Request GET "/web/").Status-ne 200){throw "Web 不可用"} }
Case "DEP-002 H5 页面可访问" { if((Request GET "/h5/").Status-ne 200){throw "H5 不可用"} }
Case "DEP-003 管理后台可访问" { if((Request GET "/admin/").Status-ne 200){throw "Admin 不可用"} }
Case "DEP-004 健康检查" { if((Request GET "/healthz").Status-ne 200){throw "服务不健康"} }
Case "SEC-001 未登录客户端接口返回 401" { if((Request GET "/api/client/profile").Status-ne 401){throw "未正确拦截"} }
Case "SEC-002 未登录后台接口返回 401" { if((Request GET "/api/admin/system/users").Status-ne 401){throw "未正确拦截"} }
Case "CAT-001 游客商品可浏览" {
  $r=Json "/api/public/catalog/products";if($r.Status-ne 200-or @($r.Data).Count-lt 1){throw "商品为空"}
}
Case "CAT-002 游客不返回协议价" {
  $r=Json "/api/public/catalog/products"
  if(@($r.Data|Where-Object{$null-ne $_.agreementPrice}).Count-ne 0){throw "泄露协议价"}
}
Case "CAT-003 伪造企业参数无效" {
  $r=Json "/api/public/catalog/products?enterpriseId=1"
  if(@($r.Data|Where-Object{$null-ne $_.agreementPrice}).Count-ne 0){throw "伪造参数获得协议价"}
}
Case "CAT-004 三级分类接口可用" {
  $r=Json "/api/public/catalog/categories"
  if($r.Status-ne 200-or @($r.Data|Where-Object{[int]$_.level-eq 3}).Count-lt 1){throw "三级分类缺失"}
}
Case "SKU-001 商品返回可销售 SKU 列表" {
  $r=Json "/api/public/catalog/products"
  $duplicate=@($r.Data|Group-Object spuCode|Where-Object Count -gt 1)
  if($duplicate.Count-ne 0){throw "商品列表按 SKU 重复展示 SPU"}
  foreach($product in @($r.Data)){
    $variants=@($product.variants|ConvertFrom-Json)
    if($variants.Count-lt 1-or !$variants[0].skuId-or !$variants[0].skuCode){throw "SKU 数据不完整"}
  }
}
Case "PORTAL-001 门户配置可用" {
  $r=Json "/api/public/portal";if($r.Status-ne 200-or $null-eq $r.Data.navigation){throw "门户数据缺失"}
}

Write-Host "`n测试完成：通过 $passed，失败 $failed"
if($failed-gt 0){exit 1}
