Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\حسن بطايحا\5\family-wealth-assessment-live"
WshShell.Run "cmd /c node dist/index.js", 0, False
WScript.Sleep 2000
WshShell.Run "http://localhost:3000"