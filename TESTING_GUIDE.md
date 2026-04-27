# 🧪 Testing Guide - Per-Thread KB with Local LLMs

## Quick Start Checklist

### ✅ Prerequisites
```powershell
# 1. Check Ollama setup
.\check-ollama.ps1

# 2. Install missing models (if needed)
ollama pull qwen3:8b
ollama pull gemma3:4b
ollama pull glm4:9b

# 3. Start PostgreSQL
docker-compose up postgres postgres-setup -d

# 4. Start application
.\start-all.ps1
```

---

## 🎯 Test Scenario 1: Basic Chat with Local LLM

### Steps:
1. **Navigate to** http://localhost:5173
2. **Create Assistant**:
   - Click "Create Knowledge Base"
   - Name: "Test KB 1"
   - Bot Type: "Upload File" (chat_retrieval)
   - LLM Type: "Qwen 3 (Local)"
   - Instructions: "You are a helpful compliance assistant."
   - Click Save

3. **Upload Document**:
   - Click on your created assistant
   - Upload a PDF/DOCX file (e.g., company policy)
   - Wait for ingestion to complete

4. **Start Chat**:
   - Click "New Chat"
   - Send message: "What does the document say about [topic]?"
   - Verify response includes citations

### Expected Result:
✅ Response streamed from Qwen 3 model  
✅ Citations from uploaded document shown  
✅ Response in JSON format with answer + citations

---

## 🎯 Test Scenario 2: Per-Thread KB Isolation

### Steps:
1. **Create Chat A**:
   - Click "New Chat"
   - Upload Document A (e.g., "policy_A.pdf")
   - Send message: "What is in Document A?"
   - Note the response

2. **Create Chat B**:
   - Click "New Chat" (this creates a NEW thread with different UUID)
   - Upload Document B (e.g., "policy_B.pdf")
   - Send message: "What is in Document A?"

### Expected Result:
✅ Chat A can see Document A  
✅ Chat B CANNOT see Document A (only Document B)  
✅ Each thread has isolated KB namespace

### Verification:
Check Pinecone dashboard:
```
Namespaces should show:
- {thread_id_A} → contains Document A chunks
- {thread_id_B} → contains Document B chunks
```

---

## 🎯 Test Scenario 3: Dual Retrieval (Government + Company)

### Steps:
1. **Setup Government Docs** (if not already ingested):
   ```powershell
   # Place PDFs in C:/govt_docs
   # Restart backend to trigger ingestion
   ```

2. **Create Assistant**:
   - Bot Type: "Upload File" (chat_retrieval)
   - LLM Type: "GLM 4 (Local)"

3. **Upload Company Policy**:
   - Upload company-specific compliance document

4. **Test Queries**:
   - Query 1: "What are the regulatory requirements for [topic]?"
     - Should retrieve from GOVERNMENT docs
   - Query 2: "What is our company policy on [topic]?"
     - Should retrieve from COMPANY docs
   - Query 3: "How does government regulation align with company policy?"
     - Should retrieve from BOTH and synthesize

### Expected Result:
✅ Query 1: Citations from government documents  
✅ Query 2: Citations from company documents  
✅ Query 3: Combined answer with both sources  
✅ Conflicts highlighted with warning

---

## 🎯 Test Scenario 4: Compare LLM Performance

### Test the same prompt with all three models:

**Setup**:
- Create 3 assistants (one for each LLM)
- Upload the SAME document to each
- Start 3 separate chats

**Test Prompt**: 
```
"What are the key compliance requirements mentioned in the document?"
```

**Compare**:
| Criteria | Qwen 3 (8B) | Gemma 3 (4B) | GLM 4 (9B) |
|----------|-------------|--------------|------------|
| Response Time | | | |
| Answer Quality | | | |
| Citation Accuracy | | | |
| Formatting | | | |

### Expected Result:
✅ All three models respond correctly  
✅ Different response styles/speeds  
✅ Citations accurate across all models

---

## 🎯 Test Scenario 5: Multi-Turn Conversation

### Steps:
1. **Start Chat**:
   - Upload compliance document
   - Message 1: "What is the policy on data protection?"
   - Message 2: "Can you elaborate on point 3?"
   - Message 3: "How does this compare to government regulations?"

### Expected Result:
✅ Context maintained across turns  
✅ Follow-up questions understood  
✅ Retrieval uses conversation history for search query

---

## 🎯 Test Scenario 6: Agent with Tools

### Steps:
1. **Create Agent**:
   - Bot Type: "Agent" (not chat_retrieval)
   - LLM Type: "Qwen 3 (Local)"
   - Add Tools: DuckDuckGo Search, Retrieval

2. **Test Tool Usage**:
   - Query: "What are the latest FAIS regulations?" (should use Retrieval)
   - Query: "What's the current date?" (should use internal knowledge)

### Expected Result:
✅ Agent decides when to use tools  
✅ Tool calls visible in stream  
✅ Responses combine tool output + LLM knowledge

---

## 🔍 Debugging & Verification

### Check Backend Logs:
```powershell
# Look for these log messages:
"Loading local LLM: qwen3:8b via http://localhost:11434/v1"
"Ingested file.pdf → 45 chunks (namespace=thread-xyz)"
"Retrieving from namespace: ['thread-xyz', 'assistant-abc']"
```

### Check PostgreSQL:
```sql
-- List assistants
SELECT assistant_id, name, config->>'type' as bot_type FROM assistant;

-- List threads
SELECT thread_id, assistant_id, name FROM thread ORDER BY updated_at DESC;

-- Check KB history
SELECT * FROM knowledge_base_history ORDER BY created_at DESC LIMIT 10;
```

### Check Pinecone:
```python
# Verify namespaces
from app.vectorstore import get_vectorstore
vstore = get_vectorstore()

# List unique namespaces
# Check Pinecone dashboard for namespace statistics
```

### Test API Directly:
```powershell
# Health check
Invoke-WebRequest -Uri http://localhost:8100/health

# List assistants
Invoke-WebRequest -Uri http://localhost:8100/api/assistants/

# Create thread
$body = @{
    name = "Test Thread"
    assistant_id = "your-assistant-id"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:8100/api/threads `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

---

## 📊 Performance Metrics to Track

| Metric | Target | Notes |
|--------|--------|-------|
| LLM Response Time | < 5s | Depends on model size |
| Retrieval Time | < 2s | Pinecone query speed |
| File Ingestion | < 10s/MB | Parsing + embedding |
| Streaming Start | < 1s | First token latency |
| Thread Isolation | 100% | No cross-thread leakage |

---

## 🐛 Common Issues & Solutions

### Issue: "Ollama connection refused"
```powershell
# Solution: Check Ollama is running
ollama list
# Restart Ollama if needed
```

### Issue: "No chunks extracted from file"
```
# Solution: Check file format
- Ensure PDF is not scanned (needs to be text-based)
- Try DOCX or TXT format
- Check backend logs for parsing errors
```

### Issue: "Thread cannot access uploaded documents"
```
# Solution: Verify namespace
- Check ingest logs for namespace assignment
- Verify thread_id in retrieval matches upload thread_id
```

### Issue: "Response not streamed"
```
# Solution: Check frontend hooks
- Verify useStreamState is active
- Check SSE connection in browser dev tools
- Ensure backend returns EventSourceResponse
```

---

## ✅ Test Completion Checklist

- [ ] All three LLMs tested (Qwen, Gemma, GLM)
- [ ] Thread isolation verified (no cross-contamination)
- [ ] Dual retrieval working (government + company)
- [ ] Citations accurate and formatted correctly
- [ ] Multi-turn conversations maintain context
- [ ] File ingestion successful for PDF/DOCX/TXT
- [ ] Streaming responses work smoothly
- [ ] Admin panel shows KB history
- [ ] Support ticket system functional
- [ ] PDF generation from chat history works

---

## 📝 Notes for Production

1. **Model Selection**:
   - Qwen 3: Best balance of speed/quality
   - Gemma 3: Fastest, good for simple queries
   - GLM 4: Best for complex reasoning

2. **Thread Management**:
   - Each thread = isolated KB namespace
   - Clean up old threads to save Pinecone storage
   - Consider thread archival strategy

3. **Embedding Model**:
   - BAAI/bge-small-en-v1.5 (384 dims) is fast and accurate
   - For better quality, try BAAI/bge-large-en (1024 dims)

4. **Pinecone Optimization**:
   - Monitor index size
   - Use metadata filtering efficiently
   - Consider pod scaling for production

---

**Happy Testing! 🚀**

If you encounter issues, check:
1. Backend logs for detailed errors
2. Browser console for frontend errors
3. Ollama service status
4. PostgreSQL connection
5. Pinecone API key validity
