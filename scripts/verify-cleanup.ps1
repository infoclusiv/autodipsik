$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
  Write-Host "FAIL $Message" -ForegroundColor Red
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS $Message" -ForegroundColor Green
}

function Test-RepoFile {
  param([string]$RelativePath)
  $fullPath = Join-Path $repoRoot $RelativePath
  return Test-Path -LiteralPath $fullPath -PathType Leaf
}

function Assert-FilesExist {
  param(
    [string]$SourceLabel,
    [string[]]$RelativePaths
  )

  $missing = @()
  foreach ($relativePath in $RelativePaths) {
    if (-not (Test-RepoFile $relativePath)) {
      $missing += $relativePath
      Add-Failure "Missing referenced file: $relativePath ($SourceLabel)"
    }
  }

  if ($missing.Count -eq 0) {
    Add-Pass "$SourceLabel references existing files"
  }
}

function Get-RelativeRepoPath {
  param(
    [string]$BaseDirectory,
    [string]$ReferencePath
  )

  $baseUri = [System.Uri]((Join-Path $repoRoot $BaseDirectory).Replace('\', '/') + "/")
  $targetUri = [System.Uri](Join-Path (Join-Path $repoRoot $BaseDirectory) $ReferencePath)
  $relativeUri = $repoRoot.Replace('\', '/') + "/"
  $repoUri = [System.Uri]$relativeUri
  return [System.Uri]::UnescapeDataString($repoUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
}

Set-Location $repoRoot

$trackedRuntimeLogs = @(git ls-files -- 'runtime/*.jsonl')
if ($LASTEXITCODE -ne 0) {
  Add-Failure "git ls-files failed while checking tracked runtime logs"
} elseif ($trackedRuntimeLogs.Count -gt 0) {
  foreach ($trackedLog in $trackedRuntimeLogs) {
    Add-Failure "Tracked runtime artifact detected: $trackedLog"
  }
} else {
  Add-Pass "No tracked runtime JSONL artifacts found"
}

$manifest = Get-Content -Raw (Join-Path $repoRoot "manifest.json") | ConvertFrom-Json
$manifestReferences = New-Object System.Collections.Generic.List[string]
$manifestReferences.Add($manifest.background.service_worker) | Out-Null
$manifestReferences.Add($manifest.side_panel.default_path) | Out-Null
foreach ($contentScript in $manifest.content_scripts) {
  foreach ($scriptPath in $contentScript.js) {
    $manifestReferences.Add($scriptPath) | Out-Null
  }
}
Assert-FilesExist "manifest.json" $manifestReferences

$sidepanelHtml = Get-Content -Raw (Join-Path $repoRoot "sidepanel\sidepanel.html")
$sidepanelMatches = [regex]::Matches($sidepanelHtml, '<script\s+src="([^"]+)"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$sidepanelReferences = @()
foreach ($match in $sidepanelMatches) {
  $sidepanelReferences += Get-RelativeRepoPath "sidepanel" $match.Groups[1].Value
}
Assert-FilesExist "sidepanel/sidepanel.html" $sidepanelReferences

$backgroundMain = Get-Content -Raw (Join-Path $repoRoot "background-main.js")
$importScriptsMatch = [regex]::Match($backgroundMain, 'importScripts\s*\((.*?)\);', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $importScriptsMatch.Success) {
  Add-Failure "Could not parse importScripts(...) in background-main.js"
} else {
  $backgroundReferences = @()
  foreach ($match in [regex]::Matches($importScriptsMatch.Groups[1].Value, '"([^"]+)"')) {
    $backgroundReferences += $match.Groups[1].Value
  }
  Assert-FilesExist "background-main.js" $backgroundReferences
}

$tabManager = Get-Content -Raw (Join-Path $repoRoot "core\tabManager.js")
$fallbackListMatch = [regex]::Match($tabManager, 'DEEPSEEK_CONTENT_SCRIPT_FILES\s*=\s*\[(.*?)\];', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if (-not $fallbackListMatch.Success) {
  Add-Failure "Could not parse DEEPSEEK_CONTENT_SCRIPT_FILES in core/tabManager.js"
} else {
  $fallbackReferences = @()
  foreach ($match in [regex]::Matches($fallbackListMatch.Groups[1].Value, '"([^"]+)"')) {
    $fallbackReferences += $match.Groups[1].Value
  }
  Assert-FilesExist "core/tabManager.js" $fallbackReferences

  $manifestDeepSeekFiles = @()
  foreach ($contentScript in $manifest.content_scripts) {
    $matchesDeepSeek = $false
    foreach ($pattern in $contentScript.matches) {
      if ($pattern -eq "https://chat.deepseek.com/*") {
        $matchesDeepSeek = $true
      }
    }
    if ($matchesDeepSeek) {
      foreach ($scriptPath in $contentScript.js) {
        if ($scriptPath -like "sites/deepseek/*") {
          $manifestDeepSeekFiles += $scriptPath
        }
      }
    }
  }

  $fallbackDeepSeekFiles = @($fallbackReferences | Where-Object { $_ -like "sites/deepseek/*" })
  $missingFallbackReferences = @($manifestDeepSeekFiles | Where-Object { $_ -notin $fallbackDeepSeekFiles })

  if ($missingFallbackReferences.Count -gt 0) {
    foreach ($missingReference in $missingFallbackReferences) {
      Add-Failure "core/tabManager.js is missing DeepSeek fallback injection reference: $missingReference"
    }
  } else {
    Add-Pass "core/tabManager.js includes all DeepSeek site fallback injection references"
  }
}

$orphanReferenceMatches = @(git grep -n -E 'DeepSeekUpload|deepseekUpload' -- manifest.json sidepanel background core sites app-python 2>$null)
if ($LASTEXITCODE -gt 1) {
  Add-Failure "git grep failed while checking orphan deepseekUpload references"
} elseif ($orphanReferenceMatches.Count -gt 0) {
  foreach ($orphanReference in $orphanReferenceMatches) {
    Add-Failure "Orphan deepseekUpload reference detected: $orphanReference"
  }
} else {
  Add-Pass "No orphan deepseekUpload references remain in active code"
}

$legacySidepanelUiMatches = @(git grep -n -E 'automation-prompt-text|run-automation|run-dry-run' -- sidepanel 2>$null)
if ($LASTEXITCODE -gt 1) {
  Add-Failure "git grep failed while checking removed sidepanel legacy UI ids"
} elseif ($legacySidepanelUiMatches.Count -gt 0) {
  foreach ($legacyMatch in $legacySidepanelUiMatches) {
    Add-Failure "Removed sidepanel legacy UI reference detected: $legacyMatch"
  }
} else {
  Add-Pass "No removed sidepanel legacy UI references remain"
}

$legacyOneClickRouteMatches = @(git grep -n -E 'AUTOMATION_ONE_CLICK_RUN|DeepSeekOneClickWorkflow|runOneClick|automation\.one_click' -- background core sidepanel workflowLab manifest.json 2>$null)
if ($LASTEXITCODE -gt 1) {
  Add-Failure "git grep failed while checking removed legacy one-click route references"
} elseif ($legacyOneClickRouteMatches.Count -gt 0) {
  foreach ($legacyMatch in $legacyOneClickRouteMatches) {
    Add-Failure "Removed legacy one-click route reference detected: $legacyMatch"
  }
} else {
  Add-Pass "No removed legacy one-click route references remain in active runtime files"
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Cleanup verification failed." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Cleanup verification passed." -ForegroundColor Green
