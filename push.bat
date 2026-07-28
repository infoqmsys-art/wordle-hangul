@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === Git Push ===
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Not a git repository.
  pause
  exit /b 1
)

git status
echo.

set "MSG="
set /p "MSG=Commit message: "
if not defined MSG set "MSG=Update game"

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo No changes to commit.
  echo.
  pause
  exit /b 0
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo Commit failed.
  echo.
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo.
  echo Push failed.
  echo.
  pause
  exit /b 1
)

echo.
echo Push done. GitHub Pages updates in about 1-2 minutes.
echo https://infoqmsys-art.github.io/wordle-hangul/
echo.
pause
endlocal
