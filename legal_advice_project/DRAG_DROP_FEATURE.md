# 拖拽上傳功能 - 實現說明

## 功能概述

用戶現在可以直接拖拽 PDF 或圖片檔案到上傳與掃描面板，無需點擊上傳按鈕。

## 功能特性

### 1. 拖拽上傳
- **支持的檔案類型**：PDF、PNG、JPG、JPEG、GIF 等圖片格式
- **拖拽區域**：左側上傳與掃描面板
- **視覺反饋**：拖拽時面板顯示藍色高亮邊框和半透明背景

### 2. 自動處理
- **圖片檔案**：自動進行 OCR 文字識別
- **PDF 檔案**：直接上傳到後端進行分析
- **不支持的檔案**：控制台輸出錯誤信息

### 3. 雙重操作方式
- 拖拽檔案到面板
- 點擊標籤打開檔案選擇對話框（原有方式保留）

## 技術實現

### 前端修改 (`src/Title.jsx`)

#### 新增狀態
```javascript
const [dragActive, setDragActive] = useState(false);
const leftContentRef = useRef(null);
const fileInputRef = useRef(null);
```

#### 通用文件處理函數
```javascript
const handleFile = async (file) => {
  // 統一處理圖片和 PDF 檔案
  // 圖片進行 OCR 識別
  // PDF 直接上傳
}
```

#### 拖拽事件處理
- `handleDrag()` - 阻止瀏覽器預設行為
- `handleDragIn()` - 進入拖拽區域時激活視覺反饋
- `handleDragOut()` - 離開拖拽區域時關閉視覺反饋
- `handleDrop()` - 檔案放下時處理上傳

#### 事件監聽器注冊
```javascript
useEffect(() => {
  const element = leftContentRef.current;
  
  element.addEventListener('drag', handleDrag);
  element.addEventListener('dragenter', handleDragIn);
  element.addEventListener('dragleave', handleDragOut);
  element.addEventListener('dragover', handleDrag);
  element.addEventListener('drop', handleDrop);
  
  // 清理監聽器
  return () => { /* ... */ };
}, []);
```

### 前端樣式 (`src/index.css`)

#### 正常狀態
```css
.left-content {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  transition: all 200ms ease;
  border-radius: 12px;
  position: relative;
}
```

#### 拖拽激活狀態
```css
.left-content.drag-active {
  background-color: rgba(100, 150, 255, 0.15);
  border: 2px dashed #4a90e2;
  box-shadow: inset 0 0 8px rgba(74, 144, 226, 0.2);
}
```

## 使用方式

### 方式 1：拖拽上傳
1. 打開應用，在左側上傳面板中
2. 從文件夾拖拽 PDF 或圖片檔案
3. 放下檔案到面板上
4. 自動開始處理（OCR 或分析）
5. 結果在聊天窗口顯示

### 方式 2：點擊上傳（原有方式）
1. 點擊上傳面板中的 📄 標籤
2. 選擇 PDF 或圖片檔案
3. 自動開始處理
4. 結果在聊天窗口顯示

## 用戶體驗改進

### 視覺反饋
- 拖拽檔案進入區域時，面板邊框變為藍色虛線
- 背景色輕微改變，提示可以放下
- 放下檔案後立即開始處理

### 提示文本更新
```
原：「上傳 PDF 或點擊相機拍照進行 OCR」
新：「拖拽 PDF 或圖片到此處
    或點擊相機拍照進行 OCR」
```

### 檔案驗證
- 自動檢查檔案 MIME 類型
- 只接受 PDF 和圖片格式
- 其他格式顯示控制台錯誤提示

## 工作流程

```
用戶拖拽檔案到面板
        ↓
handleDrop() 獲取檔案
        ↓
檔案類型檢查 (圖片 vs PDF)
        ↓
    ├─→ 圖片：Tesseract OCR 識別
    │        ↓
    │   將文本發送 JSON
    │
    └─→ PDF：FormData 上傳
             ↓
        後端分析
        ↓
發送結果給 block.jsx
        ↓
聊天窗口顯示結果
```

## 處理流程時間

| 操作 | 預計時間 |
|------|--------|
| 拖拽和放下 | <100ms |
| 圖片 OCR 識別 | 2-5 秒 |
| 後端分析 | 1-3 秒 |
| 結果顯示 | <100ms |

## 檔案修改

### 修改的檔案
1. **`src/Title.jsx`**
   - 新增 `dragActive` 狀態
   - 新增 `leftContentRef` 和 `fileInputRef` 引用
   - 新增 `handleFile()` 通用處理函數
   - 新增拖拽事件處理函數
   - 新增拖拽事件監聽器
   - 更新 JSX 元素的 className 和 style

2. **`src/index.css`**
   - 新增 `.left-content.drag-active` 樣式
   - 增強 `.left-content` 過渡效果

## 向後兼容性

✅ 完全向後兼容
- 點擊上傳方式仍然正常運作
- 現有 OCR 和分析邏輯不變
- 原有的文件類型檢查保留
- 聊天集成方式不變

## 測試檢查清單

- [ ] 拖拽 PDF 檔案到面板
- [ ] 拖拽圖片檔案到面板
- [ ] 拖拽其他類型檔案（應顯示錯誤）
- [ ] 檢查視覺反饋（藍色邊框）
- [ ] 驗證 OCR 識別功能
- [ ] 驗證 PDF 分析功能
- [ ] 檢查結果在聊天窗口顯示
- [ ] 點擊上傳方式仍正常工作
- [ ] 多次拖拽檔案
- [ ] 快速連續拖拽多個檔案

## 使用建議

### 最佳實踐
1. **大檔案處理**：拖拽大型 PDF 時，頁面可能稍微卡頓，這是正常的
2. **多檔案支持**：目前每次只處理單個檔案，多檔案拖拽時只取第一個
3. **網絡連接**：確保網絡穩定，特別是上傳和分析時
4. **檔案格式**：使用清晰的掃描件或高質量的圖片以提高 OCR 準確度

### 故障排查

| 問題 | 解決方案 |
|------|--------|
| 拖拽無反應 | 確認瀏覽器支持拖拽（現代瀏覽器都支持） |
| 檔案不接受 | 檢查檔案類型，僅支持 PDF 和圖片 |
| OCR 失敗 | 檢查圖片清晰度，查看控制台錯誤信息 |
| 結果未顯示 | 檢查網絡連接，查看後端日誌 |

## 後續改進建議

1. **多檔案支持**：允許同時拖拽多個檔案進行批量處理
2. **進度提示**：在拖拽區域顯示 OCR/分析進度
3. **預覽**：拖拽檔案時顯示縮圖預覽
4. **歷史記錄**：保存最近上傳的檔案列表
5. **錯誤處理**：改進錯誤提示和恢復機制
6. **拖拽動畫**：添加拖拽和放下時的動畫效果

## 總結

拖拽上傳功能提供了更便捷的檔案上傳方式，用戶無需多次點擊即可上傳和分析檔案。通過清晰的視覺反饋和智能的檔案類型識別，提升了整體的用戶體驗。
