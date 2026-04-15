# 実装計画: URLリンク化機能

## 概要

`PropertyInfoCard.tsx` の `PropertyFullDetails` インターフェースに `storage_location`、`image_url`、`pdf_url` を追加し、既存の `suumo_url` / `google_map_url` と同じパターンでリンク表示する。変更対象は1ファイルのみ。

## タスク

- [x] 1. `PropertyFullDetails` インターフェースにフィールドを追加する
  - `frontend/frontend/src/components/PropertyInfoCard.tsx` を開く
  - `PropertyFullDetails` インターフェースに `storage_location?: string`、`image_url?: string`、`pdf_url?: string` を追加する
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. URLリンクのJSXを追加する
  - [x] 2.1 `storage_location` のリンク表示を追加する
    - 既存の `suumo_url` / `google_map_url` のリンク表示と同じ `Box` グループ内に追加する
    - `{property.storage_location && (...)}` の条件付きレンダリングで実装する
    - ラベル「保存場所」、リンクテキスト「保存場所を開く」、`LaunchIcon` を使用する
    - `target="_blank" rel="noopener noreferrer"` を設定する
    - _Requirements: 1.4, 4.1_

  - [x] 2.2 `image_url` のリンク表示を追加する
    - `storage_location` と同じパターンで実装する
    - ラベル「画像」、リンクテキスト「画像を開く」、`LaunchIcon` を使用する
    - `target="_blank" rel="noopener noreferrer"` を設定する
    - _Requirements: 1.5, 4.1_

  - [x] 2.3 `pdf_url` のリンク表示を追加する
    - `storage_location` と同じパターンで実装する
    - ラベル「PDF」、リンクテキスト「PDFを開く」、`LaunchIcon` を使用する
    - `target="_blank" rel="noopener noreferrer"` を設定する
    - _Requirements: 1.6, 4.1_

- [x] 3. チェックポイント - 実装確認
  - TypeScriptの型エラーがないことを確認する（`getDiagnostics` で確認）
  - URLが `null` / `undefined` の場合にリンクが表示されないことをコードレビューで確認する
  - 全リンクに `target="_blank"` と `rel="noopener noreferrer"` が設定されていることを確認する
  - 疑問点があればユーザーに確認する

## Notes

- 変更対象は `frontend/frontend/src/components/PropertyInfoCard.tsx` の1ファイルのみ
- バックエンドの変更は不要（`select('*')` で全フィールドが返される）
- `PropertyListingDetailPage` は変更不要（確認済み）
- 既存の `suumo_url` / `google_map_url` の実装パターンに従うこと
