# Skill Notes — Yield 專案踩雷與正解總整理

本檔把 PR #7 ~ #13 一系列「**從地端 npm dev 改成 GitHub Pages 雲端部署 + 把 SharePoint Excel 透過 Power Automate 接成 JSON 給前端**」過程中遇到的所有眉角、try-and-error，依主題重新歸納。
寫法統一採「**問題 → 解法 → 為什麼 / 細節**」三段式。

對應 PR 索引：
- 部署相關：#7 / #8 / #9 / #10
- SharePoint × Power Automate 同步：#11 / #12 / #13

---

## A. 從地端 dev server 改成 GitHub Pages 雲端部署

原本流程：每個使用者要自己 `git clone` → `npm install` → `npm run dev` → 開 `http://localhost:5188`。
目標：推到 `main` 後自動 build & 部署，使用者只要打開 `https://benden-npi.github.io/Yield/` 就能用，**不用裝 Node**。
（限制：`localStorage` 仍是每個瀏覽器各自獨立，這次 PR 只解「散發」，不解「跨人共用資料」。）

### A1. 為什麼選 GitHub Pages，不選 SharePoint hosting
- 程式碼本來就在 GitHub。
- App 是純前端（Vite SPA，資料只存 `localStorage`），不需要 server-side runtime。
- SharePoint 掛 SPA 路由、MIME、CSP 都很容易出怪事。
- 對應 PR：**#7**。

### A2. Vite 的 `base` 一定要設成 sub-path
**問題**：GitHub Pages 走 `https://<user>.github.io/<repo>/` 子路徑，預設 `base: '/'` 出來的 `index.html` 會去抓 `/assets/xxx.js`（根目錄），404。

**解法**：`client/vite.config.ts` 設定
```ts
base: '/Yield/',
```
若日後 repo 改名，這裡要同步改。

### A3. SPA 直連子路徑會 404 → 用 `404.html` fallback
**問題**：GitHub Pages 是靜態 server，使用者直接貼某個前端 route 進來，server 找不到對應檔案就回 404，SPA 沒機會接管。

**解法**：在 workflow build 完之後加一步
```yaml
- name: Copy index.html as 404.html (SPA fallback)
  run: cp dist/index.html dist/404.html
```
GitHub Pages 找不到資源時會回 `404.html`，內容跟 `index.html` 相同，React Router 在 client 端就能接走。

### A4. Pages 第一次部署失敗：`Get Pages site failed ... HttpError: Not Found`
**問題**：`actions/configure-pages@v5` 預設假設 repo 已在 Settings → Pages 啟用過，第一次跑就直接 404 fail。

**正解（兩段式，最終版）**：
1. 對 `actions/configure-pages@v5` 加 `enablement: true`（PR #9），讓 action 用既有 `pages: write` 權限自動建 site。
2. 但有些 org 不允許 token-based enable，所以加一道 **pre-check**（PR #8）：先 `curl` 打 `/repos/{owner}/{repo}/pages`：
   - `200` → `enabled=true`，正常走 `configure-pages` / `upload-pages-artifact` / `deploy-pages`。
   - `404` → `enabled=false`，後續所有 Pages 步驟 `if:` 掉，並 `::warning::` 提醒去 Settings 手動開。
   - 其他 status code → 真錯誤，`exit 1`。
3. `deploy` job 用 `needs.build.outputs.pages_enabled == 'true'` gate 住，避免在沒開 Pages 的 repo 上整條 workflow 紅燈。

完整檔在 `.github/workflows/deploy-pages.yml`。

**為什麼這樣設計**：build 本身永遠要成功（CI 健康度），Pages 部署是 nice-to-have，沒開就 graceful skip，不要把整個 workflow 拖紅。

### A5. 一次性手動步驟（無法自動化）
即使有 `enablement: true`，repo owner 仍需要做一次：
1. Settings → Pages → **Source = GitHub Actions**。
2. Merge PR 到 `main`，workflow 自動跑。
3. 完成後網址 `https://benden-npi.github.io/Yield/`。

### A6. GitHub Actions Node.js 20 即將被下架
**問題**：runner 警告 `actions/checkout@v4` / `actions/setup-node@v4` 跑在 Node 20，2026-06-02 起會被禁用、2026-09-16 移除。

**解法**（PR #10）：兩個 action 升到 `@v5`（自帶 Node 24 runtime）。
```yaml
- uses: actions/checkout@v5
- uses: actions/setup-node@v5
  with:
    node-version: '20'      # 注意：這個是 build 用的 Node，跟 action runtime 無關，不用動
```

**陷阱**：不要把 `setup-node` 的 `node-version: '20'` 也改掉——那是專案 build 工具鏈版本，跟 action 本身執行環境是兩回事。

### A7. concurrency 設定避免重疊部署
```yaml
concurrency:
  group: pages
  cancel-in-progress: true
```
連續 push 到 `main` 時，舊的 build 會被新的取消，不會有兩個 deploy job 互相搶 Pages。

---

## B. SharePoint Excel → Power Automate → JSON → 前端

目標：使用者在 SharePoint 維護的 List（原本是 Excel），透過 Power Automate HTTP-trigger Flow 暴露成 JSON，前端 `useSharePointSync` 拉回來覆寫 `localStorage`。

### B1. Power Automate Flow 的最小契約
Flow 必須：
1. 用 **HTTP request trigger（manual / When a HTTP request is received）** 啟動。
2. 內部 **Get items**（SharePoint） → **Select / Compose** 把欄位轉成想要的 shape。
3. **Response** action 回傳 JSON。

前端期望的 row shape（欄位 display name）：
```jsonc
{
  "ItemInternalId": "<guid>",        // 當 id 用
  "PN":             "<string>",
  "Date":           "yyyy-MM-dd",    // 或退而求其次給 "Month": "May"
  "Input":          "<number-as-string>",
  "Leak Fail":      "<number-as-string>",
  "Flatness Fail":  "<number-as-string>",
  "Pressure drop Fail": "<number-as-string>",
  "TTV Fail":       "<number-as-string>"
  // Yield ratio 欄位前端會自己重算，不要也行
}
```

### B2. Webhook URL 要存 `localStorage`，不能 commit
**問題**：HTTP trigger URL 帶 `?sig=<token>`，等同密鑰，commit 進 source 就外洩。

**解法**：`SHAREPOINT_URL_STORAGE_KEY = 'yield_sharepoint_webhook_url'`，每個使用者第一次在 Settings tab 貼一次，後續存在自己瀏覽器的 `localStorage`。檔案：`client/src/hooks/useSharePointSync.ts`。

### B3. Response 可接受兩種 JSON 形狀
前端容許：
- 裸 array：`[{...}, {...}]`
- 或包一層：`{ "value": [{...}, {...}] }`

兩種 Flow 寫法（Response body 直接接 Select output / Response body 接 Get items 原始輸出）都能用。

### B4. 同步是「整批覆寫」而非「增量合併」
按下「從 SharePoint 同步」會 `replaceRecords(mapped)`，**直接覆蓋本機所有 records**。UI 有 `Popconfirm` 二次確認。設計理由：SharePoint 是 single source of truth，避免合併時 id 對不上造成幽靈資料。

---

## C. 設定細節：日期 / 欄位名稱

這一塊踩了最久。整個 PR #12 + #13 都在處理「Power Automate / SharePoint 傳回來的欄位名稱和值格式跟想像中不一樣」。

### C1. ⭐ 日期格式：在 Power Automate 端就統一成 `yyyy-MM-dd`（最重要）
**問題**：SharePoint 原生 Date 欄位透過 Flow 出來可能是 ISO、RFC1123（`"Fri, 01 May 2026 00:00:00 GMT"`）、locale string（`"5/1/2026"`）、或 SharePoint 預設帶時間的 ISO。格式不一致，前端怎麼寫容錯都會漏。

**正解**：在 Flow 的 *Select* / *Compose* 直接用 `formatDateTime` 表達式把日期轉成固定格式，再丟進 Response：
```
formatDateTime(item()?['Date'], 'yyyy-MM-dd')
```
範例 Select mapping：
```jsonc
{
  "ItemInternalId": "@{item()?['ID']}",
  "PN":             "@{item()?['PN']}",
  "Date":           "@{formatDateTime(item()?['Date'], 'yyyy-MM-dd')}",
  "Input":          "@{item()?['Input']}",
  "Leak Fail":      "@{item()?['Leak_x0020_Fail']}"
}
```

**為什麼**：
- 單一格式，前端 `deriveMonth()` 第一條 regex `^(\d{4})-(\d{2})-(\d{2})` 就 100% 命中，不用走 `new Date(rawDate)` fallback。
- 時區 / locale / 夏令時的所有怪事，在 Flow 端就解掉。
- Flow run history 看得到輸出長相，比瀏覽器 console 好除錯。

### C2. SharePoint 欄位名稱會被「重新編碼」，不能用字面值索引
**問題**（PR #12 的根因）：第一版前端寫 `row.Date` / `row['Leak Fail']`，結果**每一筆都 `undefined`**，UI 顯示「4 筆缺少 Date 欄位」。
原因是 SharePoint / Power Automate 對欄位名稱有一套自己的編碼規則：
- `Date` 是 reserved-ish，內部會被改名成 `Date0` 或 `OData__x0044_ate`。
- 空白變 `_x0020_`：`Leak Fail` → `Leak_x0020_Fail`。
- display name vs internal name 還會因 Flow action 不同（Get items 出 internal、Select 出 display）而切換。

**正解**：寫一個 **tolerant key resolver**，把 key 做 normalization 再比對。

```ts
function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, ''); // 砍掉所有非字母數字
}

function pickKey(row, candidates: string[]): unknown {
  const wanted = candidates.map(normKey);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(normKey(k))) return v;
  }
  return undefined;
}
```
這樣 `Date` / `Date0` / `OData__x0044_ate` / `date` / `日期` 在 normalize 後都很容易撞在一起，`Leak Fail` 跟 `Leak_x0020_Fail` 也都歸一成 `leakfail`。

實作：`client/src/hooks/useSharePointSync.ts` 的 `normKey()` + `pickKey()`。

### C3. 欄位 candidate list 要列出已知變體
PR #12 + #13 累積出來的清單（在 `useSharePointSync.ts`）：
- **Date**：`Date`, `Date0`, `Date1`, `OData__x0044_ate`, `EventDate` / `Event Date`, `RecordDate` / `Record Date`, `ReportDate` / `Report Date`, `DateTime` / `Date Time`, `ProductionDate` / `Production Date`, `Created`, `Modified`, `Title`, `日期`
- **Id**：`ItemInternalId`, `ID`, `Id`
- **PN**：`PN`, `P/N`, `PartNumber`
- **Losses**：
  - `Leak Fail` / `LeakFail` / `Leakage Fail`
  - `Flatness Fail` / `FlatnessFail`
  - `Pressure drop Fail` / `PressureDropFail` / `Pressure Drop Fail`
  - `TTV Fail` / `TTVFail`

新欄位 / 新命名變體時，往對應 candidate 陣列加字串即可，不必動 `pickKey` 邏輯。

### C4. 日期值容錯：fast path + `new Date()` fallback（Flow 沒統一格式時的安全網）
即使 C1 已建議在 Flow 端轉好，前端仍保留兩段式解析：
```ts
// 1. fast path: 開頭 yyyy-mm-dd
const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);

// 2. fallback: 交給 JS 引擎解 ISO / RFC1123 / 美式 / 歐式
const d = new Date(rawDate);
```
**重點**：fallback 用 `d.getUTC*()`（`getUTCFullYear` / `getUTCMonth` / `getUTCDate`），不要用 `d.getFullYear()`。
**為什麼**：`new Date("2026-05-01")` 在 ISO date-only 規格上是 UTC 午夜；用本地 getter 在 UTC-N 時區會掉到 4/30，整月分類錯位。

### C5. 數值欄位也要寬鬆轉型
SharePoint 數字欄位可能回字串，所以前端統一 `toNumber()`：
```ts
function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
```
非數字 / `null` / `undefined` 一律當 `0`，不會讓圖表變 `NaN`。

---

## D. Try-and-Error 全紀錄（含正解）

下表把過程中所有踩過的雷集中起來，方便 future self / 其他人快速 grep。

| # | 症狀 | 真正原因 | 正解 | 來源 |
|---|------|----------|------|------|
| 1 | Pages 部署 `Get Pages site failed ... 404` | Pages 從未在 Settings 啟用 | `configure-pages` 加 `enablement: true`，並加 pre-check 對 `/repos/.../pages` curl，404 就 graceful skip | PR #9 / #8 |
| 2 | build job 整條紅燈 | workflow 假設 Pages 已開，所有 Pages step 沒守 if | 用 `pages-status.outputs.enabled` gate 住 `configure-pages` / `upload-pages-artifact` / `deploy` job | PR #8 |
| 3 | 直連 sub-route 404 | GitHub Pages 是純靜態 server，沒有 SPA fallback | `cp dist/index.html dist/404.html` | PR #7 |
| 4 | 部署後資源全 404 | Vite 預設 `base: '/'` 不認 sub-path | `vite.config.ts` 設 `base: '/Yield/'` | PR #7 |
| 5 | Actions 警告 Node 20 即將下架 | `checkout@v4` / `setup-node@v4` 跑 Node 20 runtime | 兩者升 `@v5`（Node 24）。**不要動** `setup-node` 的 `node-version: '20'`（那是 build toolchain） | PR #10 |
| 6 | SharePoint sync 全部 row 都「缺少 Date」 | `row.Date` 字面索引拿不到，SharePoint 把 `Date` 改名成 `Date0` / `OData__x0044_ate`；`Leak Fail` 變 `Leak_x0020_Fail` | 寫 `normKey()` + `pickKey(row, candidates[])`，比對前先正規化 | PR #12 |
| 7 | 加了 tolerant matcher 仍有筆數 missing Date | 欄位名稱是其他變體（`Date1`, `EventDate`, `RecordDate`, `日期`…） | 擴充 `DATE_KEY_CANDIDATES`；無法窮舉時，依下一項用 log 找出實際 key 再加 | PR #13 |
| 8 | console.warn 印出來是 `Array(13)` / `Object` 看不到 key | 直接把物件丟進 `console.warn` 在某些 console 會 collapse，copy-paste 也只剩 placeholder | 改成 `console.warn(\`...keys=[${keys.join(', ')}] row=${JSON.stringify(firstRow)}\`)`，single string 一定能複製 | PR #13 |
| 9 | Date 格式有時是 ISO 有時是 `Fri, 01 May 2026 00:00:00 GMT` 解析不到 | 只寫 `^yyyy-mm-dd` regex | 加 `new Date(rawDate)` fallback，並用 `getUTC*` 避免時區漂移；**更上游的正解**是 Flow 端用 `formatDateTime(..., 'yyyy-MM-dd')` 強制統一 | PR #13 / C1 |
| 10 | date-only 字串掉一天（5/1 變 4/30） | `new Date("2026-05-01")` 是 UTC 午夜，`getMonth()` 用本地時區 | 全部用 `getUTCFullYear` / `getUTCMonth` / `getUTCDate` | PR #13 |
| 11 | Webhook URL 不小心想 commit | URL 帶 `?sig=` token | 一律存 `localStorage`（`SHAREPOINT_URL_STORAGE_KEY`），由使用者在 Settings tab 自己貼 | PR #11 |
| 12 | 同步後 yield 比例對不上 | Flow 把 yield 比例欄位也回傳了，但前端會自算 | 前端忽略 yield 欄位，永遠以 input / loss 重算 | PR #11 |
| 13 | Response 拿到的有時是 array、有時是 `{ value: [...] }` | Flow 兩種 Response 寫法都常見 | 前端兩種都接：先 `Array.isArray(raw)`，再 fallback 看 `raw.value` | PR #11 |

---

## E. 地端更新流程：從 PR merge 到 `npm run dev` 看到新版

雲端 Pages 是給「使用者」開的；開發者本機要驗 PR、跑 HMR、debug，還是得拉下來跑 dev server。
這個流程**步驟不能跳**，跳了會出現「`git pull` 沒報錯但實際還是舊 code」的鬼故事（見 E5 踩雷紀錄）。

### E1. 前置：先在 GitHub 端 Merge PR，再把本機會鎖檔案的東西停掉
1. **在 GitHub 上 Merge PR** 到目標分支（通常是 `main`）。
   - 沒 merge 就 pull `main`，本機自然看不到變更。
   - 若只是要驗 PR 還沒 merge，就把 E3 的 `<branch-name>` 改成那個 PR 的 `copilot/xxx` 分支即可。
2. Windows / OneDrive 環境是地雷區，動 git / npm 之前先：
   - 關閉 **VS Code**（或至少關閉 Yield 資料夾的視窗）。
   - 關掉所有開著 `client/src/assets/`、`client/node_modules/` 的檔案總管視窗。
   - 系統匣 **OneDrive 圖示 → 右鍵 → 暫停同步 2 小時**。
     - OneDrive + `node_modules` / `package-lock.json` 是地雷組合，會造成 `EBUSY` / `EPERM` 或 lock 衝突。

### E2. 清掉殘留髒東西（只有上次更新失敗才需要）
**順序很重要**：先看 stash 再還原 lock，避免把有用的 stash 砍掉、或在還沒檢查狀態前就動檔案。
```powershell
# 1) 先看 stash 列表（不會改任何東西）
git stash list

# 2) 確認是 "local lock before sync" 之類的壞 stash 才 drop；其他 stash 不要動
git stash drop                       # 只在 stash list 有壞 stash 時執行

# 3) 還原 package-lock.json 的本地修改（最常見的擋路兇手）
git checkout -- client/package-lock.json
#   ※ 千萬不要手動編輯 package-lock.json，永遠交給 npm install 自動生成
```
若一開始 `git stash list` 就空、`git status` 也乾淨，整個 E2 可以跳過直接到 E3。

### E3. 從遠端抓最新並切到目標分支（**絕對不能跳**）
```powershell
# 1) 先確認 working tree 乾淨；不乾淨就回 E2 處理
git status                           # 必須看到 "nothing to commit, working tree clean"

# 2) 從遠端抓最新
git fetch origin                     # 必要

# 3) 切到目標分支（剛 merge 完通常是 main；驗 PR 則是 copilot/xxx）
git checkout <branch-name>

# 4) 拉新 commit
git pull                             # 必要

# 5) 目視確認 HEAD 是預期 commit，不要假設 pull 成功
git log --oneline -3
```
- `git status` 在 fetch / checkout 之前先檔住，避免帶著未提交的本地修改硬切分支造成衝突。
- `git fetch origin` 跟 `git pull` **任何一個都不能省**。
- `git pull` 後務必 `git log --oneline -1` 確認 commit hash，pull 失敗不一定會明顯報錯。

### E4. 裝相依 + 啟動 dev server
```powershell
cd client
npm install                          # package.json 變動時才會真的裝新套件（例如 html2canvas-pro）
npm run dev                          # → http://localhost:5188
```
然後瀏覽器 **Ctrl + F5**（或無痕視窗）強制 reload，避免吃到舊的 service worker / cache。

### E5. 上次踩過的雷（為什麼 E1~E2 看似多餘卻不能省）
- **症狀**：`git pull` 沒報明顯錯誤，但 `npm run dev` 起來還是舊版、新套件（`html2canvas-pro`）沒裝到。
- **根因**：`client/package-lock.json` 有本地修改（可能是上次 `npm install` 被打斷，或 OneDrive 改寫造成），讓 `git pull` 無法 fast-forward，實際還停在舊 commit；連帶 `package.json` 也是舊的，`npm install` 自然不會去裝新相依。
- **解法**：E1 停掉 OneDrive/VS Code 解除檔案鎖 → E2 `git checkout -- client/package-lock.json` 還原 lock → E3 才能真的 pull 到新版 → E4 才會真的裝新套件。

### E6. 常見替代路徑（什麼時候用 dev、什麼時候用 preview）
| 情境 | 指令 | 注意 |
|------|------|------|
| 寫 code / debug，要 HMR | `npm --prefix client run dev` | 改檔即時 reload |
| 模擬 production build（測 `base: '/Yield/'`、minify、PDF 樣式） | `npm run build` → `npm run preview` | **每次都要先 build**，否則看到的是舊 `dist/` |
| 純驗證版本號是不是新的 | 看右上角 header tag 的 `APP_VERSION` | 對不上代表 cache 沒清乾淨，回 Ctrl+F5 |

### E7. 一鍵清單（最簡版，working tree 乾淨時）
```powershell
# 前提：GitHub 上 PR 已經 Merge 到目標分支
cd "<本專案路徑>\Yield"
git status                      # 確認 working tree 乾淨
git fetch origin
git checkout <branch>
git pull
git log --oneline -1            # 目視驗 commit
cd client
npm install
npm run dev                     # → http://localhost:5188，瀏覽器 Ctrl+F5
```

---

## F. 給 future self 的 checklist

新增 / 修改 Flow 時：
- [ ] HTTP trigger 的 URL 不要進 source code。
- [ ] Date 欄位用 `formatDateTime(item()?['Date'], 'yyyy-MM-dd')` 統一格式。
- [ ] 欄位名稱在 Response body 用 display name（`PN`, `Leak Fail`...），不要用 internal name（`Leak_x0020_Fail`）；即使寫錯前端 `pickKey` 也救得回，但 display name 比較好維護。
- [ ] 多加新欄位時，記得回頭更新 `useSharePointSync.ts` 的 candidate 陣列。

修改 Pages workflow 時：
- [ ] 不要把 `setup-node` 的 `node-version` 跟 action runtime 版本搞混。
- [ ] 任何新增的 Pages-only step 都要 gate `if: steps.pages-status.outputs.enabled == 'true'`。
- [ ] 改 repo 名要同步改 `vite.config.ts` 的 `base`。

修改前端解析時：
- [ ] 任何「從外部資料源拿欄位」的地方，都該透過 `pickKey()` 而不是字面 index。
- [ ] 任何「解析日期字串」的地方，都要記得 `getUTC*`。
- [ ] 加 fallback 之前先問：能不能在上游（Flow / API）就解決？
