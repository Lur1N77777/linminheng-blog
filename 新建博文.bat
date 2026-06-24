@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo    LinMinheng · 新建博文
echo ========================================
echo.
echo 按提示填写标题、标签、摘要。
echo 脚本会自动生成 Markdown 文件,不用手写模板。
echo.

call npm run new:post

echo.
echo 完成后打开 src\content\blog 里的新文件,直接写正文即可。
echo.
pause
