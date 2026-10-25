; BV Mudrana setup: asks for the user's name, so BV Mudrana can greet them with Namaste
; and show "<name>'s Mudrana" in the title bar. Saved in HKCU\Software\Brahmavidya\BV Mudrana.
!ifndef BUILD_UNINSTALLER
  !include MUI2.nsh
  !include nsDialogs.nsh
  !include LogicLib.nsh
  Var BVNameDialog
  Var BVNameBox
  Var BVUserName

  !macro customPageAfterChangeDir
    Page custom BVNamePageShow BVNamePageLeave
  !macroend

  Function BVNamePageShow
    ReadRegStr $BVUserName HKCU "Software\Brahmavidya\BV Mudrana" "UserName"
    !insertmacro MUI_HEADER_TEXT "Your name" "BV Mudrana will greet you by this name."
    nsDialogs::Create 1018
    Pop $BVNameDialog
    ${If} $BVNameDialog == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 40u "Namaste! Type your name. Each time BV Mudrana opens it will greet you with $\"Namaste <your name>$\", and the title bar will say $\"<your name>'s Mudrana$\".$\r$\n$\r$\nYou can change it any time in File > Preferences > Your Name. Leave it empty to skip."
    Pop $0
    ${NSD_CreateText} 0 48u 70% 13u "$BVUserName"
    Pop $BVNameBox
    ${NSD_SetFocus} $BVNameBox
    nsDialogs::Show
  FunctionEnd

  Function BVNamePageLeave
    ${NSD_GetText} $BVNameBox $BVUserName
  FunctionEnd

  !macro customInstall
    ${If} $BVUserName != ""
      WriteRegStr HKCU "Software\Brahmavidya\BV Mudrana" "UserName" "$BVUserName"
    ${EndIf}
  !macroend
!endif
