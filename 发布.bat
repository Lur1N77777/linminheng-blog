@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ========================================
echo    一方天地 · 一键发布到线上
echo ========================================
echo.

echo [1/2] 正在构建网站...
call npm run build
if errorlevel 1 (
  echo.
  echo X 构建失败!请检查上面的报错信息。
  echo    通常是某个 .ts 文件的引号或逗号删错了。
  pause
  exit /b 1
)

echo.
echo [2/2] 正在上传到 Cloudflare...
call npx wrangler pages deploy dist --project-name=linminheng-blog --branch=main
if errorlevel 1 (
  echo.
  echo X 上传失败!可能是网络问题,请检查梯子是否开着,然后重试。
  pause
  exit /b 1
)

echo.
echo ========================================
echo    发布成功!
echo    等 1-2 分钟后刷新 https://blog.loven7.com
echo ========================================
echo.
pause
