$version = "0.1.5"

# Update package.json files
Get-ChildItem -Path . -Recurse -Filter "package.json" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match '"version":\s*".*"') {
        $content = $content -replace '"version":\s*".*"', """version"": ""$version"""
        Set-Content -Path $_.FullName -Value $content -NoNewline
        Write-Host "Updated $($_.FullName)"
    }
}

# Update tauri.conf.json
$tauriConfig = "apps\desktop\src-tauri\tauri.conf.json"
if (Test-Path $tauriConfig) {
    $content = Get-Content $tauriConfig -Raw
    if ($content -match '"version":\s*".*"') {
        $content = $content -replace '"version":\s*".*"', """version"": ""$version"""
        Set-Content -Path $tauriConfig -Value $content -NoNewline
        Write-Host "Updated $tauriConfig"
    }
}
