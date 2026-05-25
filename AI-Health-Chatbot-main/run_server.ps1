# One-step PowerShell script to create venv, install deps, and run the chatbot server
$VENV = ".venv"
if (-not (Test-Path $VENV)) {
    python -m venv $VENV
}
# Activate the venv for the current session
& .\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
python .\chatbot_server.py
