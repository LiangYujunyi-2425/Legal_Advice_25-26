import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import firestore
import datetime
import httpx

db = firestore.Client(database="agentmemo")

# Google Vertex AI
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
except Exception:
    vertexai = None
    GenerativeModel = None

# 環境變數
GCP_PROJECT = os.environ.get("GCP_PROJECT")
GCP_LOCATION = os.environ.get("GCP_LOCATION")
VERTEX_ENDPOINT_ID = os.environ.get("VERTEX_ENDPOINT_ID")

# 全域模型
generative_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global generative_model

    if GenerativeModel is None:
        raise RuntimeError("vertexai package not available. Install google-cloud-vertexai in requirements.")

    try:
        vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    except Exception:
        pass

    if not VERTEX_ENDPOINT_ID:
        raise RuntimeError("VERTEX_ENDPOINT_ID environment variable must be set")

    endpoint_path = f"projects/{GCP_PROJECT}/locations/{GCP_LOCATION}/endpoints/{VERTEX_ENDPOINT_ID}"

    try:
        generative_model = GenerativeModel(endpoint_path)
        print(f"✅ GenerativeModel initialized for endpoint: {endpoint_path}")
        from agent.runtime import set_model
        set_model(generative_model)
    except Exception as e:
        raise RuntimeError(f"Failed to initialize GenerativeModel with endpoint '{endpoint_path}': {e}")

    yield
    print("🛑 服務關閉，釋放資源")

# 建立 FastAPI 應用
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from agent import lawyer_router, contract_router, assistant_router, summarizer_router, summarizesreviewer_router

app.include_router(lawyer_router, prefix="/lawyer")
app.include_router(contract_router, prefix="/contract")
app.include_router(assistant_router, prefix="/assistant")
app.include_router(summarizer_router, prefix="/summarizer")
app.include_router(summarizesreviewer_router, prefix="/summarizesreviewer")

# Guide Agent Prompt
system_prompt = """
你是一個任務分流器。請根據用戶的問題判斷應該交給哪個 Agent 處理：
- "lawyer" → 法律問題（香港法例、勞工法、合規）
- "contract" → 合同分析（條款風險、合約結構）
- "assistant" → 前台接待（一般詢問、指引）

請只回傳一個字串："lawyer"、"contract" 或 "assistant"。
"""

@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/guide")
async def guide(request: Request):
    body = await request.json()
    user_question = body.get("user_question")
    session_id = body.get("session_id")

    if not user_question or not session_id:
        return {"ok": False, "error": "Missing user_question or session_id"}

    if generative_model is None:
        return {"ok": False, "error": "GenerativeModel not initialized"}

    # Firestore document reference
    doc_ref = db.collection("conversations").document(session_id)

    # 讀取過去對話
    doc = doc_ref.get()
    data = doc.to_dict() or {}
    summaries = data.get("summaries", [])
    if isinstance(summaries, dict):
        summaries = [summaries]
    elif not isinstance(summaries, list):
        summaries = []

    latest_summary = ""
    if summaries and isinstance(summaries[-1], dict):
        latest_summary = summaries[-1].get("content", "")

    # 呼叫 Vertex AI 模型
    response = generative_model.generate_content(
        f"{system_prompt}\n最新摘要:\n{latest_summary}\n用戶問題:\n{user_question}".strip()
    )
    agent_type = response.candidates[0].content.parts[0].text.strip()

    # 新增訊息到 history
    user_message = {
        "user": user_question,
    }

    messages = data.get("messages", [])
    if isinstance(messages, dict):
        messages = [messages]
    elif not isinstance(messages, list):
        messages = []
        
    new_messages = messages + [user_message]

    doc_ref.set({
        "messages": new_messages,
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, merge=True)

    agent_url_map = { 
        "lawyer": "http://localhost:8080/lawyer/", 
        "contract": "http://localhost:8080/contract/", 
        "assistant": "http://localhost:8080/assistant/" 
    } 

    agent_answer = None 
    if agent_type in agent_url_map: 
        async with httpx.AsyncClient() as client: 
            resp = await client.post(agent_url_map[agent_type], json={"session_id": session_id, "user_question": user_question}) 
            agent_answer = resp.json()
            if agent_answer and agent_answer.get("ok"):
                await client.post(
                    "http://localhost:8080/summarizer/",   # 或 Cloud Run 公網 URL
                    json={
                        "session_id": session_id,
                        "user_question": user_question,
                        "agent_response": agent_answer.get("answer")
                    }
                )

    return {
        "agent_response": agent_answer
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("guide:app", host="0.0.0.0", port=port)
