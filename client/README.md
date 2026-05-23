# Yield client（React + TypeScript + Vite）

良率管理系統的前端。請從**專案根目錄**透過 `npm run dev` / `npm run build` 啟動，
詳細請參考根目錄 [`README.md`](../README.md)。

## 直接在這個資料夾操作

```bash
npm install
npm run dev      # http://localhost:5188
npm run build    # 產生 dist/
npm run preview  # http://localhost:5188 預覽 build 結果
npm run lint
```

## 結構

- `src/components/` — UI 元件（Ant Design）
- `src/hooks/useYieldData.ts` — Zustand store + localStorage 存取
- `src/hooks/useExcelExport.ts` — 匯出 Excel 的封裝
- `src/utils/excelExport.ts` — SheetJS 匯出實作
- `src/types/yield.ts` — 共用型別與常數
- `vite.config.ts` — Vite dev / preview 固定在 port 5188 (`strictPort: true`)
