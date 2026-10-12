$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*JagoBridge*' }

if (-not $procs) {
    Write-Output "No JagoBridge node processes found."
} else {
    foreach ($p in $procs) {
        $short = $p.CommandLine
        if ($short.Length -gt 90) { $short = $short.Substring(0, 90) }
        Write-Output ("KILL pid={0} :: {1}" -f $p.ProcessId, $short)
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 3

$still = Get-NetTCPConnection -State Listen -LocalPort 3000,5000 -ErrorAction SilentlyContinue
if ($still) {
    Write-Output "STILL LISTENING:"
    $still | Select-Object LocalPort, OwningProcess | Format-Table -AutoSize | Out-String -Width 120
} else {
    Write-Output "PORTS 3000/5000 FREE"
}
