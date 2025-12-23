@echo off
echo ========================================
echo    Little Bear Game Server
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

echo Starting server...
echo.
echo Open your browser to: http://localhost:3000
echo.
echo NOTE: You need PostgreSQL running locally
echo or set DATABASE_URL in .env file
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

npm start
