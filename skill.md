# 開發 / 整合技巧筆記（Skill Notes）

本檔記錄一些不屬於程式碼本體、但在串接外部系統時很容易踩雷的「眉角」。
寫法以「**問題 → 解法 → 為什麼**」三段式為主，方便日後複習。

---

## 1. Power Automate 可以直接設定日期欄位格式 ✅

### 問題
SharePoint List 的 `Date` 欄位透過 Power Automate HTTP-trigger Flow 回傳時，
原生格式常常是 ISO 字串或 RFC1123（例如 `"Fri, 01 May 2026 00:00:00 GMT"`），
前端 `useSharePointSync.ts` 雖然已經做了容錯解析（見 `deriveMonth()`），
但只要來源格式不一致就會出現「某些 row 找不到 Date」的雜訊。

### 解法
**在 Power Automate Flow 內就把日期格式統一好**，不要把這件事丟給前端。
作法：在 Flow 的 *Select* 或 *Compose* 動作中，用 `formatDateTime()` 表達式
把 SharePoint 取回的 Date 欄位轉成想要的格式，再放進 Response body。

範例（Flow 表達式）：

```
formatDateTime(item()?['Date'], 'yyyy-MM-dd')
```

放在 *Select* 動作的 mapping：

```
{
  "ItemInternalId": "@{item()?['ID']}",
  "PN":             "@{item()?['PN']}",
  "Date":           "@{formatDateTime(item()?['Date'], 'yyyy-MM-dd')}",
  ...
}
```

這樣 HTTP Response 回來的 `Date` 欄位就一定是 `yyyy-MM-dd`，
前端 `deriveMonth()` 的第一條 regex 分支就會 100% 命中，
不用再走 `new Date(rawDate)` 的 fallback。

### 為什麼這樣做比較好
- **單一來源、單一格式**：時區、locale、夏令時等所有怪事都在 Flow 端解掉，
  前端只負責「拿到字串、切年月日」。
- **可重用**：未來若多接一個 SharePoint list，Flow 端統一格式後，
  前端不必再改容錯邏輯。
- **可觀測**：Flow run history 直接看得到輸出長相，比在瀏覽器 console 印 log 好除錯。

### 相關程式位置
- `client/src/hooks/useSharePointSync.ts`：`DATE_KEY_CANDIDATES`、`deriveMonth()`
- 同檔頂部 JSDoc 註解描述了預期的 row shape（`"Date": "yyyy-mm-dd"`）

---

> 之後若再發現其他類似「外部系統能搞定就別丟給前端」的眉角，
> 請繼續往本檔新增條目，並維持「問題 → 解法 → 為什麼」格式。
