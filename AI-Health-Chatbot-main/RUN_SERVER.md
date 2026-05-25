Run the AI Health Chatbot server (Windows)

1. Open PowerShell (recommended) in this folder (`AI-Health-Chatbot-main`).
2. Run:

   PowerShell:

   ```powershell
   .\run_server.ps1
   ```

   OR CMD:

   ```cmd
   .\run_server.bat
   ```

3. Once running, verify the server is healthy:

   ```bash
   curl http://localhost:5050/api/health
   ```

Notes:

- The server binds to port 5050 by default. If you change the port, update `PHP/chatbot_api.php`.
- The script creates a local `.venv` and installs packages from `requirements.txt`.
