# 🚀 MyComplianceAi - Live Testing Guide

## Overview
This guide will help you start the backend and frontend servers for testing the local LLM models (Qwen 3, Gemma 3, GLM 4) with **per-thread KB isolation**.

---

## 📋 Prerequisites

### 1. **Install Ollama** (Required for Local LLMs)
```powershell
# Download and install from: https://ollama.ai
# After installation, pull the required models:
ollama pull qwen3:8b
ollama pull gemma3:4b
ollama pull glm4:9b
```

### 2. **Install Python Dependencies**
```powershell
cd backend
pip install poetry
poetry install
```

### 3. **Install Node.js Dependencies**
```powershell
cd frontend
yarn install
```

### 4. **Start PostgreSQL** (via Docker)
```powershell
# From project root
docker-compose up postgres postgres-setup -d
```

---

## 🎯 Quick Start

### Option 1: Start Both Servers (Recommended)
Open **two PowerShell terminals**:

**Terminal 1 - Backend:**
```powershell
.\start-backend.ps1
```

**Terminal 2 - Frontend:**
```powershell
.\start-frontend.ps1
```

### Option 2: Manual Start

**Backend:**
```powershell
cd backend
python -m uvicorn app.server:app --host 0.0.0.0 --port 8100 --reload
```

**Frontend:**
```powershell
cd frontend
yarn dev
```

---

## 🌐 Access the Application

Once both servers are running:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8100
- **Health Check**: http://localhost:8100/health

---

## 🧪 Testing Local LLM Models

### 1. **Create a New Assistant (KB)**
1. Navigate to http://localhost:5173
2. Click **"Create Knowledge Base"** (Admin mode)
3. Choose bot type:
   - **Upload File** (chat_retrieval) - For document Q&A with dual retrieval
4. Select LLM Type:
   - `Qwen 3 (Local)` - Default, balanced performance
   - `Gemma 3 (Local)` - Lightweight, fast
   - `GLM 4 (Local)` - Advanced reasoning
5. Add system instructions
6. Save

### 2. **Upload Documents to KB**
1. Select your created assistant
2. Upload PDF/DOCX/TXT files
3. Files are automatically indexed in Pinecone with **assistant-scoped namespace**

### 3. **Start a Chat (Thread-Scoped KB)**
1. Click **"New Chat"**
2. Each chat gets its own **unique thread_id (UUID)**
3. Upload documents specific to this chat
4. Documents are stored in **thread_id namespace** (isolated from other chats)
5. Send messages - the bot will retrieve from:
   - **Government docs** (shared namespace: `__government__`)
   - **Company KB** (assistant namespace)
   - **Chat-specific docs** (thread namespace)

### 4. **Verify Thread Isolation**
- Create multiple chats
- Upload different documents to each
- Each chat only accesses its own uploaded documents + shared KB
- Perfect for testing different scenarios independently!

---

## 🔧 Configuration

### Backend (.env)
```env
# Local LLMs via Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b          # Default model
GEMMA_MODEL=gemma3:4b          # Gemma model
QWEN_MODEL=qwen3:8b            # Qwen model
GLM_MODEL=glm4:9b              # GLM model

# Pinecone (Vector Store)
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=rag-saas-local
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

# Embeddings (Local)
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_DIMENSION=384

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=opengpts
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### Frontend (vite.config.ts)
```typescript
server: {
  proxy: {
    "/api": {
      target: "http://127.0.0.1:8100",  // Backend URL
      changeOrigin: true,
    },
  },
}
```

---

## 📊 Architecture Highlights

### Per-Thread KB Isolation
```
Pinecone Namespaces:
├── __government__        → Shared regulatory docs (Bot1)
├── {assistant_id}        → Company KB (shared across chats)
└── {thread_id}           → Chat-specific docs (isolated)
```

### Dual Retrieval Flow (RAG Bot)
```
User Question
    ↓
Search Query Generation
    ↓
Parallel Retrieval:
├── Government Retriever (namespace: __government__)
└── Company Retriever (namespace: thread_id + assistant_id)
    ↓
LLM Arbitration (Qwen/Gemma/GLM)
    ↓
JSON Response with Citations
```

### Bot Types
1. **Agent** (Tool-using): LLM decides when to use tools
2. **ChatBot** (Simple): System message + LLM only
3. **RAGBot** (Document Q&A): Dual retrieval + arbitration

---

## 🐛 Troubleshooting

### Ollama Connection Error
```powershell
# Check if Ollama is running
ollama list

# Restart Ollama service
# Windows: Check system tray or restart service
```

### PostgreSQL Connection Failed
```powershell
# Check Docker container
docker ps

# Restart Postgres
docker-compose restart postgres
```

### Pinecone Error
- Verify API key in `.env`
- Check index name exists in Pinecone dashboard
- Ensure EMBEDDING_DIMENSION matches your model (384 for BAAI/bge-small-en-v1.5)

### Frontend Can't Connect to Backend
- Verify backend is running on port 8100
- Check vite.config.ts proxy configuration
- Clear browser cache and reload

---

## 📝 Testing Checklist

- [ ] Ollama running with models pulled
- [ ] PostgreSQL container running
- [ ] Backend server started (port 8100)
- [ ] Frontend server started (port 5173)
- [ ] Can access http://localhost:5173
- [ ] Created assistant with local LLM
- [ ] Uploaded test document
- [ ] Started new chat (thread)
- [ ] Uploaded chat-specific document
- [ ] Sent message and received response
- [ ] Verified thread isolation (different chats have different KBs)
- [ ] Tested all three LLMs (Qwen, Gemma, GLM)

---

## 🎓 Key Features to Test

1. **Local LLM Performance**: Compare response quality between Qwen, Gemma, GLM
2. **Thread KB Isolation**: Each chat has its own document space
3. **Dual Retrieval**: Government + Company docs synthesis
4. **Conflict Detection**: Upload contradictory docs to test arbitration
5. **Citation Accuracy**: Verify responses cite correct sources
6. **Streaming Responses**: Watch tokens stream in real-time

---

## 📞 Need Help?

- Check backend logs for detailed error messages
- Use LangSmith for tracing (if configured)
- Review Pinecone dashboard for vector counts
- Check PostgreSQL tables for assistant/thread data

Happy Testing! 🚀
