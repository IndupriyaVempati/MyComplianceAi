# 🚀 MyComplianceAi - Quick Start

## One-Command Start

```powershell
.\start-all.ps1
```

This will launch both backend and frontend in separate windows.

---

## Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8100
- **API Docs**: http://localhost:8100/docs

---

## Key Features

✅ **Local LLMs** - Qwen 3, Gemma 3, GLM 4 via Ollama  
✅ **Per-Thread KB** - Each chat has isolated document storage  
✅ **Dual Retrieval** - Government + Company document synthesis  
✅ **Streaming Responses** - Real-time token streaming  
✅ **Admin Panel** - Manage assistants, users, and support  

---

## Prerequisites

1. **Ollama** - Install from https://ollama.ai
2. **Docker** - For PostgreSQL
3. **Python 3.10+** - For backend
4. **Node.js + Yarn** - For frontend

---

## Setup Commands

```powershell
# 1. Check Ollama setup
.\check-ollama.ps1

# 2. Pull models (if not installed)
ollama pull qwen3:8b
ollama pull gemma3:4b
ollama pull glm4:9b

# 3. Start PostgreSQL
docker-compose up postgres postgres-setup -d

# 4. Start application
.\start-all.ps1
```

---

## Documentation

- **Startup Guide**: [STARTUP_GUIDE.md](STARTUP_GUIDE.md)
- **Testing Guide**: [TESTING_GUIDE.md](TESTING_GUIDE.md)

---

## Project Structure

```
MyComplianceAi/
├── backend/              # FastAPI + LangGraph
│   ├── app/
│   │   ├── api/         # REST endpoints
│   │   ├── agent_types/ # Bot implementations
│   │   ├── tools.py     # Tool definitions
│   │   └── vectorstore.py # Pinecone integration
│   └── .env             # Environment config
├── frontend/            # React + TypeScript
│   ├── src/
│   │   ├── components/  # UI components
│   │   └── hooks/       # React hooks
│   └── vite.config.ts
├── start-all.ps1        # Start both servers
├── start-backend.ps1    # Start backend only
├── start-frontend.ps1   # Start frontend only
└── check-ollama.ps1     # Verify Ollama setup
```

---

## Troubleshooting

**Backend won't start?**
```powershell
cd backend
poetry install
python -m uvicorn app.server:app --host 0.0.0.0 --port 8100 --reload
```

**Frontend won't start?**
```powershell
cd frontend
yarn install
yarn dev
```

**Ollama not responding?**
```powershell
ollama list
# Restart Ollama service
```

---

Made with ❤️ using LangGraph + React
