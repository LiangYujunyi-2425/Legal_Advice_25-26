# agent/reviewer.py
from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime
import httpx

router = APIRouter()

SYSTEM_PROMPT = """
你是一個資深法律審查員，負責審查並修改其他律師的文章。
要求:
  檢查文章是否有法律錯誤或遺漏，
  在必要時修正文章。
  請只回傳修正後文章的文字，
  不需要輸出建議或評論，
  不要加入假設。
  點列方式輸出，
  請用繁體中文回答。
""".strip()

@router.post("/")
async def reviewer(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    agent_answer = body.get("agent_answer")
    user_question = body.get("user_question")
    agent_type = body.get("agent_type", "unknown")

    if not session_id or not agent_answer:
        return {"ok": False, "agent": "reviewer", "error": "Missing session_id or agent_answer"}

    model = get_model()
    if model is None:
        return {"ok": False, "agent": "reviewer", "error": "GenerativeModel not initialized"}

    try:
        resp = model.generate_content(
            f"{SYSTEM_PROMPT}\n用戶問題:\n{user_question}\n律師回覆:\n{agent_answer}"
        )
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "reviewer", "error": "No candidates returned"}
        reviewed_answer = resp.candidates[0].content.parts[0].text.strip()
    except Exception as e:
        return {"ok": False, "agent": "reviewer", "error": str(e)}

    # Firestore logging
    agent_msg = {agent_type: reviewed_answer}
    doc_ref = db.collection("conversations").document(session_id)
    doc_ref.set({"expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)}, merge=True)
    doc_ref.update({"messages": firestore.ArrayUnion([agent_msg])})

    # 呼叫 Summarizer
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            print(f"[Reviewer] Calling Summarizer with: {reviewed_answer}")
            reviewer_resp = await client.post(
                "http://localhost:8080/summarizer/",  # ✅ 改成 Cloud Run URL
                json={
                    "session_id": session_id,
                    "user_question": user_question,
                    agent_type: reviewed_answer
                }
            )
            print(f"[Reviewer] Summarizer HTTP status: {reviewer_resp.status_code}")
            print(f"[Reviewer] Summarizer raw response: {reviewer_resp.text}")
            try:
                reviewer_data = reviewer_resp.json()
            except Exception:
                return {"ok": False, "agent": "reviewer", "error": f"Summarizer returned invalid response: {reviewer_resp.text}"}
    except Exception as e:
        return {"ok": False, "agent": "reviewer", "error": f"Reviewer call failed: {str(e)}"}

    return {
        "ok": True,
        "agent": "reviewer",
        "agent_type": agent_type,
        "reviewed_answer": reviewed_answer,
        "summarizer_result": reviewer_data
    }