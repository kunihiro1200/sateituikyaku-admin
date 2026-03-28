# タスクリスト：1番電話ランキング表示（call-ranking-display）

## Tasks

- [x] 1. バックエンドAPIエンドポイントの実装
  - [x] 1.1 `GET /api/sellers/call-ranking` エンドポイントを `backend/src/routes/sellers.ts` に追加
  - [x] 1.2 JST当月範囲計算ロジックの実装
  - [x] 1.3 Supabaseクエリで集計・ソート処理の実装
- [x] 2. フロントエンドコンポーネントの実装
  - [x] 2.1 `CallRankingDisplay.tsx` コンポーネントの新規作成
  - [x] 2.2 `CallModePage.tsx` への組み込み
