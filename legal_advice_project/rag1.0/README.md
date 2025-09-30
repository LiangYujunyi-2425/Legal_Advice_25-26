📑 RAG + 合約分析系統

本專案結合 RAG（檢索增強生成） 與 合約分析功能，支援 法律文件查詢 與 合約風險檢測。
採用 ChromaDB + BM25 作為檢索引擎，並透過 Gemini API 或 Ollama 本地 LLM 提供高準確度的回應。

🚀 功能特點

混合檢索 (Hybrid Search)：結合向量檢索 (Embedding) 與 BM25 關鍵字檢索。

重排序 (Reranker)：利用 Cross-Encoder 提升檢索準確度。

Gemini API 雙模型驗證：回答先由模型生成，再由第二個模型複核。

合約分析模組：

條款逐條分析

自動生成合約摘要

風險重點標註

文件輸入：支援 PDF / DOCX / TXT 合約。

報告輸出：一鍵匯出 Word 與 JSON 分析報告。

Web UI 啟動器：可選擇 LLM 模型，自動啟動 Ollama + Streamlit。

🏗 系統架構
📂 ragts2
 ┣ 📜 rag_pipeline2.0.py        # RAG 法律查詢 (Gemini 版本)
 ┣ 📜 contract_ingest.py        # 合約解析 + Embedding
 ┣ 📜 contract_pipeline.py      # 合約分析核心邏輯
 ┣ 📜 web_contract_ui_local.py  # Streamlit Web UI
 ┣ 📜 launcher.py               # 啟動器 (Ollama + Web UI)
 ┣ 📂 contracts/                # 存放測試合約
 ┣ 📂 chroma_db/                # Chroma 向量資料庫
 ┣ 📜 bm25_index.pkl            # BM25 索引
 ┣ 📜 requirements.txt          # 依賴套件
 ┗ 📜 .env                      # API Key (不要上傳到 GitHub)




************************************************************************************************************************




⚙️ 安裝步驟
1️⃣ 建立虛擬環境 (建議)
python -m venv .venv
.venv\Scripts\activate   # Windows
source .venv/bin/activate # macOS/Linux

2️⃣ 安裝依賴
pip install -r requirements.txt

3️⃣ 設定環境變數

建立 .env，內容如下：

GEMINI_API_KEY=你的_Gemini_API_Key

4️⃣ 初始化資料
python batch_cap4_1.0.py   # 建立向量資料庫 & BM25 索引

人話就是把.xml的文檔放到laws文件夾，然後運行batch_cap4.py就可以生成一個包含/laws文件夾裡所有數據的向量數據庫（chroma_db）

🖥 使用方式
啟動 RAG 查詢 （法律咨詢部分）
python rag_pipelinev2.py  #根據輸入的問題去數據庫裡尋找相關切片並一同丟給第一個LLM進行初次回答，然後將回答丟給第二個LLM進行完善再輸出

啟動合約檢測
python contract_pipeline2.0.py #對/contracts文件夾內所有文檔進行分析，並且將分析報告輸出到/reports文件夾

使用啟動器啟動web ui 
streamlit run launcher.py / 如果error就運行streamlit run launcher_cp.py

web_contract_ui_local.py是web ui的本體，有兩個版本，後綴cp 對應 cp（launcher_cp.py對應web_contract_ui_local.py）

.xml文檔轉換.md文檔
python md.py   （將需要轉換的.xml文檔放入/laws文件夾，輸出的.md文檔會存入/laws_md文件夾）


如果使用使用API例如gemini的LLM，記得掛vpn，不然會error
