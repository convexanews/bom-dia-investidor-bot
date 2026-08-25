@echo off
setlocal
cd /d "%~dp0"
echo Preparando narracao, conversao MP4 e dependencias do BDI Studio...
call npm install
if errorlevel 1 (
  echo.
  echo Nao foi possivel instalar as dependencias. Verifique sua conexao e o Node.js.
  pause
  exit /b 1
)
echo.
echo Studio preparado. Agora use abrir-studio.cmd.
pause
endlocal
