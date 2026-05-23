# 開發環境備忘

## Port 使用情況
- **5173 / 5174 已被其他 HTML 專案佔用**，因此本專案的 Vite dev server (預設 5173) 在此機器上不可用。
- 本專案統一使用 **port 5188** 透過 Node 後端 (`src/server.js`) 提供前端畫面。
- 啟動方式：`PORT=5188 npm run serve`（會先 build React，再啟動 server）。
  - 若不需要重新 build，可改用 `PORT=5188 npm start`，但要確保 `client/dist/` 已存在。

## 前端服務架構
- `src/server.js` 會先從 `client/dist/`（React build 結果）找檔案；
- 找不到時 fallback 到 `public/`（舊版 HTML，如 `/yield.html`、`/index.html` 工作看板）；
- 都找不到、且路徑沒有副檔名時，回傳 React 的 `index.html`（SPA fallback）。

## 跑測試與 build
- 後端測試：`npm test`
- Build 前端：`npm run build:client`
- 純後端啟動：`npm start`
- Build + 啟動：`npm run serve`
