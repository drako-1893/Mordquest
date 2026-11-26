@echo off
setlocal
cd /d "%~dp0" || goto :failed
title Assoku - Servidor local

set "ASSOKU_URL=http://127.0.0.1:8000/niveles.html"
echo Assoku: %ASSOKU_URL%

powershell.exe -NoProfile -Command "try { $page = Invoke-WebRequest -UseBasicParsing $env:ASSOKU_URL -TimeoutSec 2; if ($page.Content.Contains('level-grid')) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo El servidor ya esta en marcha.
    pause
    exit /b 0
)

if exist ".venv\vendor\uvicorn" set "PYTHONPATH=%CD%\.venv\vendor;%PYTHONPATH%"

set "ASSOKU_PYTHON="
call :probe "%CD%\.venv\Scripts\python.exe"
call :probe python.exe
call :probe py.exe
if not defined ASSOKU_PYTHON (
    for /f "delims=" %%P in ('powershell.exe -NoProfile -Command "$node = Get-Command node.exe -ErrorAction SilentlyContinue; if ($node) { [IO.Path]::GetFullPath((Join-Path (Split-Path $node.Source) '../../python/python.exe')) }"') do (
        if exist "%%P" call :probe "%%P"
    )
)
if not defined ASSOKU_PYTHON (
    echo No se encontro Python con las dependencias de Assoku.
    echo Instala Python 3.10 o superior y ejecuta: python -m pip install -r requirements.txt
    goto :failed
)

echo Presiona Ctrl+C para detener el servidor.
"%ASSOKU_PYTHON%" -m uvicorn backend:app --host 127.0.0.1 --port 8000
if errorlevel 1 goto :failed
exit /b 0

:probe
if defined ASSOKU_PYTHON exit /b 0
"%~1" -c "import sys, fastapi, uvicorn; sys.exit(sys.version_info < (3, 10))" >nul 2>&1
if not errorlevel 1 set "ASSOKU_PYTHON=%~1"
exit /b 0

:failed
echo No se pudo iniciar el servidor local.
pause
exit /b 1
