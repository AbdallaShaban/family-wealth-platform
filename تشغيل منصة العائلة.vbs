Option Explicit
Dim WshShell, fso, projectDir, candidates, p, batPath

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 1. Check if running directly inside the project root
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 2. If running from Desktop or another location, search canonical candidate paths
If Not fso.FileExists(fso.BuildPath(projectDir, "dist\index.js")) Then
    candidates = Array( _
        "D:\نسخ احتياطى\5\family-wealth-assessment-live", _
        "D:\5\family-wealth-assessment-live", _
        WshShell.ExpandEnvironmentStrings("%USERPROFILE%\family-wealth-system") _
    )
    For Each p In candidates
        If fso.FileExists(fso.BuildPath(p, "dist\index.js")) Then
            projectDir = p
            Exit For
        End If
    Next
End If

' 3. Verify project exists and launch start-server.bat completely hidden
If fso.FileExists(fso.BuildPath(projectDir, "dist\index.js")) Then
    WshShell.CurrentDirectory = projectDir
    batPath = fso.BuildPath(projectDir, "start-server.bat")
    ' 0 = Hide window completely, False = asynchronous non-blocking execution
    WshShell.Run "cmd /c """ & batPath & """", 0, False
Else
    MsgBox "تعذر العثور على مسار مشروع المنصة المالية (dist\index.js)" & vbCrLf & "المسار المتوقع: D:\نسخ احتياطى\5\family-wealth-assessment-live", 16, "منصة العائلة المالية"
End If
