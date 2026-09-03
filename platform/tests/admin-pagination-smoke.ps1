param([string]$BaseUrl="http://supply.comp",[string]$User="operator",[string]$Password="demo-password")
$ErrorActionPreference="Stop"
$credential=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${User}:${Password}"))
$headers=@{Authorization="Basic $credential"}
$passed=0;$failed=0
function Check([string]$name,[scriptblock]$test){try{if(& $test){"PASS $name";$script:passed++}else{"FAIL $name";$script:failed++}}catch{"FAIL $name - $($_.Exception.Message)";$script:failed++}}
function Request([string]$path){Invoke-RestMethod "$BaseUrl$path" -Headers $headers -TimeoutSec 15}

$products=Request -path '/api/admin/business/products?page=1&pageSize=3'
Check "PAGE-001 product page structure" { $products.records.Count -le 3 -and $products.total -ge $products.records.Count -and $products.totalPages -ge 1 }
Check "PAGE-001A product ownership field" { $products.records.Count -gt 0 -and $null -ne $products.records[0].selfOperated }
$page2=Request -path '/api/admin/business/products?page=2&pageSize=3'
Check "PAGE-002 product page navigation" { $page2.page -eq 2 -and $page2.pageSize -eq 3 }
$search=Request -path '/api/admin/business/products?page=1&pageSize=10&keyword=%E5%85%AC%E7%89%9B'
Check "PAGE-003 product server search" { $search.total -ge 1 -and $search.records.Count -ge 1 }
$orders=Request -path '/api/admin/business/orders?page=1&pageSize=5&status=3'
Check "PAGE-004 order status filter" { ($orders.records | Where-Object {[int]$_.orderStatus -ne 3}).Count -eq 0 }
$brands=Request -path '/api/admin/content/brands/list?page=1&pageSize=5'
Check "PAGE-005 brand pagination" { $brands.records.Count -le 5 -and $brands.totalPages -ge 1 }
$attributes=Request -path '/api/admin/business/attributes?categoryId=1&associated=true&page=1&pageSize=5'
Check "PAGE-006 associated attribute pagination" { $attributes.records.Count -le 5 -and $attributes.total -ge $attributes.records.Count }
$afterSales=Request -path '/api/admin/business/after-sales?page=1&pageSize=5'
Check "PAGE-007 after-sales pagination" { $afterSales.records.Count -le 5 -and $afterSales.total -ge $afterSales.records.Count }
$statements=Request -path '/api/admin/business/finance/statements?page=1&pageSize=5'
Check "PAGE-008 statement pagination" { $statements.records.Count -le 5 -and $statements.total -ge $statements.records.Count }
$invoices=Request -path '/api/admin/business/finance/invoice-applications?page=1&pageSize=5'
Check "PAGE-009 invoice pagination" { $invoices.records.Count -le 5 -and $invoices.total -ge $invoices.records.Count }
$legacy=Request -path '/api/admin/business/products'
Check "PAGE-010 legacy array compatibility" { $legacy -is [array] -and $legacy.Count -ge $products.records.Count }

"Completed: passed $passed, failed $failed"
if($failed -gt 0){exit 1}
