; BV Mudrana Update: updates an installed BV Mudrana in place.
; It replaces only the program files that change between versions (resources\app.asar and
; resources\app.asar.unpacked). Settings, recent files, autosaves, shortcuts and file
; associations stay as they are. Built by build/make-update.sh with the version defines.
Unicode true
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"

!ifndef VERSION
  !error "VERSION must be defined"
!endif
!define PRODUCT "BV Mudrana"
!define APP_GUID "0e8115ba-82fc-58ba-9e0d-fc41d2ebe0d7"
!define INSTALL_KEY "Software\${APP_GUID}"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_GUID}"
!define EXE "BV Mudrana.exe"

Name "${PRODUCT} ${VERSION} Update"
Caption "Updating ${PRODUCT} to ${VERSION}"
OutFile "${OUTFILE}"
Icon "icon.ico"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
AutoCloseWindow false
BrandingText "Brahmavidya"
XPStyle on
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${PRODUCT} Update"
VIAddVersionKey "FileDescription" "Updates an installed ${PRODUCT} to ${VERSION}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Brahmavidya"
VIAddVersionKey "CompanyName" "Brahmavidya"

Page instfiles

Var Root       ; HKCU or HKLM, where BV Mudrana is registered
Var OldVer
Var Silent

Function .onInit
  ${GetParameters} $0
  ${GetOptions} $0 "/S" $1
  ${IfNot} ${Errors}
    StrCpy $Silent 1
  ${EndIf}

  ; where is BV Mudrana installed?
  StrCpy $Root "HKCU"
  ReadRegStr $INSTDIR HKCU "${INSTALL_KEY}" "InstallLocation"
  ${If} $INSTDIR == ""
    ReadRegStr $INSTDIR HKLM "${INSTALL_KEY}" "InstallLocation"
    StrCpy $Root "HKLM"
  ${EndIf}
  ${If} $INSTDIR == ""
  ${OrIfNot} ${FileExists} "$INSTDIR\${EXE}"
    ${If} ${FileExists} "$LOCALAPPDATA\Programs\BV Mudrana\${EXE}"
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\BV Mudrana"
      StrCpy $Root "HKCU"
    ${ElseIf} ${FileExists} "$LOCALAPPDATA\Programs\bv-mudrana\${EXE}"
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\bv-mudrana"
      StrCpy $Root "HKCU"
    ${ElseIf} ${FileExists} "$PROGRAMFILES64\BV Mudrana\${EXE}"
      StrCpy $INSTDIR "$PROGRAMFILES64\BV Mudrana"
      StrCpy $Root "HKLM"
    ${Else}
      MessageBox MB_ICONEXCLAMATION "${PRODUCT} is not installed on this computer.$\r$\n$\r$\nPlease install it once with the full setup (BV Mudrana Setup ${VERSION}.exe). After that, updates like this one install on top of it." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}

  ; the version that is installed now
  ${If} $Root == "HKLM"
    ReadRegStr $OldVer HKLM "${UNINSTALL_KEY}" "DisplayVersion"
  ${Else}
    ReadRegStr $OldVer HKCU "${UNINSTALL_KEY}" "DisplayVersion"
  ${EndIf}
  ${If} $OldVer != ""
    ${VersionCompare} "$OldVer" "${VERSION}" $2
    ${If} $2 == 1
      MessageBox MB_YESNO|MB_ICONQUESTION "A newer ${PRODUCT} ($OldVer) is already installed.$\r$\n$\r$\nReplace it with ${VERSION}?" /SD IDNO IDYES +2
      Abort
    ${EndIf}
  ${EndIf}

  ; this update carries only the program, not the Electron runtime: the runtime must match
  ${If} ${FileExists} "$INSTDIR\resources\bvm-runtime.txt"
    FileOpen $3 "$INSTDIR\resources\bvm-runtime.txt" r
    FileRead $3 $4
    FileClose $3
    ${If} $4 != "${RUNTIME}"
      MessageBox MB_ICONEXCLAMATION "This update needs a newer ${PRODUCT} engine than the one installed ($4).$\r$\n$\r$\nPlease run the full setup, BV Mudrana Setup ${VERSION}.exe, once. It installs over your current version and keeps your settings." /SD IDOK
      Abort
    ${EndIf}
  ${EndIf}

  ; installed for all users (Program Files): writing there needs administrator rights
  ClearErrors
  FileOpen $5 "$INSTDIR\resources\.bvm-write-test" w
  ${If} ${Errors}
    ${If} $Silent != 1
      ExecShell "runas" "$EXEPATH"
    ${EndIf}
    Abort
  ${EndIf}
  FileClose $5
  Delete "$INSTDIR\resources\.bvm-write-test"
FunctionEnd

Function CloseApp
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ${EXE}" /NH'
  Pop $0
  Pop $1
  StrCpy $2 "${EXE}"
  StrLen $3 $2
  StrCpy $4 0
  loop:
    StrCpy $5 $1 $3 $4
    StrCmp $5 "" notRunning
    StrCmp $5 $2 running
    IntOp $4 $4 + 1
    Goto loop
  running:
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION "${PRODUCT} is open.$\r$\n$\r$\nSave your work, then click OK. BV Mudrana will close, update and open again." /SD IDOK IDOK +2
    Abort
    DetailPrint "Closing ${PRODUCT}..."
    nsExec::Exec 'taskkill /IM "${EXE}"'
    Sleep 2500
    nsExec::Exec 'taskkill /F /IM "${EXE}"'
    Sleep 800
  notRunning:
FunctionEnd

Section "Update"
  DetailPrint "${PRODUCT} is installed in $INSTDIR"
  ${If} $OldVer != ""
    DetailPrint "Updating from $OldVer to ${VERSION}"
  ${EndIf}
  Call CloseApp

  ; keep the old program until the new one is in place
  SetOutPath "$INSTDIR\resources"
  Delete "$INSTDIR\resources\app.asar.old"
  Rename "$INSTDIR\resources\app.asar" "$INSTDIR\resources\app.asar.old"
  ClearErrors
  File "/oname=app.asar" "${APPDIR}\resources\app.asar"
  ${If} ${Errors}
    Rename "$INSTDIR\resources\app.asar.old" "$INSTDIR\resources\app.asar"
    MessageBox MB_ICONSTOP "The update could not be written to $INSTDIR. Close ${PRODUCT} and try again." /SD IDOK
    Abort
  ${EndIf}
  Delete "$INSTDIR\resources\app.asar.old"
  RMDir /r "$INSTDIR\resources\app.asar.unpacked"
  SetOutPath "$INSTDIR\resources\app.asar.unpacked"
  File /r "${APPDIR}\resources\app.asar.unpacked\*.*"
  SetOutPath "$INSTDIR\resources"
  File "${APPDIR}\resources\bvm-runtime.txt"

  ; Windows' list of installed programs shows the new version
  ${If} $Root == "HKLM"
    WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  ${Else}
    WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  ${EndIf}
  DetailPrint "${PRODUCT} is now version ${VERSION}. Your settings, recent files and shortcuts are unchanged."
SectionEnd

Function .onInstSuccess
  ${If} $Silent != 1
    Exec '"$INSTDIR\${EXE}"'
  ${EndIf}
FunctionEnd
