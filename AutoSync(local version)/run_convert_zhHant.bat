@echo off
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set PY=py -3
%PY% "%ROOT%scripts\xml_to_md.py" ^
  --in "%ROOT%data\xml\zh-Hant" ^
  --out "%ROOT%data\md\zh-Hant" ^
  --log "%ROOT%logs\convert_zh-Hant.log" ^
  --clean
pause
