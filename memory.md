# 開發環境備忘

## Port 使用情況
- **5173 / 5174 已被其他 HTML 專案佔用**，因此本專案的 Vite dev / preview 固定使用 **port 5188**。
- 設定在 `client/vite.config.ts`：`server.port = 5188`、`preview.port = 5188`，並開 `strictPort: true`，5188 被佔用時直接報錯，不會偷偷換 port。

## 啟動方式（PowerShell 直接這樣打）
```powershell
cd "<本專案路徑>\Yield"
npm run install:client   # 只需第一次
npm run dev              # → http://localhost:5188
```

## 專案組成
- 純前端：`client/`（React + TypeScript + Vite + Ant Design + Recharts + Zustand + SheetJS）
- **沒有後端**：資料存於瀏覽器 `localStorage`（key: `yield_records`）
- 根 `package.json` 的 scripts 都只是把指令 delegate 到 `client/`

## 歷史包袱
- 已於 2026-05 清除：舊版 Node HTTP server (`src/`)、舊版 vanilla JS UI (`public/`)、舊版 work-item 系統 (`docs/`)、相關測試 (`test/`)。如需查詢可回 git 歷史。
