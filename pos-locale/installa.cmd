@echo off
rem ============================================================
rem installa.cmd - il server del POS sul PC del Bistrot, come servizio.
rem
rem Da eseguire UNA volta, come amministratore, dalla cartella pos-locale
rem del repo (o da una copia). Serve Deno installato (https://deno.com).
rem Fa tre cose: compila main.ts in C:\pos\pos-locale.exe, copia la
rem configurazione se manca, e crea l'attivita' pianificata che lo avvia
rem all'accensione del PC. I certificati si fanno prima (certificati.md).
rem ============================================================
setlocal
set DEST=C:\pos
if not exist "%DEST%" mkdir "%DEST%"

echo [1/3] compilo il server...
deno compile --node-modules-dir=none --allow-net --allow-read --allow-write --allow-env --output "%DEST%\pos-locale.exe" main.ts
if errorlevel 1 ( echo compilazione fallita & exit /b 1 )

echo [2/3] configurazione...
if not exist "%DEST%\config.json" (
  copy config.esempio.json "%DEST%\config.json" >nul
  echo   creato %DEST%\config.json: va completato con hotelKey, IP delle stampanti e certificati
)

echo [3/3] attivita' pianificata "POS Bistrot" (all'accensione, come SYSTEM)...
schtasks /delete /tn "POS Bistrot" /f >nul 2>&1
schtasks /create /tn "POS Bistrot" /tr "\"%DEST%\pos-locale.exe\" \"%DEST%\config.json\"" /sc onstart /ru SYSTEM /rl highest /f
if errorlevel 1 ( echo attivita' non creata: aprire il prompt come amministratore & exit /b 1 )

echo.
echo Fatto. Per avviarlo subito:  schtasks /run /tn "POS Bistrot"
echo Per vedere se risponde:      curl -k https://localhost:8443/?a=stato-locale
echo Il firewall di Windows deve lasciare entrare la porta 8443 (TCP) dalla rete dell'hotel.
endlocal
