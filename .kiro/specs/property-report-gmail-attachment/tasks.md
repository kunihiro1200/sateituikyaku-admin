# 実装計画: property-report-gmail-attachment

## 概要

`PropertyReportPage.tsx` のGmail送信確認ダイアログに画像添付機能を追加する。
変更対象は `frontend/frontend/src/pages/PropertyReportPage.tsx` の1ファイルのみ。

## タスク

- [x] 1. インポートとステートの追加
  - `ImageSelectorModal` を `'../components/ImageSelectorModal'` からインポートする
  - `Image as ImageIcon` を `@mui/icons-material` からインポートする
  - `imageSelectorOpen`（boolean）・`selectedImages`（any[]）・`imageError`（string | null）の3つのステートを追加する
  - _Requirements: 1.1, 3.1, 3.3_

- [x] 2. ハンドラー関数の実装
  - [x] 2.1 `handleOpenImageSelector`・`handleImageSelectionConfirm`・`handleImageSelectionCancel` の3つのハンドラーを実装する
    - `handleImageSelectionConfirm` は `selectedImages` を保存し `imageSelectorOpen` を false に、`imageError` を null にする
    - `handleImageSelectionCancel` は `imageSelectorOpen` を false にする
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 2.2 `handleImageSelectionConfirm` のプロパティテストを書く
    - **Property 1: 画像選択確定後のステート更新**
    - **Validates: Requirements 1.3**

- [x] 3. `handleSendCancel` の変更
  - 既存の `handleSendCancel` に `setSelectedImages([])` と `setImageError(null)` を追加する
  - _Requirements: 5.1, 5.2_

  - [ ]* 3.1 `handleSendCancel` のプロパティテストを書く
    - **Property 6: キャンセル時のリセット**
    - **Validates: Requirements 5.1, 5.2**

- [x] 4. `handleSend` の変更（画像変換ロジック）
  - [x] 4.1 `selectedImages` を `attachmentImages` に変換するロジックを実装する
    - `source === 'drive'` → `{ id: driveFileId || id, name }` 形式
    - `source === 'local'` かつ `previewUrl` が `data:` 形式 → `{ id, name, base64Data, mimeType }` 形式
    - `source === 'url'` かつ `url` がある → `{ id, name, url }` 形式
    - _Requirements: 4.1_

  - [ ]* 4.2 `attachmentImages` 変換ロジックのプロパティテストを書く
    - **Property 4: attachmentImages 変換の正確性**
    - **Validates: Requirements 4.1**

- [x] 5. `handleSend` の変更（送信形式の切り替え）
  - [x] 5.1 `attachmentImages` が1件以上の場合、`multipart/form-data` で送信するロジックを実装する
    - `FormData` に `to`・`subject`・`body`・`template_name`・`report_date`・`report_assignee`・`report_completed` を追加する
    - `source === 'local'` の画像は Base64 → Blob 変換して `attachments` フィールドに追加する
    - `source === 'drive'` / `'url'` の画像は JSON 文字列として `driveAttachments` フィールドに追加する
    - _Requirements: 4.2, 4.4, 4.5, 4.6_

  - [x] 5.2 `attachmentImages` が0件の場合、従来通り `application/json` で送信するロジックを維持する
    - _Requirements: 4.3_

  - [x] 5.3 送信成功後に `selectedImages` を空配列にリセットする
    - _Requirements: 4.7_

  - [ ]* 5.4 送信形式切り替えのプロパティテストを書く
    - **Property 3: 添付あり/なしによる送信形式の切り替え**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 5.5 FormData フィールド完全性のプロパティテストを書く
    - **Property 5: FormData フィールドの完全性**
    - **Validates: Requirements 4.4**

- [x] 6. 送信確認ダイアログへのUI追加
  - 本文編集エリア（`TextField label="本文"`）の直下に「画像を添付」ボタンを追加する
  - ボタンは `variant="outlined"`・`startIcon={<ImageIcon />}` で表示する
  - `selectedImages.length > 0` のとき `severity="success"` の `Alert` で「{N}枚の画像が選択されました」を表示する
  - `imageError` があるとき `severity="error"` の `Alert` でエラーメッセージを表示する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 6.1 選択枚数表示のプロパティテストを書く
    - **Property 2: 選択枚数の表示**
    - **Validates: Requirements 2.4**

- [x] 7. `ImageSelectorModal` の組み込み
  - 既存のダイアログ群の末尾に `ImageSelectorModal` を追加する
  - `open={imageSelectorOpen}`・`onConfirm={handleImageSelectionConfirm}`・`onCancel={handleImageSelectionCancel}` を設定する
  - _Requirements: 3.2_

- [x] 8. チェックポイント - 全テストが通ることを確認する
  - `getDiagnostics` で型エラーがないことを確認する。問題があればユーザーに確認する。

- [x] 9. デプロイ
  - `git add .` → `git commit` → `git push origin main` で自動デプロイする
  - _Requirements: 全要件_

## 注意事項

- `*` が付いたサブタスクはオプション（スキップ可能）
- プロパティテストには **fast-check** を使用し、各テストに `// Feature: property-report-gmail-attachment, Property {N}: {property_text}` タグを付ける
- 変更対象は `frontend/frontend/src/pages/PropertyReportPage.tsx` のみ
- デプロイは `git push origin main` で自動実行される（`npx vercel --prod` は使わない）
