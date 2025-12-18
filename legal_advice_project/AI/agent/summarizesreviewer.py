from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime

router = APIRouter()

SYSTEM_REVIEW = """
你是一個AI短期記憶管理員，你的目的是讓候選摘要與既有摘要上下文連貫，令自己可以通過這些摘要記起和用戶之間的對話內容。
請確保候選摘要與既有摘要上下文連貫，並在必要時修正。
可以作出適當精簡。
可以作出適當推理，但不要加入新的假設。
請只回傳修正後的摘要文字
""".strip()

@router.post("/")
async def summarizesreviewer(request: Request):
    body = await request.json()
    session_id = body.get("session_id")
    candidate = body.get("candidate")

    if not session_id or not candidate:
        return {"ok": False, "agent": "reviewer", "error": "Missing session_id or candidate"}

    # 讀取最近 summaries
    doc_ref = db.collection("conversations").document(session_id)
    doc = doc_ref.get()
    data = doc.to_dict() or {}
    summaries = data.get("summaries", [])
    if isinstance(summaries, dict):
        summaries = [summaries]
    elif not isinstance(summaries, list):
        summaries = []

    recent_text = "\n".join([s.get("content", "") for s in summaries[-3:] if isinstance(s, dict)])

    model = get_model()
    try:
        resp = model.generate_content(
            f"{SYSTEM_REVIEW}\n既有摘要(最近):\n{recent_text}\n候選摘要:\n{candidate}"
        )
        if not getattr(resp, "candidates", None):
            return {"ok": False, "agent": "reviewer", "error": "No candidates returned"}

        raw = resp.candidates[0].content.parts[0].text.strip()
    except Exception as e:
        return {"ok": False, "agent": "reviewer", "error": str(e)}

    # 決定最終寫入的摘要
    if "pass" in raw.lower():
        final_summary = candidate
    else:
        final_summary = raw  # 直接把模型回傳的文字寫入

    if not final_summary.strip():
        return {"ok": False, "agent": "reviewer", "error": "Empty summary, not writing to Firestore"}

    # Firestore 寫入
    summaries.append({"content": final_summary})
    doc_ref.set({
        "expireAt": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        "summaries": summaries
    }, merge=True)

    print(f"[Reviewer] Raw model output: {raw!r}")
    print(f"[Reviewer] Final summary: {final_summary}")

    return {"summary": final_summary}