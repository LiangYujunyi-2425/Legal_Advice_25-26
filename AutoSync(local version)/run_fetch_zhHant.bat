@echo off
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set PY=py -3
%PY% "%ROOT%scripts\fetch_hkel.py" ^
  --lang zh-Hant ^
  --out "%ROOT%data\xml\zh-Hant" ^
  --list-url https://resource.data.one.gov.hk/doj/data/hkel_list_c_all_zh-Hant.json ^
  --log "%ROOT%logs\fetch_zh-Hant.log" ^
  --clean
pause
