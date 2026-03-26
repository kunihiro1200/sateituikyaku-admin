# 実装計画: property-detail-copy-and-header-info

## 概要

フロントエンドのみの2つの改善を実装します。
1. `PropertyListingDetailPage.tsx` のコピーアイコンを MUI `Tooltip` でラップ
2. `WorkTaskDetailModal.tsx` の DialogTitle に物件情報 Chip を横スクロール表示

## タスク

- [x] 1. PropertyListingDetailPage.tsx のコピーボタンを Tooltip に変更
  - `title="物件番号をコピー"` 属性を MUI `<Tooltip title="物件番号をコピー">` に置き換える
  - `Tooltip` が既にインポート済みであることを確認（インポート済みのため追加不要）
  - _Requirements: 1.6_

  - [ ]* 1.1 Property 1 のプロパティテストを作成
    - **Property 1: コピー操作でclipboardに正しい値が書き込まれる**
    - **Validates: Requirements 1.2**
    - `frontend/frontend/src/pages/__tests__/PropertyListingDetailPage.copy.test.tsx` に fast-check を使用して実装

  - [ ]* 1.2 Property 2・3 のプロパティテストを作成
    - **Property 2: コピー成功後にアイコンが切り替わり2秒後に戻る**
    - **Property 3: コピー成功後にスナックバーが表示される**
    - **Validates: Requirements 1.3, 1.4**

- [x] 2. WorkTaskDetailModal.tsx の DialogTitle に物件情報 Chip を追加
  - `Chip` を `@mui/material` のインポートに追加
  - 物件番号 Box の右隣に横スクロール可能な `Box` を追加
  - `data?.property_address`・`data?.property_type`・`data?.seller_name`・`data?.sales_assignee`・`data?.mediation_type` を各 `Chip` で表示
  - 値が空・null・undefined の場合は `{data?.field && <Chip ... />}` パターンで非表示
  - 外側 Box に `overflow: 'hidden'`、物件番号 Box に `whiteSpace: 'nowrap'` を追加
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [ ]* 2.1 Property 4 のプロパティテストを作成
    - **Property 4: WorkTaskDetailModal ヘッダーに物件情報が表示される**
    - **Validates: Requirements 2.1, 2.3, 2.4**
    - `frontend/frontend/src/components/__tests__/WorkTaskDetailModal.header.test.tsx` に fast-check を使用して実装

- [x] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` 付きのサブタスクはオプション（スキップ可能）
- `Tooltip` は `PropertyListingDetailPage.tsx` に既にインポート済み
- `Chip` は `WorkTaskDetailModal.tsx` に未インポートのため追加が必要
- バックエンド変更は一切不要
