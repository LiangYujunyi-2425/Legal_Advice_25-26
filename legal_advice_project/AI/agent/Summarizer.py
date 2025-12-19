from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime
import httpx

router = APIRouter()

SYSTEM_PROMPT = """
你是一個AI短期記憶記錄員，負責把用戶和AI(自己)之間的對話內容進行記錄和總結成一篇文章。
要求:
  能讓AI(自己)只通過這一篇文章就知道用戶和AI(自己)之間的對話內容。
  請保留用戶的身份資訊、主要問題、律師或助理的回覆重點。
  不要加入新的假設。
  不需要任何格式標記，只需要文章的文字。
  請用繁體中文回答
""".strip()

@router.post("/")
async def summarizer(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    agent_response = body.get("assistant") or body.get("lawyer") or body.get("contract")
    user_question = body.get("user_question")

    if not session_id:
        return {"ok": False, "agent": "summarizer", "error": "Missing session_id"}
    
    model = get_model()
    if model is None:
        return {"ok": False, "error": "GenerativeModel not initialized"}

    # Firestore document reference
    doc_ref = db.collection("conversations").document(session_id)
    doc = doc_ref.get()
    data = doc.to_dict() or {}

    # 從 messages 欄位抓取最新的 user 和 agent 回覆
    messages = data.get("messages", [])
    if isinstance(messages, dict):
        messages = [messages]
    elif not isinstance(messages, list):
        messages = []

    user_question = ""
    agent_response = ""

    # 找出最新的 user 和 agent 訊息
    for m in reversed(messages):
        if not user_question and "user" in m:
            user_question = m["user"]
        elif not agent_response and "assistant" in m:
            agent_response = m["assistant"]
    # 如果還有其他角色，例如 lawyer/contract，可以加判斷
        elif not agent_response and "lawyer" in m:
            agent_response = m["lawyer"]
        elif not agent_response and "contract" in m:
            agent_response = m["contract"]
        if user_question and agent_response:
            break


    if not user_question or not agent_response:
        return {"ok": False, "agent": "summarizer", "error": "No user/agent messages found"}

    # 拼接需要摘要的內容
    text_to_summarize = (
        f"用戶問題: {user_question}\n"
        f"我的回覆: {agent_response}"
    )

    try:
        resp = model.generate_content(f"{SYSTEM_PROMPT}\n{text_to_summarize}")
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "summarizer", "error": "No candidates returned"}

        summary = resp.candidates[0].content.parts[0].text.strip()
    except Exception as e:
        return {"ok": False, "agent": "summarizer", "error": str(e)}

    # Firestore logging

    # summarizer.py 裡，在生成 summary 之後：
    candidate = summary
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "http://localhost:8080/summarizesreviewer/",  # reviewer 的 API endpoint
            json={"session_id": session_id, "candidate": candidate}
        )
        result = resp.json()

    print(f"Summarizer result: {result}")
    print(f"Candidate summary sent to reviewer: {candidate}")
    print(f"summary: {summary}")

    # reviewer 會負責檢查並寫入 Firestore
    return result