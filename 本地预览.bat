@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo    一方天地 · 本地预览(边改边看)
echo ========================================
echo.
echo 启动后,浏览器打开下面显示的地址(通常 http://localhost:4321)
echo 之后你改任何文件、按保存,浏览器会自动刷新。
echo.
echo 看完想关闭:在这个窗口按 Ctrl + C
echo ========================================
echo.

call npm run dev
pause
