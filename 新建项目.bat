@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo    一方天地 · 新建项目
echo ========================================
echo.

call npm run new:project

echo.
echo 已写入 src\data\content\projects.json
echo.
pause
