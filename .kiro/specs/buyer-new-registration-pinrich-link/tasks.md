# 実装計画: NewBuyerPage Pinrich リンク追加

## 概要

`NewBuyerPage.tsx` の Pinrich ドロップダウンフィールドの直下に、`https://pinrich.com/management/hankyo` への外部リンクを追加する。変更はフロントエンドのみ。

## タスク

- [x] 1. NewBuyerPage に Pinrich リンクを追加する
  - `frontend/frontend/src/pages/NewBuyerPage.tsx` を編集する
  - インポート済みの `OpenInNew` アイコン（`@mui/icons-material`）を確認し、`LaunchIcon` として使用するか、または `Link` コンポーネントを `@mui/material` からインポートする
  - Pinrich ドロップダウンを含む `<Grid item xs={12} sm={6}>` 内の `<FormControl>` の直後に `<Link>` コンポーネントを追加する
  - リンクの属性: `href="https://pinrich.com/management/hankyo"`, `target="_blank"`, `rel="noopener noreferrer"`
  - スタイル: `sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.875rem', mt: 0.5 }}`
  - リンクテキスト「Pinrichリンク」と外部リンクアイコンを表示する
  - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.1 ユニットテストを作成する（任意）
    - NewBuyerPage をレンダリングし、「Pinrichリンク」テキストを持つリンク要素が存在することを確認
    - `href` が `https://pinrich.com/management/hankyo` であることを確認
    - `target="_blank"` および `rel="noopener noreferrer"` 属性を確認
    - _要件: 1.1, 1.2, 1.5_

- [ ] 2. チェックポイント - 動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。
  - ブラウザで NewBuyerPage を開き、Pinrich ドロップダウンの下にリンクが表示されることを手動確認する。

## 注意事項

- `*` が付いたサブタスクは任意でスキップ可能
- `NewBuyerPage.tsx` には既に `OpenInNew` が `@mui/icons-material` からインポートされているため、追加インポートが不要な場合がある（`Link` は `@mui/material` からの追加インポートが必要）
- バックエンド・データベースへの変更は一切不要
