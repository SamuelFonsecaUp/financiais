Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.CurrentDirectory & "\release\win-unpacked\Meu Financeiro.exe"
WshShell.Run Chr(34) & strPath & Chr(34), 1, False
