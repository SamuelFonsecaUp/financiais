@echo off
chcp 65001 >nul
title Meu Financeiro - Gerador de Build (buildapropai)
cls
color 0B

echo ========================================================
echo   🚀 MEU FINANCEIRO - COMPILADOR AUTOMATICO (PRO PAI) 🚀
echo ========================================================
echo.

echo [1/4] Fechando instancias abertas do app (para evitar conflito de arquivo)...
taskkill /F /IM "Meu Financeiro.exe" >nul 2>&1

echo.
echo [2/4] Compilando Frontend (React + Vite + Tailwind)...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ❌ ERRO: A compilacao do Vite falhou! Verifique os erros acima.
    echo.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/4] Empacotando executaveis (.exe) com Electron Builder...
call npm run dist
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ❌ ERRO: O empacotamento com Electron Builder falhou!
    echo.
    pause
    exit /b %errorlevel%
)

color 0A
echo.
echo ========================================================
echo   ✅ SUCESSO TOTAL! Executavel gerado na pasta release/
echo ========================================================
echo.
echo Abrindo a pasta com os instaladores gerados...
if exist "release" start release
echo.
pause
