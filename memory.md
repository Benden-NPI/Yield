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

## 取得最新變更 / 驗證 PR 的完整流程（請勿跳步驟）
每次 Copilot 或他人 push 新 commit 後，本機要看到更新務必依序執行：

```powershell
# 1. 從遠端抓最新的 refs（必要，不可省略）
git fetch origin

# 2. 切到目標分支（PR 分支或 main）並更新到最新
git checkout <branch-name>          # 例如 copilot/xxx 或 main
git pull                            # 必要，不可省略

# 3. 確認 HEAD 是預期的 commit
git log --oneline -1

# 4. 安裝相依（package.json 有變動時必跑；平時跑也安全）
cd client
npm install

# 5. 啟動 dev server（HMR）
npm run dev                         # → http://localhost:5188

# 6. 瀏覽器強制重新整理：Ctrl + F5（或無痕視窗）
```

注意事項：
- 千萬不要直接 `npm run dev` 就以為看到了最新版——若沒先 `git fetch origin` + `git pull`，本機還是舊 code。
- 若改用 `npm run preview`，每次都必須先 `npm run build`，否則看到的是舊 `dist/`。
- 變更若還只在 PR 分支，main 不會有；要確定自己在正確的分支。
