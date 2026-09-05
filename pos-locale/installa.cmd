@echo off
rem ============================================================
rem installa.cmd - il POS sul PC del Bistrot, in un colpo solo.
rem
rem Da eseguire come amministratore (tasto destro, «Esegui come
rem amministratore») dalla cartella «POS Bistrot» di OneDrive, o da una
rem copia su chiavetta. Non serve installare niente: la cartella ha dentro
rem deno.exe (firmato), i sorgenti del server e la pagina del POS (la fa
rem `node strumenti/pacchetto-bistrot.js` dal repo). Rieseguirlo aggiorna
rem tutto senza toccare la configurazione.
rem
rem Fa: copia in C:\pos, chiede la chiave hotel la prima volta, apre la
rem porta 8080 nel firewall, crea l'attivita' «POS Bistrot» che parte
rem all'accensione, la avvia, e scrive il link da aprire sui palmari.
rem Niente certificati: la pagina la serve questo PC in http, e i
rem palmari la aprono da qui (5 settembre 2026).
rem ============================================================
setlocal EnableDelayedExpansion
set DEST=C:\pos
set PORTA=8080

net session >nul 2>&1
if errorlevel 1 (
  echo Va eseguito come amministratore: tasto destro sul file, «Esegui come amministratore».
  pause
  exit /b 1
)
if not exist "%DEST%" mkdir "%DEST%"

echo [1/5] copio deno.exe, server e pagina in %DEST%...
schtasks /end /tn "POS Bistrot" >nul 2>&1
taskkill /im deno.exe /f >nul 2>&1
copy /y "%~dp0deno.exe" "%DEST%\deno.exe" >nul
if errorlevel 1 ( echo   copia di deno.exe fallita: manca accanto a questo file? & pause & exit /b 1 )
robocopy "%~dp0src" "%DEST%\src" /MIR /NFL /NDL /NJH /NJS >nul
if errorlevel 8 ( echo   copia del server fallita & pause & exit /b 1 )
robocopy "%~dp0pagina" "%DEST%\pagina" /MIR /NFL /NDL /NJH /NJS >nul
if errorlevel 8 ( echo   copia della pagina fallita & pause & exit /b 1 )

echo [2/5] configurazione...
if not exist "%DEST%\config.json" (
  echo.
  echo   Incolli la CHIAVE HOTEL ^(quella del pannello dell'estensione della reception^) e prema Invio:
  set /p HOTELKEY=  chiave hotel:
  (
    echo {
    echo   "locale": "bistrot",
    echo   "porta": %PORTA%,
    echo   "db": "C:\\pos\\pos.sqlite",
    echo   "pagina": "C:\\pos\\pagina",
    echo   "cloud": "https://mvuiuwakuseockotlcnp.supabase.co/functions/v1/pos",
    echo   "hotelKey": "!HOTELKEY!",
    echo   "stampanti": { "cucina": "192.168.0.192:9100", "bar": "192.168.0.191:9100" }
    echo }
  ) > "%DEST%\config.json"
  echo   scritto %DEST%\config.json
) else (
  echo   %DEST%\config.json c'e' gia': lo lascio com'e'.
)

echo [3/5] firewall: porta %PORTA% aperta dalla rete dell'hotel...
netsh advfirewall firewall delete rule name="POS Bistrot" >nul 2>&1
netsh advfirewall firewall add rule name="POS Bistrot" dir=in action=allow protocol=TCP localport=%PORTA% >nul

echo [4/5] attivita' "POS Bistrot": parte da sola all'accensione...
schtasks /delete /tn "POS Bistrot" /f >nul 2>&1
schtasks /create /tn "POS Bistrot" /tr "\"%DEST%\deno.exe\" run --node-modules-dir=none --no-prompt --allow-net --allow-read --allow-write --allow-env \"%DEST%\src\pos-locale\main.ts\" \"%DEST%\config.json\"" /sc onstart /ru SYSTEM /rl highest /f >nul
if errorlevel 1 ( echo   attivita' non creata & pause & exit /b 1 )
schtasks /run /tn "POS Bistrot" >nul

echo [5/5] provo se risponde (la prima volta ci mette qualche secondo)...
timeout /t 8 /nobreak >nul
curl -s http://localhost:%PORTA%/?a=stato-locale
echo.
echo.
echo ======================================================================
echo  Sui palmari, in Chrome, aprire uno di questi indirizzi:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set IP=%%a
  set IP=!IP: =!
  echo      http://!IP!:%PORTA%/pos
)
echo  poi scrivere il codice del palmare (otto caratteri, dal back office,
echo  scheda «POS · Personale») e in Chrome «Aggiungi a schermata Home».
echo.
echo  Questo PC deve avere l'IP FISSO (si riserva nel router): se cambia,
echo  i palmari non lo trovano piu'.
echo ======================================================================
pause
endlocal
