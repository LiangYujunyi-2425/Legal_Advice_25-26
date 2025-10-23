# app/predict.py
import re
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, Request
from transformers import AutoTokenizer, AutoModelForCausalLM
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import torch
import asyncio
import time
import json


app = FastAPI()

tokenizer = None
model = None

LOCAL_PATH = "/app/model"

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    # 🚀 啟動時載入模型
    tokenizer = AutoTokenizer.from_pretrained("/app/model")
    model = AutoModelForCausalLM.from_pretrained(
        "/app/model",
        torch_dtype="auto",
        device_map="auto"
    )
    model.eval()
    print("✅ 模型已載入完成")

    yield  # 這裡之後就是服務運行中

    # 🛑 關閉時釋放資源（可選）
    print("🛑 服務關閉，釋放資源")

# 建立 FastAPI 應用，並指定 lifespan
app = FastAPI(lifespan=lifespan)

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



def llm_generate(prompt: str, max_new_tokens: int = 256) -> str:
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
        )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

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
    return f"""
<instruction>
你是一名辯護律師，請用專業角度回答，並解釋你的回答。
如果有控方律師意見。請針對控方律師的回答提出同意或反對，並解釋你的回答。
限制:
- 不超過100字
</instruction>
<question>
用戶的問題：{user_question}
</question>
"""

def contract_template(user_question: str, ) -> str:
    return f"""
<instruction>
你是一名律師，如果用戶提供的文件是合約或合同，請用專業角度分析用戶提供文件的風險，指出該風險，並詢問用戶有甚麼需要你幫忙。
如果用戶提供的文件是遺囑，請用專業角度分析用戶提供文件的錯漏，指出該錯漏，並詢問用戶有甚麼需要你幫忙。
如果用戶提供的文件是狀書，請用專業角度分析用戶提供文件的錯漏，指出該錯漏，並詢問用戶有甚麼需要你幫忙。
限制:
- 不超過100字
</instruction>
<question>
用戶提供文件: {user_question}
</question>
"""

def prosecutor_template(user_question: str) -> str:
    return f"""
<instruction>
你是一名控方律師，請針對辯護律師的回答提出同意或反對，並解釋你的回答。
限制:
- 不超過100字
</instruction>
<question>
用戶的問題：{user_question}
</question>
"""

def judge_template(user_question: str, responses: Dict[str, str]) -> str:
    return f"""
<instruction>
你是一名法官，請綜合雙方多輪的觀點指出主要分歧，做出總結與定論。
限制:
- 不超過200字
</instruction>
<question>
用戶的問題：{user_question}
律師與檢控官的觀點：{format_responses_for_judge(responses)}
</question>
"""

def Guide_template(user_question: str, memory: Memory) -> str:
    history = "\n".join([f"{m['role']}: {m['content']}" for m in memory.messages[-6:]])
    return f"""
<instruction>
你是一名法律顧問助手:小律。
當用戶問的問題與法律無關時，請友善地向用戶打招呼和自我介紹，
並友善地提醒他聚焦在法律或合約相關的問題。
限制:
- 在回答最後加上:非專業法律意見，如需要法律援助請尋求專門人士協助。
</instruction>
<question>
對話歷史：{history}
用戶問題:{user_question}
</question>
"""

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
        raw = llm_generate(prompt, max_new_tokens=256)
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)  # 再記錄 agent 輸出
        return answer

class contractAgent(BaseAgent):
    name = "Contract"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)
        prompt = contract_template(text)
        raw = llm_generate(prompt, max_new_tokens=256)
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

class prosecutorAgent(BaseAgent):
    name = "Prosecutor"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)
        prompt = prosecutor_template(text)
        raw = llm_generate(prompt, max_new_tokens=256)
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

class JudgeAgent(BaseAgent):
    name = "Judge"
    def run(self, text: str, responses: Dict[str, str], memory: Memory) -> str:
        memory.add("user", text)
        prompt = judge_template(text, responses)
        raw = llm_generate(prompt, max_new_tokens=256)
        answer = extract_answer(raw)
        answer = sanitize_output(answer)
        memory.add(self.name, answer)
        return answer

class guideAgent(BaseAgent):
    name = "Guide"
    def run(self, text: str, memory: Memory) -> str:
        memory.add("user", text)
        prompt = Guide_template(text, memory)   # ⚠️ Guide_template 要改成只接受一個參數
        raw = llm_generate(prompt, max_new_tokens=256)
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
    contract_keywords = ["合約", "合同", "遺囑", "租約"]
    if has_contract or (len(text) > 100 and any(k in t for k in contract_keywords)):
        return "Contract"

    # 2. 如果是法律相關問題 → Negotiate
    if any(k in t for k in ["法律", "合約", "合同", "訴訟", "法官", "律師", "檢控", "起訴", "辯護", "遺囑", "遺產"]):
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

def text_overlap_ratio(a: str, b: str) -> float:
    a_set = set(a.split())
    b_set = set(b.split())
    inter = a_set & b_set
    union = a_set | b_set
    return len(inter) / max(len(union), 1)

def negotiate_stream(user_question: str, memory: Memory, max_rounds: int = 4, tolerance: float = 0.6):
    responses: Dict[str, str] = {}

    # 第一輪
    lawyer_r1 = lawyerAgent().run(user_question, memory)
    responses["lawyer_r1"] = lawyer_r1
    yield f"data: {json.dumps({'agent': 'Lawyer', 'round': 1, 'output': lawyer_r1}, ensure_ascii=False)}\n\n"

    prosecutor_r1 = prosecutorAgent().run(user_question, memory)
    responses["prosecutor_r1"] = prosecutor_r1
    yield f"data: {json.dumps({'agent': 'Prosecutor', 'round': 1, 'output': prosecutor_r1}, ensure_ascii=False)}\n\n"

    # 後續多輪
    for r in range(2, max_rounds + 1):
        lawyer_reply = lawyerAgent().run(f"控方律師上一輪的意見是：{responses[f'prosecutor_r{r-1}']}", memory)
        responses[f"lawyer_r{r}"] = lawyer_reply
        yield f"data: {json.dumps({'agent': 'Lawyer', 'round': r, 'output': lawyer_reply}, ensure_ascii=False)}\n\n"

        prosecutor_reply = prosecutorAgent().run(f"辯護律師上一輪的意見是：{responses[f'lawyer_r{r-1}']}", memory)
        responses[f"prosecutor_r{r}"] = prosecutor_reply
        yield f"data: {json.dumps({'agent': 'Prosecutor', 'round': r, 'output': prosecutor_reply}, ensure_ascii=False)}\n\n"

        if text_overlap_ratio(responses[f"lawyer_r{r}"], responses[f"prosecutor_r{r}"]) >= tolerance:
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

    # 專門解析 instances 格式
    instances = body.get("instances", [])
    if not instances or "text" not in instances[0]:
        def empty():
            yield f"data: {json.dumps({'error': '沒有輸入文字'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(empty(), media_type="text/event-stream")

    prompt = instances[0]["text"]
    has_contract = body.get("has_contract", False)
    memory = Memory()

    def event_stream():
        routed = route_task(prompt, has_contract)

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


