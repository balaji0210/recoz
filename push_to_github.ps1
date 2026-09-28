# ============================================================
#  RICOZ PROJECT - GitHub Push Script (No Git needed!)
#  Target repo: https://github.com/balaji0210/recoz
# ============================================================
#
# HOW TO USE:
#   1. Open PowerShell (search "PowerShell" in Start menu)
#   2. Run: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   3. cd "C:\Users\hp\Desktop\Ricoz"
#   4. Run: .\push_to_github.ps1
#   5. Paste your GitHub token when asked
#
# HOW TO GET A FREE TOKEN (2 minutes):
#   1. Go to: https://github.com/settings/tokens/new
#   2. Note: "Ricoz push"  |  Expiration: 7 days
#   3. Check the "repo" checkbox
#   4. Click "Generate token" and COPY the token (ghp_xxx...)
# ============================================================

param(
    [string]$Token = "",
    [string]$RepoOwner = "balaji0210",
    [string]$RepoName = "recoz",
    [string]$Branch = "main"
)

if (-not $Token) {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "  RICOZ GitHub Push Script" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Get token at: https://github.com/settings/tokens/new" -ForegroundColor Yellow
    Write-Host "(Check 'repo' scope, then Generate Token)" -ForegroundColor Yellow
    Write-Host ""
    $secureToken = Read-Host "Paste your GitHub Personal Access Token" -AsSecureString
    $Token = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    )
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$headers = @{
    "Authorization" = "token $Token"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "RicozPushScript"
}

Write-Host "Verifying GitHub token..." -ForegroundColor Cyan
try {
    $user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers -Method Get
    Write-Host "Authenticated as: $($user.login)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Invalid token. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Checking repository $RepoOwner/$RepoName..." -ForegroundColor Cyan
try {
    $repo = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName" -Headers $headers -Method Get
    Write-Host "Repo found: $($repo.html_url)" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Repo not found. Visit https://github.com/$RepoOwner/$RepoName" -ForegroundColor Red
    exit 1
}

Write-Host "Getting current branch info..." -ForegroundColor Cyan
$baseTreeSha = $null
$parentSha = $null
try {
    $refInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/refs/heads/$Branch" -Headers $headers -Method Get
    $parentSha = $refInfo.object.sha
    $commitInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/commits/$parentSha" -Headers $headers -Method Get
    $baseTreeSha = $commitInfo.tree.sha
    Write-Host "Branch '$Branch' exists." -ForegroundColor Green
} catch {
    Write-Host "Branch '$Branch' not found - will create it." -ForegroundColor Yellow
}

$excludeDirs = @('.git','node_modules','__pycache__','.pytest_cache','dist','build','.venv','venv')
$excludeFiles = @('push_to_github.ps1','*.pyc','*.pyo','.DS_Store','*.pdf')

Write-Host "Scanning project files..." -ForegroundColor Cyan
$allFiles = Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($ProjectRoot.Length + 1)
    $parts = $rel -split '\\'
    $skip = $false
    foreach ($part in $parts[0..($parts.Length - 2)]) {
        if ($excludeDirs -contains $part) { $skip = $true; break }
    }
    foreach ($pattern in $excludeFiles) {
        if ($_.Name -like $pattern) { $skip = $true; break }
    }
    -not $skip
}
Write-Host "Found $($allFiles.Count) files to upload." -ForegroundColor Green

$treeItems = @()
$total = $allFiles.Count
$count = 0

Write-Host "Uploading files to GitHub..." -ForegroundColor Cyan
foreach ($file in $allFiles) {
    $count++
    $relativePath = $file.FullName.Substring($ProjectRoot.Length + 1) -replace '\\', '/'
    Write-Host "[$count/$total] $relativePath" -ForegroundColor DarkGray
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $base64Content = [Convert]::ToBase64String($bytes)
        $blobBody = (@{ content = $base64Content; encoding = "base64" } | ConvertTo-Json)
        $blob = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/blobs" `
            -Headers $headers -Method Post -Body $blobBody -ContentType "application/json"
        $treeItems += @{ path = $relativePath; mode = "100644"; type = "blob"; sha = $blob.sha }
    } catch {
        Write-Host "  WARNING: Skipped $relativePath - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "Creating Git tree..." -ForegroundColor Cyan
$treeBody = @{ tree = $treeItems }
if ($baseTreeSha) { $treeBody.base_tree = $baseTreeSha }
$newTree = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/trees" `
    -Headers $headers -Method Post -Body ($treeBody | ConvertTo-Json -Depth 10) -ContentType "application/json"
Write-Host "Tree created." -ForegroundColor Green

Write-Host "Creating commit..." -ForegroundColor Cyan
$commitBody = @{
    message = "feat: initial push of Ricoz AppMon project"
    tree    = $newTree.sha
    author  = @{ name = "Ricoz Developer"; email = "dev@ricoz.com"; date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") }
    parents = if ($parentSha) { @($parentSha) } else { @() }
}
$newCommit = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/commits" `
    -Headers $headers -Method Post -Body ($commitBody | ConvertTo-Json -Depth 5) -ContentType "application/json"
Write-Host "Commit created: $($newCommit.sha.Substring(0,8))..." -ForegroundColor Green

Write-Host "Pushing to branch '$Branch'..." -ForegroundColor Cyan
$refBody = (@{ sha = $newCommit.sha; force = $true } | ConvertTo-Json)
try {
    Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/refs/heads/$Branch" `
        -Headers $headers -Method Patch -Body $refBody -ContentType "application/json" | Out-Null
} catch {
    $createRef = (@{ ref = "refs/heads/$Branch"; sha = $newCommit.sha } | ConvertTo-Json)
    Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/git/refs" `
        -Headers $headers -Method Post -Body $createRef -ContentType "application/json" | Out-Null
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  SUCCESS! Project pushed to GitHub!" -ForegroundColor Green
Write-Host "  URL: https://github.com/$RepoOwner/$RepoName" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
