@echo off
echo NexoWatt EOS 1.0.38 Security Review - Sicherheits-und-Funktions-Teststand - npm-Paketpruefungen werden ausgefuehrt.
echo Der Upload ersetzt keine Produktivfreigabe; siehe release-manifests/release-status.json.
call npm publish --tag test
if errorlevel 1 exit /b 1
pause
