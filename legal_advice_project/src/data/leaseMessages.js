// 示例对话数据：香港租房合约注意事项（供前端泡泡 agent 播放用）
export const leaseMessages = {
  conversationId: 'hk-lease-01',
  title: '香港租房合約 — 四方討論',
  messages: [
    { id: 1, seq: 1, role: 'judge', speakerName: '法官', avatarKey: 'judge', type: 'explanation', text: '我們要把討論集中在簽合約時應注意的法律與證據問題。首先，合同當事人身份與簽署日期必須明確，避免日後爭議。' },
    { id: 2, seq: 2, role: 'lawyer', speakerName: '律師', avatarKey: 'lawyer', type: 'explanation', text: '核心要點：租期、租金及繳付方式、押金條款、修繕責任、轉租/分租限制、提前終止條款、押金退還條件、違約責任以及爭議解決方式（例如仲裁或法院管轄）。' },
    { id: 3, seq: 3, role: 'property_manager', speakerName: '房產經理', avatarKey: 'manager', type: 'tip', text: '實務提示：建議將租金繳付日期和逾期利息寫清楚，註明接受的支付方式（例如本地銀行轉賬、支票或FPS）。同時記錄收據以備將來參考。' },
    { id: 4, seq: 4, role: 'owner', speakerName: '業主', avatarKey: 'owner', type: 'explanation', text: '我通常會在合約中寫明物業交付時的物品清單和狀況（例如家電、家具），並要求租客在入住前完成點交表並簽名確認。' },
    { id: 5, seq: 5, role: 'lawyer', speakerName: '律師', avatarKey: 'lawyer', type: 'clause', text: '示例條款（押金）：“租客須在簽署本合約時向業主支付相當於兩個月租金的押金；業主須在租期屆滿且確認物業無損壞後十個工作日內退還押金（扣除合理維修費用）。”' },
    { id: 6, seq: 6, role: 'property_manager', speakerName: '房產經理', avatarKey: 'manager', type: 'tip', text: '入伙／交還程序：建議在合約附上“入伙檢查表”（Inventory & Condition Report），並由雙方簽署並附檔，以避免退租糾紛。' },
    { id: 7, seq: 7, role: 'owner', speakerName: '業主', avatarKey: 'owner', type: 'explanation', text: '關於修繕責任：一般日常小修由租客負責（例如燈泡、輕微磨損），重大維修由業主負責。合約要明確哪些屬於“重大維修”。' },
    { id: 8, seq: 8, role: 'lawyer', speakerName: '律師', avatarKey: 'lawyer', type: 'clause', text: '示例條款（維修）：“業主負責結構性維修及供水、供電等重大設施的維修；租客須在發現問題後盡快以書面形式通知業主，租客不得擅自進行影響結構或共用設施的改動。”' },
    { id: 9, seq: 9, role: 'judge', speakerName: '法官', avatarKey: 'judge', type: 'explanation', text: '證據角度：書面合約優先。口頭約定難以執行，若依賴口頭承諾，建議把關鍵承諾寫進合約或配套郵件/短信存證。' },
    { id: 10, seq: 10, role: 'property_manager', speakerName: '房產經理', avatarKey: 'manager', type: 'tip', text: '若允許養寵物或改裝（如釘牆），應在合約註明具體條件和押金/恢復原狀的要求，以免退租爭議。' },
    { id: 11, seq: 11, role: 'owner', speakerName: '業主', avatarKey: 'owner', type: 'tip', text: '若業主需進入物業檢查或維修，應規定合理提前通知（例如24或48小時），並註明緊急情況的例外。' },
    { id: 12, seq: 12, role: 'lawyer', speakerName: '律師', avatarKey: 'lawyer', type: 'explanation', text: '爭議解決建議：優先約定協商及調解步驟，然後註明法院管轄（一般可指定香港法院）。若考慮更快速的處理，可約定仲裁並明確仲裁地點和規則。' },
    { id: 13, seq: 13, role: 'judge', speakerName: '法官', avatarKey: 'judge', type: 'tip', text: '提醒：合約不得含有違法條款，例如試圖免除因業主嚴重疏忽導致的人身傷害責任的約定，法院通常不會支持此類免责條款。' },
    { id: 14, seq: 14, role: 'lawyer', speakerName: '律師', avatarKey: 'lawyer', type: 'clause', text: '示例條款（提前終止）：“若一方嚴重違約（包括拖欠租金達連續兩個月），守約方有權提前終止合約並要求賠償；提前終止須書面通知並提供合理寬限期（例如14天）以糾正違約行為。”' },
    { id: 15, seq: 15, role: 'property_manager', speakerName: '房產經理', avatarKey: 'manager', type: 'tip', text: '保險建議：業主應考慮購買物業保險並建議租客自行購買租客財產保險，合約可以要求租客對其個人財產自行負責。' },
    { id: 16, seq: 16, role: 'owner', speakerName: '業主', avatarKey: 'owner', type: 'tip', text: '合約末尾應列出雙方聯繫方式、緊急聯絡人，以及一個發現問題後的聯絡與修復流程，方便實際執行。' },
    { id: 17, seq: 17, role: 'lawyer', speakerName: '律師', avatarKey: 'lawyer', type: 'explanation', text: '最後提醒：如果租約金額或條款重大，建議雙方在簽署前讓律師審閱，特別是對押金保護、返還機制及任何不平等條款進行把關。' },
    { id: 18, seq: 18, role: 'judge', speakerName: '法官', avatarKey: 'judge', type: 'tip', text: '證據保留小結：保留簽署的合約原件、入伙/退伙點交表、所有收據與通信紀錄。若發生糾紛，這些是最重要的證據。' }
  ]
};

export default leaseMessages;
