param([Parameter(Mandatory = $true)][string]$PipeName)
$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ManagedNative {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct STARTUPINFO {
    public Int32 cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public Int32 dwX; public Int32 dwY; public Int32 dwXSize; public Int32 dwYSize;
    public Int32 dwXCountChars; public Int32 dwYCountChars; public Int32 dwFillAttribute;
    public Int32 dwFlags; public Int16 wShowWindow; public Int16 cbReserved2;
    public IntPtr lpReserved2; public IntPtr hStdInput; public IntPtr hStdOutput; public IntPtr hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] public struct PROCESS_INFORMATION { public IntPtr hProcess; public IntPtr hThread; public Int32 dwProcessId; public Int32 dwThreadId; }
  [StructLayout(LayoutKind.Sequential)] public struct BASIC_LIMIT { public Int64 PerProcessUserTimeLimit; public Int64 PerJobUserTimeLimit; public UInt32 LimitFlags; public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize; public UInt32 ActiveProcessLimit; public UIntPtr Affinity; public UInt32 PriorityClass; public UInt32 SchedulingClass; }
  [StructLayout(LayoutKind.Sequential)] public struct IO_COUNTERS { public UInt64 ReadOperationCount; public UInt64 WriteOperationCount; public UInt64 OtherOperationCount; public UInt64 ReadTransferCount; public UInt64 WriteTransferCount; public UInt64 OtherTransferCount; }
  [StructLayout(LayoutKind.Sequential)] public struct EXTENDED_LIMIT { public BASIC_LIMIT BasicLimitInformation; public IO_COUNTERS IoInfo; public UIntPtr ProcessMemoryLimit; public UIntPtr JobMemoryLimit; public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed; }
  [StructLayout(LayoutKind.Sequential)] public struct ACCOUNTING { public Int64 TotalUserTime; public Int64 TotalKernelTime; public Int64 ThisPeriodTotalUserTime; public Int64 ThisPeriodTotalKernelTime; public UInt32 TotalPageFaultCount; public UInt32 TotalProcesses; public UInt32 ActiveProcesses; public UInt32 TotalTerminatedProcesses; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetInformationJobObject(IntPtr job, Int32 infoClass, ref EXTENDED_LIMIT info, UInt32 length);
  [DllImport("kernel32.dll", EntryPoint="QueryInformationJobObject", SetLastError=true)] public static extern bool QueryExtendedJobInformation(IntPtr job, Int32 infoClass, out EXTENDED_LIMIT info, UInt32 length, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(UInt32 access, bool inherit, UInt32 processId);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool CreateProcess(string app, StringBuilder command, IntPtr procAttrs, IntPtr threadAttrs, bool inherit, UInt32 flags, IntPtr env, string cwd, ref STARTUPINFO startup, out PROCESS_INFORMATION info);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern UInt32 WaitForSingleObject(IntPtr handle, UInt32 ms);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetExitCodeProcess(IntPtr process, out UInt32 code);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateJobObject(IntPtr job, UInt32 code);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateProcess(IntPtr process, UInt32 code);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool QueryInformationJobObject(IntPtr job, Int32 infoClass, out ACCOUNTING info, UInt32 length, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern UInt32 ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr GetStdHandle(Int32 kind);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetHandleInformation(IntPtr handle, UInt32 mask, UInt32 flags);
}
'@
Add-Type -TypeDefinition $source

function Send($stream, $value) {
  $line = (ConvertTo-Json -InputObject $value -Compress -Depth 100) + "`n"
  $bytes = [Text.Encoding]::UTF8.GetBytes($line)
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
}
function Read-Line($reader) {
  $line = $reader.ReadLine()
  if ($null -eq $line) { throw 'control pipe disconnected' }
  return ($line | ConvertFrom-Json)
}
function Quote-Argument([string]$value) {
  if ($value.Length -gt 0 -and $value -notmatch '[\s"]') { return $value }
  $builder = [Text.StringBuilder]::new('"')
  $slashes = 0
  foreach ($character in $value.ToCharArray()) {
    if ($character -eq '\') { $slashes++; continue }
    if ($character -eq '"') {
      [void]$builder.Append((('\' * (2 * $slashes + 1)) -join '')).Append('"')
      $slashes = 0
      continue
    }
    [void]$builder.Append((('\' * $slashes) -join '')).Append($character)
    $slashes = 0
  }
  [void]$builder.Append((('\' * (2 * $slashes)) -join '')).Append('"')
  return $builder.ToString()
}
function Win32-Error([string]$operation) { throw "$operation failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }

$pipe = [IO.Pipes.NamedPipeClientStream]::new('.', $PipeName, [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
$pipe.Connect(15000)
$reader = [IO.StreamReader]::new($pipe, [Text.Encoding]::UTF8, $false, 1024, $true)
$writer = [IO.StreamWriter]::new($pipe, [Text.Encoding]::UTF8, 1024, $true)
$writer.AutoFlush = $true
$job = [ManagedNative]::CreateJobObject([IntPtr]::Zero, $null)
if ($job -eq [IntPtr]::Zero) { Win32-Error 'CreateJobObject' }
$processInfo = [ManagedNative+PROCESS_INFORMATION]::new()
$ownerProcess = [IntPtr]::Zero
$assigned = $false
$rootInJob = $false
$killOnCloseEnabled = $false
$started = $false
$exitCode = $null
$commandSignal = $null
try {
  $request = Read-Line $reader
  if ($request.type -ne 'launch') { throw 'expected launch request' }
  if ($request.ownerPid -lt 1) { throw 'launch request is missing its owner process id' }
  $ownerProcess = [ManagedNative]::OpenProcess(0x00100000, $false, [uint32]$request.ownerPid) # SYNCHRONIZE
  if ($ownerProcess -eq [IntPtr]::Zero) { Win32-Error 'OpenProcess(owner)' }
  $basicLimit = [ManagedNative+BASIC_LIMIT]::new()
  $basicLimit.LimitFlags = 0x00002000 # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
  $extended = [ManagedNative+EXTENDED_LIMIT]::new()
  $extended.BasicLimitInformation = $basicLimit
  if (-not [ManagedNative]::SetInformationJobObject($job, 9, [ref]$extended, [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][ManagedNative+EXTENDED_LIMIT]))) { Win32-Error 'SetInformationJobObject' }
  $verifiedLimits = [ManagedNative+EXTENDED_LIMIT]::new()
  if (-not [ManagedNative]::QueryExtendedJobInformation($job, 9, [ref]$verifiedLimits, [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][ManagedNative+EXTENDED_LIMIT]), [IntPtr]::Zero)) { Win32-Error 'QueryInformationJobObject(extended limits)' }
  if (($verifiedLimits.BasicLimitInformation.LimitFlags -band 0x00002000) -eq 0) { throw 'Job Object did not enable JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE' }
  $killOnCloseEnabled = $true

  $application = [string]$request.command
  $arguments = @($request.args | ForEach-Object { Quote-Argument ([string]$_) })
  $commandLine = (Quote-Argument $application) + $(if ($arguments.Count) { ' ' + ($arguments -join ' ') } else { '' })
  $environment = @{}
  foreach ($entry in $request.env.PSObject.Properties) { $environment[[string]$entry.Name] = [string]$entry.Value }
  $envLines = @($environment.Keys | Sort-Object | ForEach-Object { "$_=$($environment[$_])" })
  $envText = ($envLines -join "`0") + "`0`0"
  $envPtr = [Runtime.InteropServices.Marshal]::StringToHGlobalUni($envText)
  try {
    $startup = [ManagedNative+STARTUPINFO]::new()
    $startup.cb = [Runtime.InteropServices.Marshal]::SizeOf([type][ManagedNative+STARTUPINFO])
    $startup.dwFlags = 0x00000100 # STARTF_USESTDHANDLES
    $startup.hStdInput = [ManagedNative]::GetStdHandle(-10)
    $startup.hStdOutput = [ManagedNative]::GetStdHandle(-11)
    $startup.hStdError = [ManagedNative]::GetStdHandle(-12)
    foreach ($handle in @($startup.hStdInput, $startup.hStdOutput, $startup.hStdError)) {
      if ($handle -ne [IntPtr]::Zero) { [void][ManagedNative]::SetHandleInformation($handle, 1, 1) }
    }
    $processInfo = [ManagedNative+PROCESS_INFORMATION]::new()
    $mutableLine = [Text.StringBuilder]::new($commandLine)
    $flags = [uint32](0x00000004 -bor 0x00000400) # CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT
    if (-not [ManagedNative]::CreateProcess($application, $mutableLine, [IntPtr]::Zero, [IntPtr]::Zero, $true, $flags, $envPtr, [string]$request.cwd, [ref]$startup, [ref]$processInfo)) { Win32-Error 'CreateProcess' }
  } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($envPtr) }

  if (-not [ManagedNative]::AssignProcessToJobObject($job, $processInfo.hProcess)) {
    $failure = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [void][ManagedNative]::TerminateJobObject($job, 125)
    throw "AssignProcessToJobObject failed with Win32 error $failure"
  }
  $assigned = $true
  if (-not [ManagedNative]::IsProcessInJob($processInfo.hProcess, $job, [ref]$rootInJob)) { Win32-Error 'IsProcessInJob' }
  if (-not $rootInJob) { throw 'Created process is not a member of its assigned Job Object' }
  $started = $true
  Send $pipe @{ type = 'spawn'; pid = $processInfo.dwProcessId; hostPid = $PID; rootInJob = $rootInJob; killOnClose = $killOnCloseEnabled }
  $decisionTask = $reader.ReadLineAsync()
  $ownerExited = $false
  while (-not $decisionTask.IsCompleted) {
    if ([ManagedNative]::WaitForSingleObject($ownerProcess, 0) -eq 0) { $ownerExited = $true; break }
    Start-Sleep -Milliseconds 25
  }
  if ($ownerExited) { [void][ManagedNative]::TerminateJobObject($job, 125); $commandSignal = 'SIGTERM'; throw 'owner process exited before launch confirmation' }
  $decisionLine = $decisionTask.GetAwaiter().GetResult()
  if ($null -eq $decisionLine) { [void][ManagedNative]::TerminateJobObject($job, 125); throw 'control pipe disconnected before launch confirmation' }
  $decision = $decisionLine | ConvertFrom-Json
  if ($decision.type -ne 'go') {
    [void][ManagedNative]::TerminateJobObject($job, 125)
    $commandSignal = 'SIGTERM'
    $rootStopped = ([ManagedNative]::WaitForSingleObject($processInfo.hProcess, 5000) -eq 0)
  }
  else {
    if ([ManagedNative]::WaitForSingleObject($ownerProcess, 0) -eq 0) {
      [void][ManagedNative]::TerminateJobObject($job, 125)
      $commandSignal = 'SIGTERM'
      $rootStopped = ([ManagedNative]::WaitForSingleObject($processInfo.hProcess, 5000) -eq 0)
    }
    if (-not $commandSignal) {
    $resumeResult = [ManagedNative]::ResumeThread($processInfo.hThread)
    if ($resumeResult -eq [uint32]::MaxValue) { Win32-Error 'ResumeThread' }
    [void][ManagedNative]::CloseHandle($processInfo.hThread)
    $processInfo.hThread = [IntPtr]::Zero
    $cancelTask = $reader.ReadLineAsync()
    $processEnded = $false
    while (-not $processEnded) {
      $waitStatus = [ManagedNative]::WaitForSingleObject($processInfo.hProcess, 100)
      if ($waitStatus -eq 0) { $processEnded = $true; break }
      if ($waitStatus -ne 258) { Win32-Error 'WaitForSingleObject' }
      if ([ManagedNative]::WaitForSingleObject($ownerProcess, 0) -eq 0) {
        [void][ManagedNative]::TerminateJobObject($job, 125)
        $commandSignal = 'SIGTERM'
        break
      }
      if ($cancelTask.IsCompleted) {
        $cancelLine = $cancelTask.GetAwaiter().GetResult()
        if ($null -eq $cancelLine) {
          [void][ManagedNative]::TerminateJobObject($job, 125)
          $commandSignal = 'SIGTERM'
          break
        }
        $cancelMessage = $cancelLine | ConvertFrom-Json
        if ($cancelMessage.type -eq 'cancel') {
          [void][ManagedNative]::TerminateJobObject($job, 125)
          $commandSignal = 'SIGTERM'
          break
        }
        $cancelTask = $reader.ReadLineAsync()
      }
    }
    if (-not $commandSignal) {
      $nativeCode = [uint32]0
      if (-not [ManagedNative]::GetExitCodeProcess($processInfo.hProcess, [ref]$nativeCode)) { Win32-Error 'GetExitCodeProcess' }
      $exitCode = [int]$nativeCode
    } else {
      $rootWait = [ManagedNative]::WaitForSingleObject($processInfo.hProcess, 5000)
      if ($rootWait -ne 0) { [void][ManagedNative]::TerminateProcess($processInfo.hProcess, 125); $rootWait = [ManagedNative]::WaitForSingleObject($processInfo.hProcess, 1000) }
      $rootStopped = ($rootWait -eq 0)
    }
    }
  }

  $accounting = [ManagedNative+ACCOUNTING]::new()
  if (-not [ManagedNative]::QueryInformationJobObject($job, 1, [ref]$accounting, [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][ManagedNative+ACCOUNTING]), [IntPtr]::Zero)) { Win32-Error 'QueryInformationJobObject' }
  if ($accounting.ActiveProcesses -gt 0) {
    [void][ManagedNative]::TerminateJobObject($job, 125)
    [void][ManagedNative]::WaitForSingleObject($job, 5000)
  }
  $accounting = [ManagedNative+ACCOUNTING]::new()
  if (-not [ManagedNative]::QueryInformationJobObject($job, 1, [ref]$accounting, [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][ManagedNative+ACCOUNTING]), [IntPtr]::Zero)) { Win32-Error 'QueryInformationJobObject' }
  if ($processInfo.hProcess -ne [IntPtr]::Zero -and -not $rootStopped) { $rootStopped = ([ManagedNative]::WaitForSingleObject($processInfo.hProcess, 0) -eq 0) }
  $stopped = ($accounting.ActiveProcesses -eq 0 -and $rootInJob -and $rootStopped)
  Send $pipe @{ type = 'result'; code = $exitCode; signal = $commandSignal; treeStopped = $stopped; proof = "job-active-processes:$($accounting.ActiveProcesses);root-in-job:$rootInJob;root-stopped:$rootStopped;kill-on-close:$killOnCloseEnabled"; rootInJob = $rootInJob; killOnClose = $killOnCloseEnabled; aborted = ($commandSignal -ne $null) }
} catch {
  if ($job -ne [IntPtr]::Zero) { [void][ManagedNative]::TerminateJobObject($job, 125) }
  $stopped = ($processInfo.hProcess -eq [IntPtr]::Zero)
  if ($processInfo.hProcess -ne [IntPtr]::Zero -and -not $assigned) {
    [void][ManagedNative]::TerminateProcess($processInfo.hProcess, 125)
    $stopped = ([ManagedNative]::WaitForSingleObject($processInfo.hProcess, 5000) -eq 0)
  } elseif ($assigned -and $job -ne [IntPtr]::Zero) {
    $stopped = $false
    $cleanupTimer = [Diagnostics.Stopwatch]::StartNew()
    while ($cleanupTimer.ElapsedMilliseconds -lt 5000) {
      $accounting = [ManagedNative+ACCOUNTING]::new()
      if (-not [ManagedNative]::QueryInformationJobObject($job, 1, [ref]$accounting, [uint32][Runtime.InteropServices.Marshal]::SizeOf([type][ManagedNative+ACCOUNTING]), [IntPtr]::Zero)) { break }
      if ($accounting.ActiveProcesses -eq 0) { $stopped = $true; break }
      Start-Sleep -Milliseconds 25
    }
    if ($processInfo.hProcess -ne [IntPtr]::Zero) {
      $rootStopped = ([ManagedNative]::WaitForSingleObject($processInfo.hProcess, 0) -eq 0)
      if (-not $rootStopped) { [void][ManagedNative]::TerminateProcess($processInfo.hProcess, 125); $rootStopped = ([ManagedNative]::WaitForSingleObject($processInfo.hProcess, 1000) -eq 0) }
      $stopped = $stopped -and $rootInJob -and $rootStopped
    }
  }
  try { Send $pipe @{ type = 'result'; code = $exitCode; signal = $commandSignal; treeStopped = $stopped; proof = "supervisor-error;root-in-job:$rootInJob;kill-on-close:$killOnCloseEnabled"; rootInJob = $rootInJob; killOnClose = $killOnCloseEnabled; error = $_.Exception.Message } } catch { }
} finally {
  if ($processInfo.hThread -ne [IntPtr]::Zero) { [void][ManagedNative]::CloseHandle($processInfo.hThread) }
  if ($processInfo.hProcess -ne [IntPtr]::Zero) { [void][ManagedNative]::CloseHandle($processInfo.hProcess) }
  if ($job -ne [IntPtr]::Zero) { [void][ManagedNative]::CloseHandle($job) }
  if ($ownerProcess -ne [IntPtr]::Zero) { [void][ManagedNative]::CloseHandle($ownerProcess) }
  $pipe.Dispose()
}
