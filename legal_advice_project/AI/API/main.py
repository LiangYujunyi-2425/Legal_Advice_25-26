import json
import re
import requests
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from google.auth import default
from google.auth.transport.requests import Request as GoogleRequest

app = FastAPI()

PROJECT_ID = "imposing-coyote-475106-e7"
LOCATION = "asia-east1"
ENDPOINT_ID = "747036787213336576"

# === 呼叫 Vertex AI ===
def call_vertex_ai(prompt: str, timeout: int = 60) -> str:
    creds, _ = default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(GoogleRequest())
    token = creds.token

    url = f"https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT_ID}/locations/{LOCATION}/endpoints/{ENDPOINT_ID}:predict"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {"instances": [{"text": prompt}]}

    resp = requests.post(url, headers=headers, json=body, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["predictions"][0]["output"]

# === 輔助：抽取 <answer> ===
def extract_answer(text: str) -> str:
    m = re.search(r"<answer>(.*?)</answer>", text, re.DOTALL)
    return m.group(1).strip() if m else text.strip()

# === 雙回合協商 SSE ===
@app.post("/courtroom/stream")
async def courtroom_stream(request: Request):
    body = await request.json()
    user_question = body.get("question", "請提供一個法律問題")

    def event_generator():
        responses = {}

        # Round 1: 律師
        lawyer_r1_prompt = f"""
<instruction>
你是一名辯護律師，請用專業角度回答，並解釋你的回答。
限制：
- 僅用繁體中文回答
- 不要超過 25 字
</instruction>
<question>
{user_question}
</question>
"""
        responses["lawyer_r1"] = extract_answer(call_vertex_ai(lawyer_r1_prompt))
        yield f"data: {json.dumps({'lawyer_r1': responses['lawyer_r1']}, ensure_ascii=False)}\n\n"

        # Round 1: 檢控官
        prosecutor_r1_prompt = f"""
<instruction>
你是一名檢控官，請針對律師的回答提出批判或補充，並解釋你的回答。
限制：
- 僅用繁體中文回答
- 不要超過 25 字
</instruction>
<question>
用戶的問題：{user_question}
律師的回答：{responses['lawyer_r1']}
</question>
"""
        responses["prosecutor_r1"] = extract_answer(call_vertex_ai(prosecutor_r1_prompt))
        yield f"data: {json.dumps({'prosecutor_r1': responses['prosecutor_r1']}, ensure_ascii=False)}\n\n"

        # Round 2: 律師回應
        lawyer_r2_prompt = f"""
<instruction>
你是一名辯護律師，請回應檢控官的批判，堅持或修正立場，並解釋你的回答。
限制：
- 僅用繁體中文回答
- 不要超過 30 字
</instruction>
<question>
用戶的問題：{user_question}
檢控官的批判：{responses['prosecutor_r1']}
</question>
"""
        responses["lawyer_r2"] = extract_answer(call_vertex_ai(lawyer_r2_prompt))
        yield f"data: {json.dumps({'lawyer_r2': responses['lawyer_r2']}, ensure_ascii=False)}\n\n"

        # Round 2: 檢控官再反駁
        prosecutor_r2_prompt = f"""
<instruction>
你是一名檢控官，請針對律師的回應再次提出反駁，並解釋你的回答。
限制：
- 僅用繁體中文回答
- 不要超過 30 字
</instruction>
<question>
用戶的問題：{user_question}
律師的回應：{responses['lawyer_r2']}
</question>
"""
        responses["prosecutor_r2"] = extract_answer(call_vertex_ai(prosecutor_r2_prompt))
        yield f"data: {json.dumps({'prosecutor_r2': responses['prosecutor_r2']}, ensure_ascii=False)}\n\n"

        # 法官裁決
        judge_prompt = f"""
<instruction>
你是一名法官，請綜合雙方兩輪的觀點，做出評論與定論。
限制：
- 僅用繁體中文回答
- 不要超過 50 字
</instruction>
<question>
用戶的問題：{user_question}
律師第一輪：{responses['lawyer_r1']}
檢控官第一輪：{responses['prosecutor_r1']}
律師第二輪：{responses['lawyer_r2']}
檢控官第二輪：{responses['prosecutor_r2']}
</question>
"""
        responses["judge"] = extract_answer(call_vertex_ai(judge_prompt))
        yield f"data: {json.dumps({'judge': responses['judge']}, ensure_ascii=False)}\n\n"

        # 總結
        summarizer_prompt = f"""
<instruction>
你是一名總結者，請總結整個討論。
限制：
- 僅用繁體中文回答
- 不要超過 50 字
</instruction>
<question>
問題：{user_question}
律師第一輪：{responses['lawyer_r1']}
檢控官第一輪：{responses['prosecutor_r1']}
律師第二輪：{responses['lawyer_r2']}
檢控官第二輪：{responses['prosecutor_r2']}
法官定論：{responses['judge']}
</question>
"""
        responses["summarizer"] = extract_answer(call_vertex_ai(summarizer_prompt))
        yield f"data: {json.dumps({'summarizer': responses['summarizer']}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
