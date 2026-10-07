<#
Makes this desktop the GitHub Actions runner for the gen3d and voices
workflows (scripts/desktop/README.md). Run it once, in the repository, from
a normal PowerShell window: Start menu, Windows Terminal. Not from a
terminal inside the Claude app, which writes AppData into the app's private
box where the runner can't see it.

  powershell -ExecutionPolicy Bypass -File scripts\desktop\setup-runner.ps1
  powershell -ExecutionPolicy Bypass -File scripts\desktop\setup-runner.ps1 -Remove

It checks that gh and git can act for you on GitHub (signing you in if not),
downloads the Actions runner to ~\actions-runner and registers it on the
repository with the label gpu, adds a scheduled task that starts it at
logon and checks on it every 5 minutes (it reconnects by itself after
sleep), moves the old Startup-folder pollers aside, and runs the doctor.
Running it again is safe: it only does what isn't done.
#>
param(
  [switch]$Remove,
  [string]$Repo = 'tilakpatell/new-portfolio-website',
  [string]$Dir = "$HOME\actions-runner"
)

# Continue, not Stop: Windows PowerShell turns a native command's stderr into
# errors, and Stop would end the script on gh's or git's chatter. Each step
# checks its own result instead.
$ErrorActionPreference = 'Continue'
$task = 'desktop-jobs-runner'
$name = "$env:COMPUTERNAME-gpu".ToLower()
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path "$here\..\..").Path

function Say($m) { Write-Host "== $m" -ForegroundColor Cyan }
function Fail($m) { Write-Host "!! $m" -ForegroundColor Red; exit 1 }

# Inside the Claude app? A file written to LOCALAPPDATA there turns up in its box.
$probe = "desktop-jobs-probe-$PID"
New-Item -ItemType File -Path "$env:LOCALAPPDATA\$probe" -Force | Out-Null
$boxed = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue | Where-Object { Test-Path "$($_.FullName)\LocalCache\Local\$probe" }
Remove-Item "$env:LOCALAPPDATA\$probe" -Force -ErrorAction SilentlyContinue
if ($boxed) { Fail 'This is running inside the Claude app, which boxes AppData. Open PowerShell from the Start menu and run it there.' }

foreach ($c in 'node', 'git', 'gh') {
  if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { Fail "$c isn't on PATH" }
}

if ($Remove) {
  Say 'Removing the runner'
  Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
  Get-Process Runner.Listener, Runner.Worker -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$Dir*" } | Stop-Process -Force
  if (Test-Path "$Dir\.runner") {
    $t = gh api -X POST "repos/$Repo/actions/runners/remove-token" -q .token
    Push-Location $Dir
    & .\config.cmd remove --token $t
    Pop-Location
  }
  Say "Done. The runner's files are still in $Dir; delete the folder if you like."
  exit 0
}

# The repository proper (this may be one of its worktrees): the jobs' own
# checkouts sit beside it (<repo>-gen3d, <repo>-voices).
$common = git -C $repoRoot rev-parse --path-format=absolute --git-common-dir
if ($LASTEXITCODE -ne 0) { Fail "$repoRoot isn't a git checkout: run this from the repository" }
$mainRepo = (Resolve-Path (Join-Path $common '..')).Path

Say 'GitHub sign-in'
$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  # signed in from inside the Claude app: gh's config (which account; the
  # token itself is in the Windows credential store) is in the app's box
  $boxedGh = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.FullName)\LocalCache\Roaming\GitHub CLI" } | Where-Object { Test-Path "$_\hosts.yml" } | Select-Object -First 1
  if ($boxedGh -and -not (Test-Path "$env:APPDATA\GitHub CLI\hosts.yml")) {
    New-Item -ItemType Directory -Force "$env:APPDATA\GitHub CLI" | Out-Null
    Copy-Item "$boxedGh\*.yml" "$env:APPDATA\GitHub CLI\" -Force
    Write-Host "gh's config copied out of the Claude app's box"
    $null = gh auth status 2>&1
  }
}
if ($LASTEXITCODE -ne 0) {
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { Fail 'gh auth login failed' }
}
# git pushes with gh's login, so no credential prompt can hang a job
gh auth setup-git
if ($LASTEXITCODE -ne 0) { Fail 'gh auth setup-git failed' }
$login = gh api user -q .login
if (-not $login) { Fail 'gh is signed in but the API call failed' }
Say "gh and git act as $login"

Say "The Actions runner, in $Dir"
if (-not (Test-Path "$Dir\run.cmd")) {
  $rel = Invoke-RestMethod 'https://api.github.com/repos/actions/runner/releases/latest' -Headers @{ 'User-Agent' = 'desktop-jobs-setup' } -ErrorAction Stop
  $asset = $rel.assets | Where-Object { $_.name -like 'actions-runner-win-x64-*.zip' } | Select-Object -First 1
  if (-not $asset) { Fail 'no Windows x64 runner in the latest release' }
  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  $zip = Join-Path $env:TEMP $asset.name
  Write-Host "downloading $($asset.name)"
  Invoke-WebRequest $asset.browser_download_url -OutFile $zip -UseBasicParsing -ErrorAction Stop
  Expand-Archive $zip -DestinationPath $Dir -Force -ErrorAction Stop
  Remove-Item $zip
}
if (-not (Test-Path "$Dir\.runner")) {
  $token = gh api -X POST "repos/$Repo/actions/runners/registration-token" -q .token
  if (-not $token) { Fail "couldn't get a registration token (are you an admin of $Repo?)" }
  Push-Location $Dir
  & .\config.cmd --unattended --url "https://github.com/$Repo" --token $token --name $name --labels gpu --work _work --replace
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Fail 'registering the runner failed' }
}

# What every job sees besides the PATH recorded at registration: the real
# repository (the runner's own checkout is a sparse clone), the browser for
# judging sheets, and no git prompt that could wait forever.
$envFile = "$Dir\.env"
$want = [ordered]@{ DESKTOP_JOBS_REPO = $mainRepo; CHROME = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; GCM_INTERACTIVE = 'never'; GIT_TERMINAL_PROMPT = '0' }
$lines = @()
if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { $_ -and ($want.Keys -notcontains ($_ -split '=', 2)[0]) }) }
foreach ($k in $want.Keys) { $lines += "$k=$($want[$k])" }
Set-Content -Path $envFile -Value $lines -Encoding ascii

Say 'The watchdog'
# starts the runner when it isn't running; the runner itself reconnects after sleep
$watchdog = @'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$running = Get-Process Runner.Listener -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$dir*" }
if ($running) { exit 0 }
New-Item -ItemType Directory -Force "$dir\_diag" | Out-Null
"$(Get-Date -Format s) starting the runner" | Add-Content "$dir\_diag\watchdog.log"
Start-Process -FilePath "$dir\run.cmd" -WorkingDirectory $dir -WindowStyle Hidden
'@
Set-Content -Path "$Dir\watchdog.ps1" -Value $watchdog -Encoding ascii
# through wscript, so no window flashes every five minutes
$ps = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$Dir\watchdog.ps1"""
$vbs = 'CreateObject("WScript.Shell").Run "' + $ps.Replace('"', '""') + '", 0, False'
Set-Content -Path "$Dir\watchdog.vbs" -Value $vbs -Encoding ascii
if (Test-Path "$env:WINDIR\System32\wscript.exe") {
  $action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\wscript.exe" -Argument "//B //Nologo ""$Dir\watchdog.vbs"""
} else {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$Dir\watchdog.ps1"""
}
$me = "$env:USERDOMAIN\$env:USERNAME"
$every = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
$description = 'Keeps the GitHub Actions runner for the gen3d and voices workflows running (scripts/desktop/setup-runner.ps1).'
try {
  $logon = New-ScheduledTaskTrigger -AtLogOn -User $me
  Register-ScheduledTask -TaskName $task -Action $action -Trigger @($logon, $every) -Settings $settings -Principal $principal -Description $description -Force -ErrorAction Stop | Out-Null
  Write-Host "scheduled task ${task}: at logon and every 5 minutes"
} catch {
  # a logon trigger can need an administrator; every five minutes covers a logon too
  try {
    Register-ScheduledTask -TaskName $task -Action $action -Trigger $every -Settings $settings -Principal $principal -Description $description -Force -ErrorAction Stop | Out-Null
    Write-Host "scheduled task ${task}: every 5 minutes (a logon trigger needs an administrator here)"
  } catch {
    Write-Host "!! couldn't add the scheduled task ($($_.Exception.Message)): the runner starts now, but not again after a restart. Run this script as an administrator once, or start $Dir\run.cmd yourself." -ForegroundColor Yellow
  }
}

Say 'The old Startup-folder pollers'
$startup = [Environment]::GetFolderPath('Startup')
$retired = "$HOME\.desktop-jobs\retired"
foreach ($f in 'gen3d-runner.vbs', 'voices-runner.vbs') {
  if (Test-Path "$startup\$f") {
    New-Item -ItemType Directory -Force $retired | Out-Null
    Move-Item "$startup\$f" "$retired\$f" -Force
    Write-Host "moved $f to $retired (the runner replaces it)"
  }
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'runner\.mjs.+--watch' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
  Write-Host "stopped an old poller (pid $($_.ProcessId))"
}

Say 'Starting it'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$Dir\watchdog.ps1"
$online = $false
for ($i = 0; $i -lt 30 -and -not $online; $i++) {
  Start-Sleep -Seconds 2
  # (parsed here: Windows PowerShell mangles quotes inside a native command's arguments)
  $runners = gh api "repos/$Repo/actions/runners" | ConvertFrom-Json
  $online = ($runners.runners | Where-Object { $_.name -eq $name }).status -eq 'online'
}
if ($online) { Say "Runner $name is online" } else { Write-Host "!! runner $name isn't online yet: see $Dir\_diag" -ForegroundColor Yellow }

Say 'The doctor'
Push-Location $repoRoot
node scripts\desktop\doctor.mjs
Pop-Location
