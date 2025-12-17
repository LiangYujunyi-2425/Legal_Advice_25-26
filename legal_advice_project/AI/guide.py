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

from agent import lawyer_router, contract_router, assistant_router, reviewer_router

app.include_router(lawyer_router, prefix="/lawyer")
app.include_router(contract_router, prefix="/contract")
app.include_router(assistant_router, prefix="/assistant")
app.include_router(reviewer_router, prefix="/reviewer")

# Guide Agent Prompt
system_prompt = """
你是一個任務分流器。請根據用戶的問題判斷應該交給哪個 Agent 處理：
- "lawyer" → 法律問題（香港法例、勞工法、合規）
- "contract" → 合同分析（條款風險、合約結構）
- "assistant" → 一般諮詢（前台接待）

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
    history = []
    if doc.exists:
        history = doc.to_dict().get("messages", [])

    # 呼叫 Vertex AI 模型
    response = generative_model.generate_content(
        f"{system_prompt}\n{user_question}".strip()
    )
    agent_type = response.candidates[0].content.parts[0].text.strip()

    # 新增訊息到 history
    user_message = {
        "role": "user",
        "content": user_question,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

    # 更新 Firestore
    new_history = history + [user_message]

    doc_ref.set({
        "messages": new_history,
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, merge=True)

    agent_url_map = { 
        "lawyer": "http://localhost:8080/lawyer/", 
        "contract": "http://localhost:8080/contract/", 
        "assistant": "http://localhost:8080/assistant/" 
    } 

    agent_answer = None
    reviewed_answer = None
    enable_review = body.get("enable_review", True)  # 默認啟用審查
    
    if agent_type in agent_url_map: 
        async with httpx.AsyncClient() as client: 
            # 1. 調用原始 agent
            resp = await client.post(agent_url_map[agent_type], json={"session_id": session_id, "user_question": user_question}) 
            agent_answer = resp.json()
            
            # 2. 如果啟用審查且 agent 回答成功，則調用 reviewer
            if enable_review and agent_answer and agent_answer.get("ok") and agent_answer.get("answer"):
                try:
                    review_resp = await client.post(
                        "http://localhost:8080/reviewer/",
                        json={
                            "session_id": session_id,
                            "original_answer": agent_answer["answer"],
                            "original_question": user_question,
                            "agent_type": agent_type
                        }
                    )
                    reviewed_answer = review_resp.json()
                except Exception as e:
                    print(f"Reviewer error: {e}")
                    # 如果審查失敗，仍然返回原始答案
                    reviewed_answer = None

    return {
        "ok": True,
        "agent_type": agent_type,
        "agent_response": agent_answer,
        "reviewed_response": reviewed_answer,  # 審查後的回答
        "final_answer": reviewed_answer.get("answer") if reviewed_answer and reviewed_answer.get("ok") else (agent_answer.get("answer") if agent_answer else None)
    }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("guide:app", host="0.0.0.0", port=port)
