# Yield 良率管理系統

純前端的良率管理工具，使用 **React + TypeScript + Vite + Ant Design**，資料儲存在瀏覽器的 `localStorage`，**不需要後端**。

## 專案結構

```
Yield/
├── client/                  # 前端原始碼（Vite + React + TS）
│   ├── src/
│   │   ├── components/      # UI 元件 (YieldInputTable, YieldChart, FilterPanel, ExportButton)
│   │   ├── hooks/           # Zustand store + Excel 匯出
│   │   ├── types/           # 共用 TypeScript 型別
│   │   └── App.tsx
│   ├── vite.config.ts       # dev/preview 固定在 port 5188
│   └── package.json
├── package.json             # 根 package.json，scripts 都 delegate 到 client/
├── memory.md                # 開發備忘（port、環境等）
└── README.md
```

## 開發

第一次先安裝依賴：

```bash
npm run install:client
```

啟動開發伺服器（hot reload）：

```bash
npm run dev
```

瀏覽器打開 http://localhost:5188

## 其他指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動 Vite dev server (port 5188) |
| `npm run build` | 編譯 + 打包到 `client/dist/` |
| `npm run preview` | 預覽打包結果（port 5188） |
| `npm run lint` | ESLint 檢查 |

## 主要功能

- 依 Month × PN 輸入每筆良率資料
- 對每個 defect (Leakage / Flatness / Pressure Drop / TTV) 輸入 **loss 數量**，系統自動換算良率
- 圖表（Recharts）+ 篩選（月份 / 料號）
- 匯出 Excel（SheetJS）

## 資料儲存

所有資料儲存於瀏覽器 `localStorage`，key 為 `yield_records`。清除瀏覽器資料會清空所有紀錄，建議定期使用「匯出 Excel」備份。
