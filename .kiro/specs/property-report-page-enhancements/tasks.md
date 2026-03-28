# 実装計画: 物件リスト報告ページ改善

## 概要

`PropertyReportPage.tsx` に2つの改善を加える。
1. 送信履歴テーブルを常に5行固定表示（スクロール対応）に変更
2. 送信履歴テーブルの下に `CompactBuyerListForProperty` コンポーネントを追加

## タスク

- [x] 1. `getDisplayRows` ヘルパー関数を実装する
  - [x] 1.1 `PropertyReportPage.tsx` に `getDisplayRows` 関数を追加する
    - 引数: `history: ReportHistory[]`, `rowCount: number = 5`
    - 戻り値: `(ReportHistory | null)[]`（不足分は `null` で埋める）
    - 5件超の場合はそのまま全件返す
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.2 `getDisplayRows` のプロパティテストを書く
    - **Property 1: 送信履歴テーブルは常に5行を表示する**
    - **Validates: Requirements 1.1, 1.2**
    - **Property 2: 空行は「-」で埋められる**
    - **Validates: Requirements 1.2, 1.6**
    - テストファイル: `frontend/frontend/src/__tests__/propertyReportPage.property.test.ts`
    - 0〜9件の各パターンで `rows.length >= 5` を検証
    - 5件未満の場合、末尾が `null` で埋まっていることを検証

- [x] 2. 送信履歴テーブルを5行固定表示に変更する
  - [x] 2.1 `PropertyReportPage.tsx` の送信履歴テーブルを `getDisplayRows` を使って書き換える
    - 「送信履歴はありません」の条件分岐を削除し、常にテーブルを表示する
    - `TableContainer` に `maxHeight` と `overflow: 'auto'` を設定してスクロール対応
    - `null` 行は `hover` なし・`cursor: 'default'`・各セルに「-」を表示
    - 実データ行は既存の `onClick`（ダイアログ表示）と `hover` を維持
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. チェックポイント - テストが通ることを確認する
  - 全テストが通ることを確認し、疑問があればユーザーに確認する。

- [x] 4. 買主テーブルを報告ページに追加する
  - [x] 4.1 `PropertyReportPage.tsx` に買主データ取得ロジックを追加する
    - `buyers` ステートと `buyersLoading` ステートを追加
    - `fetchBuyers` 関数を実装（`/api/property-listings/${propertyNumber}/buyers` を呼び出す）
    - エラー時は無視して空配列をセット（スナックバー通知なし）
    - 既存の `useEffect` に `fetchBuyers()` を追加
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 4.2 `fetchBuyers` のプロパティテストを書く
    - **Property 3: 買主データ取得失敗時は空リストを表示する**
    - **Validates: Requirements 2.5**
    - APIエラー時に `buyers` が空配列になることを検証
    - テストファイル: `frontend/frontend/src/__tests__/propertyReportPage.property.test.ts`

  - [x] 4.3 `PropertyReportPage.tsx` に `CompactBuyerListForProperty` を追加する
    - `CompactBuyerListForProperty` をインポートする
    - 送信履歴テーブルの下（前回メール内容の下）に配置する
    - `buyers`・`propertyNumber`・`loading={buyersLoading}` を props として渡す
    - _Requirements: 2.1, 2.2, 2.6, 2.7_

- [x] 5. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認し、疑問があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 各タスクは対応する要件番号を参照している
- プロパティテストは設計ドキュメントの Correctness Properties に対応している
- 変更はフロントエンドのみ（バックエンドAPIは既存のものを使用）
