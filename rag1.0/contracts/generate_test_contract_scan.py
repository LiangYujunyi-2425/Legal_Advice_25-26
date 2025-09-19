from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

contract_text = """
僱傭合約

本合約由以下雙方訂立：

僱主：ABC 公司
僱員：張三

第一條（工作內容）
僱員需履行公司安排之職務，包括但不限於文件處理、客戶服務及資料輸入。

第二條（工作時間）
僱員每週工作 48 小時，星期一至星期六，每日 8 小時。

第三條（薪酬）
僱員之月薪為港幣 10,000 元，每月最後一日支付。

第四條（休息日及假期）
僱員每週享有一天休息日，並享有法定假期。

第五條（合約期限）
本合約期限為兩年，自 2025 年 1 月 1 日起至 2026 年 12 月 31 日止。

第六條（解約通知）
任何一方欲終止合約，須提前 3 日以書面通知對方。

第七條（競業限制）
僱員於離職後 12 個月內，不得在香港任何與公司業務相關之企業任職。

第八條（保密條款）
僱員不得於任職期間及離職後，向第三方披露有關公司之商業秘密。

第九條（其他）
本合約受香港特別行政區法律管轄。
"""

output_path = "employment_contract_test_scan.pdf"

# 建立 PDF 畫布
c = canvas.Canvas(output_path, pagesize=A4)
width, height = A4

# 分行寫入文字
y = height - 50
for line in contract_text.split("\n"):
    c.drawString(50, y, line.strip())
    y -= 20
    if y < 50:  # 換頁
        c.showPage()
        y = height - 50

c.save()
print(f"✅ 已生成 {output_path}")
