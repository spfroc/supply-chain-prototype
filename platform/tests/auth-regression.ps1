param(
  [string]$BaseUrl = "http://supply.comp",
  [string]$AdminUser = "admin",
  [string]$AdminPassword = "change-me-before-production"
)

$ErrorActionPreference="Stop"
$script:Passed=0
$stamp=[DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$username="register_$stamp"
$password="Register-2026!"
$credential=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${AdminUser}:${AdminPassword}"))
$adminHeaders=@{Authorization="Basic $credential";"Content-Type"="application/json"}

function Request {
  param([string]$Method,[string]$Path,$Body,[hashtable]$Headers=@{},$Session=$null)
  $response=$null
  $args=@{Method=$Method;Uri="$BaseUrl$Path";Headers=$Headers;UseBasicParsing=$true}
  if($null -ne $Session){$args.WebSession=$Session}
  if($null -ne $Body){$args.ContentType="application/json";$args.Body=[Text.Encoding]::UTF8.GetBytes(($Body|ConvertTo-Json -Depth 6))}
  try{$response=Invoke-WebRequest @args;$status=[int]$response.StatusCode;$content=$response.Content}
  catch{if(!$_.Exception.Response){throw};$status=[int]$_.Exception.Response.StatusCode;$reader=New-Object IO.StreamReader($_.Exception.Response.GetResponseStream());$content=$reader.ReadToEnd();$reader.Dispose()}
  [pscustomobject]@{Status=$status;Data=if($content){$content|ConvertFrom-Json}else{$null};Cookie=if($response){($response.Headers["Set-Cookie"]-split";")[0]}else{$null}}
}
function Pass([string]$name){$script:Passed++;Write-Host "PASS $name" -ForegroundColor Green}

$enterprises=Request GET "/api/auth/enterprises" $null
if($enterprises.Status -ne 200 -or $enterprises.Data.Count -lt 1){throw "企业选择列表不可用"};Pass "AUTH-001 企业选择列表"
$enterprise=$enterprises.Data|Where-Object id -eq 1|Select-Object -First 1
if(!$enterprise){throw "缺少认证测试企业"}
$enterpriseName=[Text.Encoding]::UTF8.GetString([Text.Encoding]::GetEncoding(28591).GetBytes([string]$enterprise.name))

$registerSession=New-Object Microsoft.PowerShell.Commands.WebRequestSession
$register=Request POST "/api/auth/register" @{enterpriseName=$enterpriseName;username=$username;password=$password;realName="REGISTER-USER";phone="13800138901"} @{} $registerSession
if($register.Status -ne 201){throw "注册失败"};Pass "AUTH-002 注册后自动登录"

$me=Request GET "/api/auth/me" $null @{} $registerSession
if($me.Status -ne 200 -or $me.Data.username -ne $username -or $me.Data.roleCode -ne "BUYER"){throw "当前用户信息错误"};Pass "AUTH-003 当前登录用户与默认采购员角色"

$profile=Request GET "/api/client/profile" $null @{} $registerSession
if($profile.Status -ne 200 -or $profile.Data.username -ne $username){throw "用户中心未使用当前登录用户"};Pass "AUTH-004 用户中心身份隔离"

$forbidden=Request POST "/api/client/members" @{username="forbidden_$stamp";realName="NO";phone="13800138902";roleCode="BUYER";status=1} @{} $registerSession
if($forbidden.Status -ne 403){throw "采购员不应管理企业成员，实际$($forbidden.Status)"};Pass "AUTH-005 采购员成员管理权限"

$logout=Request POST "/api/auth/logout" $null @{} $registerSession
if($logout.Status -notin @(200,204)){throw "退出失败"}
$afterLogout=Request GET "/api/auth/me" $null @{} $registerSession
if($afterLogout.Status -ne 401){throw "退出后会话仍有效"};Pass "AUTH-006 退出后会话失效"

$bad=Request POST "/api/auth/login" @{username=$username;password="wrong-password"}
if($bad.Status -ne 400){throw "错误密码未被拒绝"};Pass "AUTH-007 错误密码"

$loginSession=New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login=Request POST "/api/auth/login" @{username=$username;password=$password} @{} $loginSession
if($login.Status -ne 200){throw "注册用户重新登录失败"};Pass "AUTH-008 重新登录"

$members=Request GET "/api/admin/business/enterprises/1/members" $null $adminHeaders
$member=$members.Data|Where-Object username -eq $username|Select-Object -First 1
if($member){$delete=Request DELETE "/api/admin/business/enterprises/1/members/$($member.id)" $null $adminHeaders;if($delete.Status -notin @(200,204)){throw "测试用户清理失败"}}
Pass "AUTH-009 清理注册测试用户"

Write-Host "`n认证回归测试完成：通过 $script:Passed，失败 0"
