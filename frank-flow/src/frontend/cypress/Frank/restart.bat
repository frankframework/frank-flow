call ..\..\..\..\..\..\frank-runner\ant.bat
if %errorlevel% equ 0 goto end
rem https://superuser.com/questions/527898/how-to-pause-only-if-executing-in-a-new-window
set arg0=%0
if [%arg0:~2,1%]==[:] if not [%TERM_PROGRAM%] == [vscode] pause
:end
