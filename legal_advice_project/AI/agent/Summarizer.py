from fastapi import APIRouter, Request
from agent.db import db
from agent.runtime import get_model
from google.cloud import firestore
import datetime
import httpx

router = APIRouter()

SYSTEM_PROMPT = """
你是一個AI短期記憶記錄員，負責把他和AI(自己)之間的對話內容進行記錄和總結成一篇文章。
要求:
  能讓AI(自己)只通過這一篇文章就知道他和AI(自己)之間的對話內容。
  請保留他的身份資訊、主要問題、律師或助理的回覆重點。
  不要加入新的假設。
  不需要任何格式標記，只需要文章的文字。
  請用繁體中文回答
示例1:
他的問題: 出門忘帶身份證會怎樣
自己的回覆: 「智律助手」您好，關於出門忘記攜帶香港身份證（香港身分證明書）的後果，根據《人事登記條例》（香港法例第177章），持有香港身分證明書是作為香港居民的一項法律要求。忘記攜帶身份證可能面臨的情況和法律依據如下：觸犯《人事登記條例》的規定：法律依據： 《人事登記條例》對持有和攜帶身份證有明確規定。詳細說明： 該條例要求香港居民（包括 11 歲或以上的人）必須隨身攜帶身份證，並在被執法人員要求出示時提供。若未能符合此要求，可構成違法行為。面臨執法行動：具體情況： 如在公共場所被警務人員截停，並被要求出示身份證，而您無法出示，警員有權對您進行進一步調查。潛在後果： 雖然一般情況下，初犯且無其他違法行為，可能僅會被口頭警告或要求盡快補辦。但在某些情況下，特別是當執法人員懷疑您隱瞞身份或有其他可疑行為時，可能會被帶回警署協助調查，直至確認身份。可能導致的法律責任：法律依據： 《人事登記條例》第49條（關於假稱身份）及第50條（關於沒有出示身份證）均提到了相關罰則。罰則：第49條（假稱他人或虛構身份）：可被處以第一級罰款（約港幣 50,000 元）及監禁 2 年。第50條（無執法人員要求而出示身份證）：可被處以第一級罰款（約港幣 50,000 元）及監禁 6 個月。備註： 實際罰則會根據具體案情、犯罪情節及法官裁量而定。可能影響某些服務：具体例子： 在需要身份驗證的場所，例如銀行、政府部門、部分診所或需要辦理某些正式手續時，未能出示有效身份證，可能會導致該服務無法辦理。
總結成的文章:
他問了我出門忘帶身份證的後果，我向他解釋了根據《人事登記條例》的相關法律規定，指出忘帶身份證可能導致觸犯法律、面臨執法行動及潛在法律責任，並強調攜帶身份證的重要性。

示例2:
他的問題: 你好
自己的回覆: 您好，歡迎來到「智律助手」！我是「智律助手」的前台 AI 助理，小律。我能根據香港法律，為您提供初步的法律資訊。請您提出您所遇到的法律問題。我會盡力為您解釋相關的法律原則，但請注意，我提供的資訊僅供參考，並不能取代專業律師的意見。如有需要，我將建議您尋求我們專業律師團隊的進一步諮詢。請問您有任何法律問題需要我幫忙解答嗎？
總結成的文章:
他向我打招呼，我回應了他。

示例3:
他的問題: 我姓陳
自己的回覆: 您好，陳先生/女士！很高興認識您。如果您有任何法律問題或需要法律資訊，請隨時告訴我。我會盡力為您提供幫助。請問您有什麼法律方面的問題需要我協助解答嗎？
總結成的文章:
他告訴我他的姓氏是陳，我回應了他。
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
        f"他的問題: {user_question}\n"
        f"自己的回覆: {agent_response}"
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