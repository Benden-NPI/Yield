# 開發環境備忘

## Port 使用情況
- **5173 / 5174 已被其他 HTML 專案佔用**，因此本專案的 Vite dev server 預設改成 **5188**（見 `client/vite.config.ts` 的 `server.port` / `preview.port`，並開啟 `strictPort` 避免被自動換 port）。
- 兩種啟動方式都跑在 5188：
  - **開發模式（hot reload）**：`npm run dev` → Vite dev server，網址 http://localhost:5188
  - **生產模式（Node 後端服務 build 結果）**：`PORT=5188 npm run serve`（Windows PowerShell 用 `$env:PORT=5188; npm run serve`）

## 前端服務架構
- `src/server.js` 會先從 `client/dist/`（React build 結果）找檔案；
- 找不到時 fallback 到 `public/`（舊版 HTML，如 `/yield.html`、`/index.html` 工作看板）；
- 都找不到、且路徑沒有副檔名時，回傳 React 的 `index.html`（SPA fallback）。
- Vite dev server (npm run dev) 完全不會經過 `src/server.js`，只服務 React，但會把 `/api` 反向代理到 `http://localhost:3000`（後端）。

## 跑測試與 build
- 後端測試：`npm test`
- Build 前端：`npm run build:client`
- 純後端啟動（服務 client/dist + public）：`npm start`
- Build + 後端啟動：`npm run serve`
- 前端開發（推薦日常開發用，hot reload）：`npm run dev`

## PowerShell 設環境變數
PowerShell 不支援 `PORT=xxx command` 這種 bash 寫法，要改成：
```powershell
$env:PORT=5188
npm run serve
```
