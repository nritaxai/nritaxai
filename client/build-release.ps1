# Stop on PowerShell errors so the script exits cleanly on failure.
$ErrorActionPreference = 'Stop'

try {
    # Move into the Capacitor client project before running the Android build.
    Set-Location 'E:\nritax\nri\client'

    # Run the same npm package script through npm.cmd to avoid PowerShell execution-policy blocks.
    npm.cmd run android:build

    # Surface npm script failures explicitly instead of continuing silently.
    if ($LASTEXITCODE -ne 0) {
        throw "npm run android:build failed with exit code $LASTEXITCODE."
    }

    # Verify the expected Play Store bundle exists in the release output folder.
    $aabPath = 'E:\nritax\nri\client\android\app\release\app-release.aab'
    if (-not (Test-Path -LiteralPath $aabPath)) {
        throw "Expected AAB not found at $aabPath."
    }

    # Read the file metadata so we can display the bundle size in megabytes.
    $aabFile = Get-Item -LiteralPath $aabPath
    $sizeInMb = [math]::Round($aabFile.Length / 1MB, 2)

    # Print the final status lines needed for the release checklist.
    Write-Host "AAB path: $aabPath"
    Write-Host "AAB size: $sizeInMb MB"
    Write-Host "✅ AAB ready for Play Store upload"
    Write-Host "Did you increment versionCode in build.gradle?"
}
catch {
    # Print the reason for failure and exit with a non-zero code for automation.
    Write-Error $_.Exception.Message
    exit 1
}
