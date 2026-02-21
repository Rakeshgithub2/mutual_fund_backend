# Configuration Helper for New EC2 Instance
# This script updates all deployment files with your new EC2 IP address

$ErrorActionPreference = "Stop"

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                                                            ║
║        🔧 EC2 INSTANCE CONFIGURATION HELPER               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "This script will configure your deployment for a new EC2 instance.`n" -ForegroundColor White

# Get EC2 IP from user
Write-Host "Enter your NEW EC2 Public IP address:" -ForegroundColor Yellow
Write-Host "(Example: 54.123.45.678)" -ForegroundColor Gray
$EC2_IP = Read-Host "EC2 IP"

if (-not $EC2_IP -or $EC2_IP -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
    Write-Host "`n✗ Invalid IP address format!" -ForegroundColor Red
    Write-Host "Please enter a valid IPv4 address (e.g., 54.123.45.678)" -ForegroundColor Yellow
    exit 1
}

# Get key path
Write-Host "`nEnter path to your SSH key (.pem file):" -ForegroundColor Yellow
Write-Host "(Default: C:\mutual_fund_deployment_files\backend-key.pem)" -ForegroundColor Gray
$KeyPathInput = Read-Host "Key Path (press Enter for default)"

if ([string]::IsNullOrWhiteSpace($KeyPathInput)) {
    $KeyPath = "C:\mutual_fund_deployment_files\backend-key.pem"
} else {
    $KeyPath = $KeyPathInput
}

# Verify key exists
if (-not (Test-Path $KeyPath)) {
    Write-Host "`n⚠️  Warning: SSH key not found at: $KeyPath" -ForegroundColor Yellow
    Write-Host "Make sure to place your .pem file there before deploying!" -ForegroundColor Yellow
    Write-Host "`nContinue anyway? (Y/N): " -NoNewline -ForegroundColor Cyan
    $continue = Read-Host
    if ($continue -ne 'Y' -and $continue -ne 'y') {
        Write-Host "`nConfiguration cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Get GitHub repo URL
Write-Host "`nEnter your GitHub repository URL:" -ForegroundColor Yellow
Write-Host "(Example: https://github.com/username/mutual_fund_backend.git)" -ForegroundColor Gray
$GithubRepo = Read-Host "Repository URL"

if ([string]::IsNullOrWhiteSpace($GithubRepo)) {
    Write-Host "`n✗ GitHub repository URL is required!" -ForegroundColor Red
    exit 1
}

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Configuration Summary:" -ForegroundColor White
Write-Host "  EC2 IP:      $EC2_IP" -ForegroundColor Gray
Write-Host "  SSH Key:     $KeyPath" -ForegroundColor Gray
Write-Host "  GitHub Repo: $GithubRepo" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Is this correct? (Y/N): " -NoNewline -ForegroundColor Cyan
$confirm = Read-Host

if ($confirm -ne 'Y' -and $confirm -ne 'y') {
    Write-Host "`nConfiguration cancelled." -ForegroundColor Yellow
    exit 0
}

# Save configuration
$ConfigFile = Join-Path $PSScriptRoot "ec2-config.json"
$Config = @{
    ec2_ip = $EC2_IP
    key_path = $KeyPath
    github_repo = $GithubRepo
    configured_at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

$Config | Out-File -FilePath $ConfigFile -Encoding UTF8

Write-Host "`n✅ Configuration saved to: $ConfigFile" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Ensure your SSH key is at: $KeyPath" -ForegroundColor White
Write-Host "  2. Run deployment: .\deploy-to-new-ec2.ps1" -ForegroundColor White
Write-Host "  3. Test backend: .\test-new-backend.ps1`n" -ForegroundColor White

Write-Host "✨ Configuration complete!" -ForegroundColor Green
