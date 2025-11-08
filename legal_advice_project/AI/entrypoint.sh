#!/bin/bash
if [ ! -d "/app/model" ]; then
  echo "Downloading model..."
  python download.py
fi

exec uvicorn predict:app --host 0.0.0.0 --port ${PORT:-8080}