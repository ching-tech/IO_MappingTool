# 設備通訊 IO 對照表

工業設備與主系統（PLC / SCADA）之間的 IO 點位對照管理工具，純前端 Web App，不需後端伺服器。

## 功能特色

### 設備管理
- 左側清單新增、刪除、選擇、重新命名設備
- 每台設備獨立維護「發送 IO」與「接受 IO」兩張表

### IO 表格
| 欄位 | 說明 |
|------|------|
| 設備名稱 | 自動填入，唯讀 |
| 設備 IO 點位位址 | 可拖曳下拉填充（智慧遞增：DM0→DM1、DM0.0→DM0.1、MR0→MR1） |
| 訊號名稱 | 自由輸入 |
| 資料類型 | BOOL / UINT / INT / WORD / DWORD / FLOAT / STRING，可自訂新增 |
| 主系統點位位址 | 同樣支援拖曳下拉填充；重複位址自動黃色警示 |
| 備註 | 自由輸入 |

### 資料操作
- **欄位排序**：點擊表頭升冪/降冪/清除，支援自然排序（DM1 < DM2 < DM10）
- **只看完整**：只顯示已填寫「設備 IO 點位」與「訊號名稱」的列
- **完整行綠色背景**：一眼識別已完整填寫的資料行
- **跨格拖曳複製貼上**：拖曳選取儲存格範圍 → Ctrl+C 複製 → 點目標位置 → Ctrl+V 貼上（支援跨設備、跨表格）
- **批量替換**：整批搜尋取代位址（⚡ 批量替換按鈕），支援完整比對或包含文字，範圍可選目前設備或全部設備

### 檔案存取
- **開啟**：載入 JSON 專案檔
- **存檔**：直接覆寫目前檔案（File System Access API）
- **另存新檔**：另存為新 JSON 檔
- **匯出 Excel**：一設備一 Sheet，含所有 IO 欄位

### 主系統品牌
可選擇 KEYENCE / 三菱 / 西門子 / OMRON / Modbus / 自訂，切換後位址欄位顯示對應格式提示。

## 快速開始

```bash
cd app
npm install
npm run dev
```

開啟瀏覽器至 `http://localhost:5173`

## 建置

```bash
cd app
npm run build
# 輸出至 app/dist/
```

## 技術架構

| 技術 | 用途 |
|------|------|
| React 18 + TypeScript | 前端框架 |
| Vite | 建置工具 |
| TanStack Table v8 | 可排序表格 |
| Zustand | 全域狀態管理 |
| SheetJS (xlsx) | Excel 匯出 |
| File System Access API | 原生檔案讀寫（含 fallback） |

## 專案結構

```
app/
├── src/
│   ├── components/
│   │   ├── IOTable/         # 表格相關元件
│   │   │   ├── IOTable.tsx          # 主表格（含複製貼上）
│   │   │   ├── AddressCell.tsx      # 位址格（含下拉填充）
│   │   │   ├── EditableCell.tsx     # 可編輯文字格
│   │   │   ├── DataTypeCell.tsx     # 資料類型下拉
│   │   │   ├── BatchReplaceModal.tsx# 批量替換對話框
│   │   │   └── DataTypeManager.tsx  # 自訂資料類型管理
│   │   ├── Sidebar.tsx      # 設備清單
│   │   ├── Toolbar.tsx      # 工具列（存檔/開啟/匯出）
│   │   └── MainContent.tsx  # 主內容區
│   ├── store/
│   │   └── useProjectStore.ts  # Zustand store
│   ├── utils/
│   │   ├── addressUtils.ts     # 位址解析、遞增、重複偵測
│   │   └── fileUtils.ts        # 檔案讀寫、Excel 匯出
│   └── types/index.ts
└── package.json
```
