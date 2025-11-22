# Script to create GitHub release for v1.0.0
# You need to have GitHub CLI (gh) installed: https://cli.github.com/

$version = "v1.0.0"
$title = "🎉 cors-diagnoser v1.0.0 - Initial Release"
$notesFile = "RELEASE_NOTES_v1.0.0.md"

Write-Host "Creating GitHub release for $version..." -ForegroundColor Green

# Check if gh CLI is installed
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "GitHub CLI (gh) is not installed." -ForegroundColor Red
    Write-Host "Please install it from: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternative: Create the release manually at:" -ForegroundColor Yellow
    Write-Host "https://github.com/dominiquekossi/cors-diagnoser/releases/new?tag=$version" -ForegroundColor Cyan
    exit 1
}

# Create the release
gh release create $version `
    --title $title `
    --notes-file $notesFile `
    --latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Release created successfully!" -ForegroundColor Green
    Write-Host "View it at: https://github.com/dominiquekossi/cors-diagnoser/releases/tag/$version" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to create release" -ForegroundColor Red
    Write-Host "You can create it manually at:" -ForegroundColor Yellow
    Write-Host "https://github.com/dominiquekossi/cors-diagnoser/releases/new?tag=$version" -ForegroundColor Cyan
}
