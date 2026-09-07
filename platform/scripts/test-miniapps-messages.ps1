[CmdletBinding()]
param(
    [ValidateSet('list', 'delete')]
    [string]$Mode = 'list',

    [string]$ApiId = $env:MINIAPPS_API_ID,

    [string]$Secret = $env:MINIAPPS_SECRET,

    [long[]]$MessageIds = @(),

    [string]$BaseUrl = 'https://main.miniappss.com/terminal',

    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ApiId)) {
    throw '缺少 ApiId：请传入 -ApiId，或设置环境变量 MINIAPPS_API_ID。'
}
if ([string]::IsNullOrWhiteSpace($Secret)) {
    throw '缺少秘钥：请传入 -Secret，或设置环境变量 MINIAPPS_SECRET。'
}
if ($Mode -eq 'delete' -and $MessageIds.Count -eq 0) {
    throw '删除消息时必须通过 -MessageIds 指定至少一个消息 ID。'
}

function Get-MiniappsSignature {
    param(
        [Parameter(Mandatory)] [System.Collections.IDictionary]$Data,
        [Parameter(Mandatory)] [string]$SigningKey
    )

    $parts = [System.Collections.Generic.List[string]]::new()
    foreach ($name in ($Data.Keys | Sort-Object)) {
        $value = $Data[$name]
        if ($value -is [System.Array] -or $value -is [System.Collections.IList]) {
            for ($index = 0; $index -lt $value.Count; $index++) {
                $parts.Add(('{0}[{1}]={2}' -f $name, $index, $value[$index]))
            }
        }
        else {
            $parts.Add(('{0}={1}' -f $name, $value))
        }
    }

    $signingText = ($parts -join '&') + '&key=' + $SigningKey
    $md5 = [System.Security.Cryptography.MD5]::Create()
    try {
        $bytes = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($signingText))
        return ([System.BitConverter]::ToString($bytes) -replace '-', '')
    }
    finally {
        $md5.Dispose()
    }
}

$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$normalizedBaseUrl = $BaseUrl.TrimEnd('/')

if ($Mode -eq 'list') {
    $requestUrl = "$normalizedBaseUrl/api.message/getMsgList"
    $data = [ordered]@{
        time      = $timestamp
        type_list = [int[]]@(1, 2, 3, 4)
    }
}
else {
    $requestUrl = "$normalizedBaseUrl/api.message/delMsg"
    $data = [ordered]@{
        time     = $timestamp
        msg_list = [long[]]$MessageIds
    }
}

$signature = Get-MiniappsSignature -Data $data -SigningKey $Secret
$headers = [ordered]@{
    'Content-Type' = 'application/json'
    'Accept'       = 'application/json'
}
$request = [ordered]@{
    api_id = $ApiId
    sign   = $signature
    data   = $data
}
$requestJson = $request | ConvertTo-Json -Depth 10

Write-Host '========== 请求信息 ==========' -ForegroundColor Cyan
Write-Host ('模式：{0}' -f $Mode)
Write-Host ('URL：{0}' -f $requestUrl)
Write-Host '请求头：'
$headers | ConvertTo-Json | Write-Host
Write-Host '业务参数 data：'
$data | ConvertTo-Json -Depth 10 | Write-Host
Write-Host '最终请求体（秘钥不在请求体中）：'
Write-Host $requestJson
Write-Host '说明：签名计算使用了秘钥，但脚本不会打印秘钥或包含秘钥的签名原文。'

Write-Host '========== 返回数据 ==========' -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest `
        -Uri $requestUrl `
        -Method Post `
        -Headers @{ Accept = 'application/json' } `
        -ContentType 'application/json' `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($requestJson)) `
        -TimeoutSec $TimeoutSeconds

    Write-Host ('HTTP 状态：{0} {1}' -f [int]$response.StatusCode, $response.StatusDescription)
    Write-Host '原始响应：'
    Write-Host $response.Content

    try {
        $parsed = $response.Content | ConvertFrom-Json
        Write-Host '格式化响应：'
        $parsed | ConvertTo-Json -Depth 20 | Write-Host
        if ($parsed.code -ne 200) {
            exit 2
        }
    }
    catch {
        Write-Warning '响应不是有效 JSON，请以上方原始响应为准。'
        exit 3
    }
}
catch {
    $statusCode = $null
    $responseText = $null
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
        try {
            $responseText = $_.ErrorDetails.Message
        }
        catch {}
    }

    Write-Host ('HTTP 状态：{0}' -f $(if ($null -eq $statusCode) { '未获取' } else { $statusCode })) -ForegroundColor Red
    Write-Host ('请求失败：{0}' -f $_.Exception.Message) -ForegroundColor Red
    if ($responseText) {
        Write-Host '错误响应：'
        Write-Host $responseText
    }
    exit 1
}
