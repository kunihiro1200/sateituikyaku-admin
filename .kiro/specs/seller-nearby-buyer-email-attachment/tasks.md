# 実装計画: 近隣買主候補メール送信への添付機能追加

## 概要

`EmailConfirmationModal` に添付ファイル選択UIを追加し、`NearbyBuyersList` から添付ファイル付きでメールを送信できるようにする。
既存の `ImageSelectorModal` を再利用し、バックエンドAPIの変更なしにフロントエンドのみで実現する。

## タスク

- [x] 1. `ImageFile` 型を共通型ファイルにエクスポート
  - `frontend/frontend/src/components/ImageSelectorModal.tsx` 内の `ImageFile` インターフェースに `export` を追加する
  - `AttachmentPayload` 型を `frontend/frontend/src/types/email.ts` に新規作成する
  - _要件: 3.1_

- [ ] 2. `ImageSelectorModal` にサイズバリデーションを追加
  - [x] 2.1 サイズ制限定数と確定ボタンクリック時のバリデーションロジックを実装する
    - `MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024`（5MB）と `MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024`（10MB）の定数を追加する
    - 確定ボタンクリック時に単一ファイルサイズと合計サイズを検証する
    - エラー時は `Alert` コンポーネント（severity="error"）でメッセージを表示し、確定を拒否する
    - エラーメッセージ: `{ファイル名} のサイズが5MBを超えています` / `選択した画像の合計サイズが10MBを超えています`
    - _要件: 4.1, 4.2, 4.3_

  - [ ]* 2.2 Property 5 のプロパティテストを作成する（単一ファイルサイズ制限）
    - **Property 5: 単一ファイルサイズ制限**
    - **Validates: Requirements 4.1, 4.3**
    - `fast-check` を使用し、5MB超のサイズを持つファイルで確定を試みたときエラーが発生することを確認する

  - [ ]* 2.3 Property 6 のプロパティテストを作成する（合計ファイルサイズ制限）
    - **Property 6: 合計ファイルサイズ制限**
    - **Validates: Requirements 4.2, 4.3**
    - `fast-check` を使用し、合計サイズが10MB超のファイル群で確定を試みたときエラーが発生することを確認する

- [ ] 3. `EmailConfirmationModal` に添付ファイル機能を追加
  - [x] 3.1 Props インターフェースと内部 State を更新する
    - `onConfirm` のシグネチャを `(subject: string, body: string, attachments: ImageFile[]) => Promise<void>` に変更する
    - `attachments: ImageFile[]` と `imageSelectorOpen: boolean` の内部 State を追加する
    - `open` が `true` に変わったとき（`useEffect`）に `attachments` をリセットする
    - キャンセル・送信完了時も `attachments` をリセットする
    - _要件: 3.1, 3.2, 3.3_

  - [x] 3.2 添付ファイル選択UIを実装する
    - 本文 `TextField` の下に「画像を添付」ボタン（`AttachFile` アイコン付き）を追加する
    - 添付ファイルが1件以上のとき、ファイル名と削除ボタンの一覧を表示する
    - 削除ボタンクリックで対象ファイルを `attachments` から除外する
    - `ImageSelectorModal` コンポーネントを組み込み、`imageSelectorOpen` で開閉を制御する
    - _要件: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [ ]* 3.3 Property 1 のプロパティテストを作成する（添付ファイル件数表示の正確性）
    - **Property 1: 添付ファイル件数表示の正確性**
    - **Validates: Requirements 1.4**
    - `fast-check` を使用し、任意の `ImageFile[]` を設定したとき表示件数が配列の長さと一致することを確認する

  - [ ]* 3.4 Property 2 のプロパティテストを作成する（添付ファイル一覧表示の完全性）
    - **Property 2: 添付ファイル一覧表示の完全性**
    - **Validates: Requirements 1.5**
    - `fast-check` を使用し、任意の `ImageFile[]` の各 `name` が一覧に表示されることを確認する

  - [ ]* 3.5 Property 3 のプロパティテストを作成する（添付ファイル削除後の排他性）
    - **Property 3: 添付ファイル削除後の排他性**
    - **Validates: Requirements 1.6**
    - `fast-check` を使用し、任意のファイルを削除したとき削除後のリストにそのファイルが含まれないことを確認する

- [ ] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [ ] 5. `NearbyBuyersList` に添付ファイル付き送信を実装する
  - [x] 5.1 `convertImageFilesToAttachments` 純粋関数を実装する
    - `ImageFile[]` を `AttachmentPayload[]` に変換する純粋関数をファイル内に実装する
    - `source === 'drive'` → `{ id: driveFileId || id, name }`
    - `source === 'local'` → `previewUrl` の Base64 データを抽出して `{ id, name, base64Data, mimeType }`
    - `source === 'url'` → `{ id, name, url }`
    - _要件: 2.2_

  - [ ]* 5.2 Property 4 のプロパティテストを作成する（ImageFile → attachment 変換の正確性）
    - **Property 4: ImageFile → attachment 変換の正確性**
    - **Validates: Requirements 2.2**
    - `fast-check` を使用し、各 `source` に対して正しい形式の `AttachmentPayload` が生成されることを確認する

  - [x] 5.3 `handleConfirmSendEmail` を `attachments` 対応に更新する
    - シグネチャを `(subject: string, body: string, attachments: ImageFile[]) => Promise<void>` に変更する
    - `convertImageFilesToAttachments` で変換した結果を API リクエストに含める
    - `attachments` が空の場合は従来通り `attachments` フィールドを含めない
    - 送信成功後に添付ファイルの選択状態をリセットする
    - _要件: 2.1, 2.3, 2.4_

  - [ ]* 5.4 ユニットテストを作成する
    - 添付ファイルなしで送信したとき `attachments` フィールドが含まれないことを確認する
    - 送信成功後に添付ファイルリストがリセットされることを確認する
    - _要件: 2.3, 2.4_

- [ ] 6. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- 日本語を含むファイルの編集は Pythonスクリプト経由で行うこと（file-encoding-protection.md のルール）
- バックエンドAPIの変更は不要
- タスク `*` 付きはオプションであり、MVP では省略可能
