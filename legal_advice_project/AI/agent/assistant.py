from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime

router = APIRouter()

SYSTEM_PROMPT = """
你是一名人工智能:小律，你可以假設自己是一名律師事務所的前台，負責接待用戶。
用繁體中文回答
請給我乾淨的回答
""".strip()

@router.post("/")
async def assistant(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    user_question = body.get("user_question")

    if not session_id or not user_question:
        return {"ok": False, "agent": "assistant", "error": "Missing session_id or user_question"}

    model = get_model()
    if model is None:
        return {"ok": False, "agent": "assistant", "error": "GenerativeModel not initialized"}
    
    # Firestore logging
    doc_ref = db.collection("conversations").document(session_id)
    doc = doc_ref.get()
    data = doc.to_dict() or {}
    summaries = data.get("summaries", []) if doc.exists else []

    history_text = ""
    if isinstance(summaries, list):
        history_text = "\n".join([s.get("content", "") for s in summaries if isinstance(s, dict)])

    try:
        resp = model.generate_content(f"{SYSTEM_PROMPT}\n{history_text}\nuser: {user_question}")
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "assistant", "error": "No candidates returned"}

        answer = resp.candidates[0].content.parts[0].text.strip()
    except Exception as e:
        return {"ok": False, "agent": "assistant", "error": str(e)}

    # Firestore logging
    agent_msg = {
        "assistant": answer,
    }

    doc_ref.set({
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, merge=True)

    doc_ref.update({
        "messages": firestore.ArrayUnion([agent_msg])
    })

    return {"ok": True, "agent": "assistant", "answer": answer}