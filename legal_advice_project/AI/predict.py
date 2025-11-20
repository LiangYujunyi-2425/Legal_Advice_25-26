# app/predict.py
import os
import re
from typing import Dict, Any, List
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import time
import json

# Google Vertex AI (use vertexai GenerativeModel for endpoint calls)
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
except Exception:
    vertexai = None
    GenerativeModel = None


# Configure via environment variables
GCP_PROJECT = os.environ.get("GCP_PROJECT")
GCP_LOCATION = os.environ.get("GCP_LOCATION")
# REQUIRED: Vertex Endpoint ID
VERTEX_ENDPOINT_ID = os.environ.get("VERTEX_ENDPOINT_ID")


# Global model instance
generative_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global generative_model

    # require vertexai package
    if GenerativeModel is None:
        raise RuntimeError("vertexai package not available. Install google-cloud-vertexai in requirements.")

    # 初始化 vertexai
    try:
        vertexai.init(project=GCP_PROJECT, location=GCP_LOCATION)
    except Exception:
        # vertexai.init may raise if env vars missing; still proceed to construct endpoint_path
        pass

    # 建立 Endpoint 的完整路徑
    if not VERTEX_ENDPOINT_ID:
        raise RuntimeError("VERTEX_ENDPOINT_ID environment variable must be set")

    endpoint_path = f"projects/{GCP_PROJECT}/locations/{GCP_LOCATION}/endpoints/{VERTEX_ENDPOINT_ID}"

    try:
        # 使用 GenerativeModel 初始化（直接對 endpoint 呼叫）
        generative_model = GenerativeModel(endpoint_path)
        print(f"✅ GenerativeModel initialized for endpoint: {endpoint_path}")
    except Exception as e:
        raise RuntimeError(f"Failed to initialize GenerativeModel with endpoint '{endpoint_path}': {e}")
    
    yield
    
    print("🛑 服務關閉，釋放資源")


# 建立 FastAPI 應用，並指定 lifespan
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 或指定 ["https://your-frontend.com"]
    allow_credentials=True,
    allow_methods=["*"],  # 包含 OPTIONS
    allow_headers=["*"],
)


def extract_answer(text: str) -> str:
    """只抽取 <answer> ... </answer> 之間的內容"""
    m = re.search(r"<answer>(.*?)</answer>", text, re.DOTALL)
    return m.group(1).strip() if m else text.strip()

def sanitize_output(text: str) -> str:
    # 移除 <instruction> ... </instruction>
    text = re.sub(r"<instruction>.*?</instruction>", "", text, flags=re.DOTALL)
    # 移除 <question> ... </question>
    text = re.sub(r"<question>.*?</question>", "", text, flags=re.DOTALL)
    # 移除多餘空白
    return text.strip()



def _vertex_predict_sync(prompt: str, max_output_tokens: int = 256, **predict_kwargs) -> str:
    """
    同步呼叫 Vertex Endpoint 進行預測
    使用 Endpoint.predict() 搭配 Gemini 2.5 Flash 模型
    """
    # Use the vertexai GenerativeModel (endpoint) to generate content
    if generative_model is None:
        return "[vertex predict error] generative model not initialized"

    try:
        final_prompt = prompt
        # Call generate_content with a simple string prompt (matches provided example)
        resp = generative_model.generate_content(final_prompt)
        if hasattr(resp, "text") and resp.text:
            return resp.text

        # Try to extract common fields if 'text' not present
        try:
            obj = getattr(resp, "__dict__", {})
            for k in ("text", "content", "outputs", "candidates"):
                if k in obj and obj[k]:
                    return str(obj[k])
        except Exception:
            pass

        return str(resp)
    except Exception as e:
        return f"[vertex predict error] {str(e)}"

async def llm_generate(prompt: str, max_new_tokens: int = 256, **predict_kwargs) -> str:
    # Run blocking Vertex call in threadpool to avoid blocking event loop
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _vertex_predict_sync, prompt, max_new_tokens, **predict_kwargs)

# ---- Shared memory/context ----
class Memory:
    def __init__(self):
        self.messages: List[Dict[str, str]] = []
        self.notes: Dict[str, Any] = {}
    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})

def retrieve_docs(query: str, k: int = 3) -> List[str]:
    # TODO: 這裡可以接資料庫或檔案檢索
    return [f"[doc{i}] 模擬文件內容：{query}" for i in range(1, k+1)]

def format_responses_for_judge(responses: Dict[str, str]) -> str:
    lines = []
    for key, value in responses.items():
        lines.append(f"{key}: {value}")
    return "\n".join(lines)

# ---- Prompt templates ----
def lawyer_template(user_question: str) -> str:
    system_prompt = "假設你是一名律師。請根據香港法例從專業角度回答用戶的問題並解釋你的推理。限制：用繁體中文回答。不需要引入案例，不需要假設不存在的事實。請給我乾淨的回答，和使用點列方式輸出回覆。粗體請用<b>...</b>標記。"
    return f"{system_prompt}\n{user_question}"

def contract_template(user_question: str, ) -> str:
    system_prompt = "你是一名律師。請根據香港法例從專業角度分析用戶提供的文件，其風險、錯誤或遺漏，並詢問用戶需要什麼幫助。限制：用繁體中文回答。請給我乾淨的回答，和使用點列方式輸出回覆。粗體請用<b>...</b>標記。"
    return f"{system_prompt}\n用戶提供文件：{user_question}"

def prosecutor_template(user_question: str) -> str:
    system_prompt = "假設你是一名律師。請根據香港法例從專業角度回答用戶的問題並解釋你的推理並解釋你的推理。限制：用繁體中文回答。不需要引入案例，不需要假設不存在的事實。請給我乾淨的回答，和使用點列方式輸出回覆。粗體請用<b>...</b>標記。"
    return f"{system_prompt}\n{user_question}"

def judge_template(user_question: str, responses: Dict[str, str]) -> str:
    system_prompt = "假設你是一名法官。總結多輪中雙方的觀點，並提供結論。限制：只需要提供結論，不需要輸出總結，用繁體中文回答，不需要引入案例，不需要假設不存在的事實。請給我乾淨的回答，和使用點列方式輸出回覆。粗體請用<b>...</b>標記。你必須以『非專業法律意見，如需要法律援助請尋求專門人士協助。』結束每個回答。"
    return f"{system_prompt}\n用戶問題：{user_question}\n律師們的觀點：{format_responses_for_judge(responses)}"

def Guide_template(user_question: str, memory: Memory) -> str:
    history = "\n".join([f"{m['role']}: {m['content']}" for m in memory.messages[-6:]])
    system_prompt = "你是一個名叫小律的法律顧問助手。禮貌地問候用戶並介紹自己。並回答用戶有關香港法律的疑問。限制：你必須以『非專業法律意見，如需要法律援助請尋求專門人士協助。』結束每個回答。用繁體中文回答。請給我乾淨的回答，和使用點列方式輸出回覆。粗體請用<b>...</b>標記。"
    return f"{system_prompt}\n歷史：{history}\n用戶問題：{user_question}"

# ---- Agents ----
class BaseAgent:
    name = "base"
    def run(self, text: str, memory: Memory) -> str:
        raise NotImplementedError

class lawyerAgent(BaseAgent):
    name = "Lawyer"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)   # 先記錄用戶輸入
        prompt = lawyer_template(text)
        # llm_generate is async (calls Vertex), run in asyncio loop if needed
        raw = asyncio.run(llm_generate(prompt, max_new_tokens=256))
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)  # 再記錄 agent 輸出
        return answer

class contractAgent(BaseAgent):
    name = "Contract"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)
        prompt = contract_template(text)
        raw = asyncio.run(llm_generate(prompt, max_new_tokens=256))
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

class prosecutorAgent(BaseAgent):
    name = "Prosecutor"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)
        prompt = prosecutor_template(text)
        raw = asyncio.run(llm_generate(prompt, max_new_tokens=256))
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

class JudgeAgent(BaseAgent):
    name = "Judge"
    def run(self, text: str, responses: Dict[str, str], memory: Memory) -> str:
        memory.add("user", text)
        prompt = judge_template(text, responses)
        raw = asyncio.run(llm_generate(prompt, max_new_tokens=256))
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

class guideAgent(BaseAgent):
    name = "Guide"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)
        prompt = Guide_template(text, memory)   # ⚠️ Guide_template 要改成只接受一個參數
        raw = asyncio.run(llm_generate(prompt, max_new_tokens=256))
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

    
# ---- Router / Planner ----
AGENTS = {
    "Lawyer": lawyerAgent(),
    "Contract": contractAgent(),
    "Prosecutor": prosecutorAgent(),
    "Negotiate": None,           # 由 orchestrator 處理雙回合 + 法官
    "Guide": guideAgent(),
    "Judge": JudgeAgent()
}

def route_task(text: str, has_contract: bool = False) -> str:
    """
    Router: 根據輸入情境決定要走哪個 agent
    """
    t = text.lower()

    # 1. 如果有上傳合約 PDF → ContractAgent
    if has_contract or len(text) > 50:
        return "Contract"

    # 2. 如果是法律相關問題 → Negotiate
    if any(k in t for k in ["法律", "合約", "合同", "訴訟", "法官", "律師", "檢控", "起訴", "辯護", "遺囑", "遺產", "租約", "犯法", "法律", "法例", "規定", "責任", "權利", "義務", "賠償", "索償", "糾紛", "調解", "仲裁", "訴狀", "違法", "違反"]):
        return "Negotiate"
    
    # 3. 其他情況 → GuideAgent（引導用戶問法律問題）
    return "Guide"

# ---- Orchestrator ----
def orchestrate(text: str, memory: Memory) -> Dict[str, Any]:
    start = time.time()
    agent_name = route_task(text)
    if agent_name == "Negotiate":
        return {"agent_used": "Negotiate", "result": None, "latency_sec": 0.0}

    agent = AGENTS[agent_name]
    memory.add("user", text)

    result = agent.run(text, memory)
    memory.add(agent_name, result)

    elapsed = round(time.time() - start, 3)
    return {"agent_used": agent_name, "result": result, "latency_sec": elapsed}

def negotiate_stream(user_question: str, memory: Memory, max_rounds: int = 3):
    responses: Dict[str, str] = {}

    # 第一輪
    lawyer_r1 = lawyerAgent().run(user_question, memory)
    responses["lawyer_r1"] = lawyer_r1
    yield f"data: {json.dumps({'agent': 'Lawyer', 'round': 1, 'output': lawyer_r1}, ensure_ascii=False)}\n\n"

    prosecutor_r1 = prosecutorAgent().run(user_question, memory)
    responses["prosecutor_r1"] = prosecutor_r1
    yield f"data: {json.dumps({'agent': 'Prosecutor', 'round': 1, 'output': prosecutor_r1}, ensure_ascii=False)}\n\n"

    if "沒有意見" in prosecutor_r1 or "我同意辯方律師" in prosecutor_r1:
        judge_result = JudgeAgent().run(user_question, responses, memory)
        yield f"data: {json.dumps({'agent': 'Judge', 'output': judge_result}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
        return

    # 後續多輪
    for r in range(2, max_rounds + 1):
        lawyer_reply = lawyerAgent().run(f"控方律師上一輪的意見是：{responses[f'prosecutor_r{r-1}']}", memory)
        responses[f"lawyer_r{r}"] = lawyer_reply
        yield f"data: {json.dumps({'agent': 'Lawyer', 'round': r, 'output': lawyer_reply}, ensure_ascii=False)}\n\n"

        prosecutor_reply = prosecutorAgent().run(f"辯護律師上一輪的意見是：{responses[f'lawyer_r{r-1}']}", memory)
        responses[f"prosecutor_r{r}"] = prosecutor_reply
        yield f"data: {json.dumps({'agent': 'Prosecutor', 'round': r, 'output': prosecutor_reply}, ensure_ascii=False)}\n\n"

        if "沒有意見" in prosecutor_reply or "同意" in prosecutor_reply:
            break

    # 法官總結
    judge_result = JudgeAgent().run(user_question, responses, memory)
    yield f"data: {json.dumps({'agent': 'Judge', 'output': judge_result}, ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"


@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/predict")
async def predict(request: Request):
    body = await request.json()

    # 支援兩種輸入格式：
    # 1) 舊的 instances 格式：{"instances":[{"text":"..."}], "has_contract": false}
    # 2) 新的 system_prompt + user_question 格式：{"system_prompt": "...", "user_question": "..."}
    prompt = None
    has_contract = False
    override_agent = None

    # agent 覆寫（optional）
    if isinstance(body, dict):
        override_agent = body.get("agent")

    if isinstance(body, dict) and "system_prompt" in body and "user_question" in body:
        # 使用明確的 system_prompt + user_question
        system_prompt = body.get("system_prompt") or ""
        user_question = body.get("user_question") or ""
        prompt = f"{system_prompt}\n{user_question}".strip()
        has_contract = body.get("has_contract", False)
    else:
        # fallback to instances format for backward compatibility
        instances = body.get("instances", []) if isinstance(body, dict) else []
        if not instances or "text" not in instances[0]:
            def empty():
                yield f"data: {json.dumps({'error': '沒有輸入文字'}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(empty(), media_type="text/event-stream")

        prompt = instances[0]["text"]
        has_contract = body.get("has_contract", False)

    memory = Memory()

    def event_stream():
        # allow override of routing (e.g., pass "agent":"Guide" in JSON to force)
        routed = override_agent if override_agent else route_task(prompt, has_contract)

        if routed == "Contract":
            out = contractAgent().run(prompt, memory)
            yield f"data: {json.dumps({'agent': 'Contract', 'output': out}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
            return

        if routed == "Guide":
            out = guideAgent().run(prompt, memory)
            yield f"data: {json.dumps({'agent': 'Guide', 'output': out}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
            return

        if routed == "Negotiate":
            yield from negotiate_stream(prompt, memory)
            return

        # 預設：Lawyer
        out = lawyerAgent().run(prompt, memory)
        yield f"data: {json.dumps({'agent': 'Lawyer', 'output': out}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


