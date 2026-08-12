@echo off
cd /d "%~dp0"
node.exe server.js
if errorlevel 1 pause
