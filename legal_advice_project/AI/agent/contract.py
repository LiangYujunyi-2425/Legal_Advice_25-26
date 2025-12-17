# agent/contract.py
from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime

router = APIRouter()

SYSTEM_PROMPT = """
你是一名律師，正在進行合同諮詢。請根據香港法例從專業角度分析用戶提供的合同條款指出其風險並解釋你的推理。
用繁體中文回答，如有英文單詞請翻譯成繁體中文。如有實際案例請指出，不需要假設不存在的事實。
請給我乾淨的回答，並使用點列方式輸出回覆。
""".strip()

@router.post("/")
async def contract(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    user_question = body.get("user_question")

    if not session_id or not user_question:
        return {"ok": False, "agent": "contract", "error": "Missing session_id or user_question"}

    model = get_model()
    if model is None:
        return {"ok": False, "agent": "contract", "error": "GenerativeModel not initialized"}
    
        doc_ref = db.collection("conversations").document(session_id)
    doc = doc_ref.get()
    history = doc.to_dict().get("messages", []) if doc.exists else []

    # 把歷史訊息拼接成文字
    history_text = "\n".join([f"{m['role']}: {m['content']}" for m in history])



    try:
        resp = model.generate_content(f"{SYSTEM_PROMPT}\n{history_text}\n{user_question}".strip())
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "contract", "error": "No candidates returned"}

        answer = resp.candidates[0].content.parts[0].text.strip()
    except Exception as e:
        return {"ok": False, "agent": "contract", "error": str(e)}

    # Firestore logging
    doc_ref = db.collection("conversations").document(session_id)
    agent_msg = {"role": "contract", "content": answer, "timestamp": datetime.datetime.utcnow().isoformat()}

    doc_ref.set({
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, merge=True)

    doc_ref.update({
        "messages": firestore.ArrayUnion([agent_msg])
    })


    return {"ok": True, "agent": "contract", "answer": answer}