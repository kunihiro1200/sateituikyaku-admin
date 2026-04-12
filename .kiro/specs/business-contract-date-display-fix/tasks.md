# 実装タスク: 媒介作成完了日付表示バグ修正

## Tasks

- [x] 1. WorkTaskSection.tsx の formatValue 関数を修正
  - [x] 1.1 日付判定条件に `key.includes('completed')` を追加して `mediation_completed` にマッチさせる
  - [x] 1.2 修正後、`formatValue('mediation_completed', '2026-04-11T00:00:00.000Z')` が `'2026/4/11'` を返すことを確認
  - [x] 1.3 既存フィールド（`mediation_deadline` 等）の動作が変わらないことを確認

- [x] 2. WorkTaskDetailModal.tsx の mediation_completed フィールドを修正
  - [x] 2.1 `MediationSection` 内の `EditableField` に `type="date"` を追加
  - [x] 2.2 修正後、DATEピッカーが表示されることを確認

- [x] 3. デプロイ
  - [x] 3.1 フロントエンドをVercelにデプロイ（`sateituikyaku-admin-frontend`）
