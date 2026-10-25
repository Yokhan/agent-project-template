$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$inputText = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputText) -or $inputText.Length -gt 8192) {
  throw 'Volume identity input must be bounded JSON.'
}
$inputObject = $inputText | ConvertFrom-Json
$inputPath = [string]$inputObject.path
if ([string]::IsNullOrWhiteSpace($inputPath) -or -not [IO.Path]::IsPathRooted($inputPath)) {
  throw 'Volume identity path must be absolute.'
}
if ($inputPath.StartsWith('\\', [StringComparison]::Ordinal)) {
  throw 'UNC paths are unsupported for volume admission.'
}

$nativeSource = @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class StorageVolumeIdentity {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool GetVolumePathName(string fileName, StringBuilder volumePathName, uint bufferLength);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool GetVolumeNameForVolumeMountPoint(string volumeMountPoint, StringBuilder volumeName, uint bufferLength);
}
'@
Add-Type -TypeDefinition $nativeSource -ErrorAction Stop
$mountPath = [Text.StringBuilder]::new(1024)
if (-not [StorageVolumeIdentity]::GetVolumePathName($inputPath, $mountPath, [uint32]$mountPath.Capacity)) {
  throw "GetVolumePathNameW failed for the existing target ancestor. Win32=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}
$volumeName = [Text.StringBuilder]::new(1024)
if (-not [StorageVolumeIdentity]::GetVolumeNameForVolumeMountPoint($mountPath.ToString(), $volumeName, [uint32]$volumeName.Capacity)) {
  throw "GetVolumeNameForVolumeMountPointW failed. Win32=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
}
if ($volumeName.ToString() -notmatch '^\\\\\?\\Volume\{[0-9A-Fa-f-]{36}\}\\$') {
  throw 'Windows volume identity was not a local volume GUID.'
}
[Console]::Out.WriteLine((@{ volumeId = $volumeName.ToString().ToLowerInvariant() } | ConvertTo-Json -Compress))
