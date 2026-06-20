@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo    一方天地 · 新建站点
echo ========================================
echo.

call npm run new:site

echo.
echo 已写入 src\data\content\sites.json
echo.
pause
