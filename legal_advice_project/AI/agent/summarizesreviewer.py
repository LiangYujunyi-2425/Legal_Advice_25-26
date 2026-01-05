from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime

router = APIRouter()

SYSTEM_REVIEW = """
你是一個AI短期記憶管理員，你的目的是讓候選摘要與既有摘要加上連接詞串聯成一篇文章，令AI(自己)可以通過這個文章記起和用戶之間的對話內容。
要求:
  能讓AI(自己)只通過這一篇文章就知道用戶和AI(自己)之間的所有對話內容。
  在必要時修正(增加或刪減)文章。
  不要加入新的假設。
  請只回傳修正(增加或刪減)後文章的文字，
  不需要任何格式標記，只需要文章的文字，
  如沒有既有摘要，請直接回傳候選摘要。
  請用繁體中文回答。
示例1:
既有摘要(最近):他向我打招呼，我回應了他。
候選摘要:他告訴我他的姓氏是陳，我回應了他。
修正後的文章:
他向我打招呼，我回應了他。然後他告訴我他的姓氏是陳，我回應了他。

示例2:
既有摘要(最近):他向我打招呼，我回應了他。然後他告訴我他的姓氏是陳，我回應了他。
後選摘要: 他向我說明其實他姓謝，我回應了他。
修正後的文章:
他向我打招呼，我回應了他。然後他告訴我他的姓氏是謝，我回應了他。

示例3:
既有摘要(最近):他向我打招呼，我回應了他。然後他告訴我他的姓氏是陳，我回應了他。
候選摘要: 他問了我出門忘帶身份證的後果，我向他解釋了根據《人事登記條例》的相關法律規定，指出忘帶身份證可能導致觸犯法律、面臨執法行動及潛在法律責任，並強調攜帶身份證的重要性。
修正後的文章:
他向我打招呼，我回應了他。然後他告訴我他的姓氏是陳，我回應了他。接著他問了我出門忘帶身份證的後果，我向他解釋了根據《人事登記條例》的相關法律規定，指出忘帶身份證可能導致觸犯法律、面臨執法行動及潛在法律責任，並強調攜帶身份證的重要性。

示例3:
既有摘要(最近):
候選摘要:他向我打招呼，我回應了他。
修正後的文章:
他向我打招呼，我回應了他。
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

    recent_text = "\n".join([s.get("content", "") for s in summaries[-1:] if isinstance(s, dict)])

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