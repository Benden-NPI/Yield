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
cd "<本專案路徑>\Yield"

# ── 步驟 0：先把會鎖檔案的程式停掉（避免 npm install / git pull 失敗）──
#   - 關閉 VS Code（或至少關閉 Yield 這個資料夾的視窗）
#   - 關閉所有開著 client/src/assets/、client/node_modules/ 的檔案總管視窗
#   - 系統匣對 OneDrive 圖示按右鍵 →「暫停同步」→ 2 小時
#     （OneDrive + node_modules / package-lock.json 是地雷組合，
#      會造成 EBUSY/EPERM 或 lock 衝突）

# ── 步驟 1：清掉殘留的 stash（若上次 pull 失敗時被自動 stash）──
git stash list
git stash drop                       # 若上方列出 "local lock before sync" 之類的壞 stash 才需要

# ── 步驟 2：放棄 package-lock.json 的本地修改 ──
#   (這是最常見的擋路兇手：本地 lock 有改動會讓 git pull 拒絕 fast-forward)
git checkout -- client/package-lock.json
#   ※ 千萬不要手動編輯 package-lock.json，永遠交給 npm install 自動生成。

# ── 步驟 3：確認 working tree 乾淨 ──
git status                           # 必須看到 "nothing to commit, working tree clean"
#   若還有其他 modified 檔案，先處理（commit / stash / checkout --）再繼續。

# ── 步驟 4：從遠端抓最新並切到目標分支 ──
git fetch origin                     # 必要，不可省略
git checkout <branch-name>           # 例如 copilot/xxx 或 main
git pull                             # 必要，不可省略
git log --oneline -3                 # 必須目視確認 HEAD 是預期的 commit（不要假設 pull 成功）

# ── 步驟 5：安裝相依 + 啟動 dev server ──
cd client
npm install                          # package.json 變動時才會真的裝新套件，例如 html2canvas-pro
npm run dev                          # → http://localhost:5188

# ── 步驟 6：瀏覽器強制重新整理：Ctrl + F5（或無痕視窗）──
```

注意事項：
- 千萬不要直接 `npm run dev` 就以為看到了最新版——若沒先 `git fetch origin` + `git pull`，本機還是舊 code。
- **`git pull` 後務必 `git log --oneline -1` 目視驗證 commit hash**，不要假設 pull 一定成功。
- 步驟 1~3 是「上次更新失敗才需要」的清理步驟；若 `git status` 本來就乾淨，可直接從步驟 4 開始。
- 若改用 `npm run preview`，每次都必須先 `npm run build`，否則看到的是舊 `dist/`。
- 變更若還只在 PR 分支，main 不會有；要確定自己在正確的分支。

### 上次踩過的雷（為什麼需要步驟 0~3）
- **症狀**：`git pull` 沒報明顯錯誤，但 `npm run dev` 起來還是舊版、新套件（`html2canvas-pro`）沒裝到。
- **根因**：`client/package-lock.json` 有本地修改（可能是上次 `npm install` 被打斷，或 OneDrive 改寫造成），讓 `git pull` 無法 fast-forward，實際還停在舊 commit；連帶 `package.json` 也是舊的，`npm install` 自然不會去裝新相依。
- **解法**：步驟 0 停掉 OneDrive/VS Code 解除檔案鎖 → 步驟 2 `git checkout -- client/package-lock.json` 還原 lock → 步驟 4 才能真的 pull 到新版 → 步驟 5 才會真的裝新套件。
