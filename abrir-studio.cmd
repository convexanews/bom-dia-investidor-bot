@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root='%~dp0'; $chosen=$null; $running=$false; foreach($port in 4310..4319){ try{$health=Invoke-RestMethod -TimeoutSec 1 ('http://127.0.0.1:'+ $port +'/api/health'); if($health.version -eq '2.0'){$chosen=$port;$running=$true;break} }catch{ try{$listener=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop}catch{$chosen=$port;break} } }; if($null -eq $chosen){Write-Host 'As portas 4310 a 4319 estao ocupadas.';Read-Host 'Pressione Enter';exit 1}; if(-not $running){$env:STUDIO_PORT=$chosen;Start-Process -FilePath node -ArgumentList 'studio-server.cjs' -WorkingDirectory $root -WindowStyle Hidden;Start-Sleep -Seconds 2}; Start-Process ('http://127.0.0.1:'+ $chosen +'/painel/')"
endlocal
