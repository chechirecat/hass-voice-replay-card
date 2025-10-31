# PowerShell version of version consistency check for hass-voice-replay-card
# This script checks if versions match across voice-replay-card.js and git tags
#
# IMPORTANT: You may need to set PowerShell execution policy before running:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# See docs/POWERSHELL_EXECUTION_POLICY.md for complete details
#
# Usage: .\scripts\check-version-consistency.ps1 [-Verbose]

param(
    [switch]$Verbose = $false
)

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    switch ($Color) {
        "Red" { Write-Host $Message -ForegroundColor Red }
        "Green" { Write-Host $Message -ForegroundColor Green }
        "Yellow" { Write-Host $Message -ForegroundColor Yellow }
        "Cyan" { Write-Host $Message -ForegroundColor Cyan }
        "Gray" { Write-Host $Message -ForegroundColor Gray }
        default { Write-Host $Message }
    }
}

function Get-CardVersion {
    if (Test-Path "voice-replay-card.js") {
        try {
            $content = Get-Content "voice-replay-card.js" -Raw
            if ($content -match "CARD_VERSION = '([^']+)'") {
                return $matches[1]
            }
        }
        catch {
            Write-ColorOutput "Error reading voice-replay-card.js: $_" "Red"
        }
    }
    return $null
}

function Get-LatestGitTag {
    try {
        # Get the latest tag that matches v*.*.* pattern
        $latestTag = git describe --tags --abbrev=0 --match="v*.*.*" 2>$null
        if ($latestTag -and $latestTag -match '^v(.+)$') {
            return $matches[1]  # Return version without 'v' prefix
        }
    }
    catch {
        Write-ColorOutput "Error getting git tags: $_" "Red"
    }
    return $null
}

# Main execution
Write-ColorOutput "Checking version consistency..." "Cyan"
Write-Host ""

# Check if we're in the correct repository
if (-not (Test-Path "voice-replay-card.js")) {
    Write-ColorOutput "Could not detect hass-voice-replay-card repository" "Red"
    Write-ColorOutput "This script should be run from the hass-voice-replay-card repository root" "Red"
    exit 1
}

Write-ColorOutput "Detected repository: hass-voice-replay-card" "Yellow"

# Get versions
$cardVersion = Get-CardVersion
$gitTagVersion = Get-LatestGitTag

if (-not $cardVersion) {
    Write-ColorOutput "Could not extract version from voice-replay-card.js" "Red"
    exit 1
}

Write-ColorOutput "Target version: $cardVersion" "Green"

$foundVersions = @()
$missingFiles = @()

# Check card version
if ($cardVersion) {
    $foundVersions += @{ File = "voice-replay-card.js"; Version = $cardVersion; Path = "voice-replay-card.js" }
    if ($Verbose) { Write-ColorOutput "voice-replay-card.js version: $cardVersion" "Gray" }
} else {
    $missingFiles += "voice-replay-card.js"
}

# Check git tag version
if ($gitTagVersion) {
    $foundVersions += @{ File = "git tag"; Version = $gitTagVersion; Path = "latest git tag (v$gitTagVersion)" }
    if ($Verbose) { Write-ColorOutput "latest git tag version: $gitTagVersion" "Gray" }
} else {
    if ($Verbose) { Write-ColorOutput "No git tags found matching v*.*.* pattern" "Gray" }
}

# Report missing files
if ($missingFiles.Count -gt 0) {
    Write-ColorOutput "Missing version files:" "Yellow"
    foreach ($file in $missingFiles) {
        Write-ColorOutput "  - $file" "Yellow"
    }
    Write-Host ""
}

if ($foundVersions.Count -eq 0) {
    Write-ColorOutput "No version files found!" "Red"
    exit 1
}

# Check for consistency
$uniqueVersions = $foundVersions | ForEach-Object { $_.Version } | Sort-Object -Unique

if ($uniqueVersions.Count -eq 1) {
    $version = $uniqueVersions | Select-Object -First 1
    Write-ColorOutput "All versions are consistent: $version" "Green"
    if ($foundVersions.Count -gt 1) {
        Write-ColorOutput "   Found in $($foundVersions.Count) files:" "Gray"
        foreach ($item in $foundVersions) {
            Write-ColorOutput "   - $($item.File)" "Gray"
        }
    }
    Write-Host ""
    Write-ColorOutput "Version: $version" "Green"
    exit 0
} else {
    Write-ColorOutput "Version mismatch detected!" "Red"
    Write-Host ""
    Write-ColorOutput "Different versions found:" "Red"
    
    # Show each file and its version
    foreach ($item in $foundVersions) {
        Write-ColorOutput "   $($item.File): $($item.Version) ($($item.Path))" "Yellow"
    }
    
    Write-Host ""
    Write-ColorOutput "To fix version inconsistencies:" "Red"
    Write-ColorOutput "  1. Update CARD_VERSION in voice-replay-card.js" "Red"
    Write-ColorOutput "  2. Ensure git tag matches the card version" "Red"
    
    Write-Host ""
    Write-ColorOutput "All versions should be: $cardVersion" "Green"
    exit 1
}