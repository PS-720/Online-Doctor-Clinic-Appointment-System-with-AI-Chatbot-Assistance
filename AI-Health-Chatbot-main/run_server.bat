@echo off
REM One-step CMD script to create venv, install deps, and run the chatbot server
if not exist .venv (
    python -m venv .venv
)
call .\.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
python chatbot_server.py
pause
