@echo off
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set PY=py -3

REM === 你的 GCS 目標（已替你帶入） ===
set GCS_BUCKET=*yourbucket*
set GCS_PREFIX=md/zh-Hant/

%PY% "%ROOT%scripts\xml_to_md.py" ^
  --in  "%ROOT%data\xml\zh-Hant" ^
  --out "%ROOT%data\md\zh-Hant" ^
  --log "%ROOT%logs\convert_zh-Hant.log" ^
  --clean ^
  --gcs-bucket %GCS_BUCKET% ^
  --gcs-prefix %GCS_PREFIX% ^
  --gcs-delete-existing

echo All done.
pause
