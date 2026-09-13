@echo off
title Meu Financeiro
chcp 65001 > nul

set "EXE_PATH=%~dp0release\win-unpacked\Meu Financeiro.exe"

if exist "%EXE_PATH%" (
    echo Iniciando Meu Financeiro...
    start "" "%EXE_PATH%"
    exit /b 0
) else (
    echo Executavel nao encontrado em:
    echo "%EXE_PATH%"
    echo.
    echo Compilando o aplicativo pela primeira vez...
    echo Aguarde alguns instantes...
    cd /d "%~dp0"
    call npm run build
    call npm run pack
    if exist "%EXE_PATH%" (
        echo Iniciando Meu Financeiro...
        start "" "%EXE_PATH%"
        exit /b 0
    ) else (
        echo.
        echo Ocorreu um erro ao gerar o executavel.
        pause
        exit /b 1
    )
)
