@echo off
rem Called by the root scripts inside their SETLOCAL environment.
for %%I in ("%~dp0..\..") do set "ZGS_ROOT=%%~fI"
set "TEMP=%ZGS_ROOT%\.runtime\tmp"
set "TMP=%ZGS_ROOT%\.runtime\tmp"
set "SQLITE_TMPDIR=%ZGS_ROOT%\.runtime\tmp"
set "NPM_CONFIG_CACHE=%ZGS_ROOT%\.runtime\npm-cache"
set "NPM_CONFIG_LOGS_DIR=%ZGS_ROOT%\.runtime\npm-logs"
set "NPM_CONFIG_UPDATE_NOTIFIER=false"
set "NODE_COMPILE_CACHE=%ZGS_ROOT%\.runtime\node-compile-cache"
set "PLAYWRIGHT_BROWSERS_PATH=%ZGS_ROOT%\.runtime\browsers"
for %%D in ("%TEMP%" "%NPM_CONFIG_CACHE%" "%NPM_CONFIG_LOGS_DIR%" "%NODE_COMPILE_CACHE%") do if not exist "%%~D" mkdir "%%~D"
set "ZGS_NODE="
if exist "D:\nodejs\node.exe" set "ZGS_NODE=D:\nodejs\node.exe"
if not defined ZGS_NODE for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined ZGS_NODE set "ZGS_NODE=%%N"
if not defined ZGS_NODE (
  echo Node.js 24 is required. Install Node.js or add node.exe to PATH.
  exit /b 1
)
for %%N in ("%ZGS_NODE%") do set "ZGS_NPM_CLI=%%~dpNnode_modules\npm\bin\npm-cli.js"
exit /b 0
