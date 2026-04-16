# 実装計画：買主内覧メール通知

## 概要

`backend/src/routes/buyer-appointments.ts` の `POST /` および `POST /cancel-notification` エンドポイントのメール送信ロジックを要件定義書に合わせて修正します。

修正は日本語ファイルのため、Pythonスクリプトを使用してUTF-8エンコーディングを保護しながら実施します。

## タスク

- [x] 1. POST / エンドポイントのメール送信ロジックを修正する
  - `backend/src/routes/buyer-appointments.ts` の `POST /` エンドポイント内のメール送信ブロックを修正する
  - Pythonスクリプト（`fix_buyer_appointments.py`）を作成してUTF-8安全に書き込む
  - 変更内容：
    - 宛先を物件担当（`sales_assignee`）のみに変更（後続担当への送信を削除）
    - `property_listings` の SELECT に `display_address`, `address` を追加
    - `displayAddress` フォールバックロジックを実装（`display_address` → `address` → `（住所未設定）`）
    - 件名を `${displayAddress}の内覧入りました！` に変更
    - 本文を要件定義書の形式に変更（`followUpAssignee`, `viewingMobile`/`viewingTypeGeneral`, `viewingDate`, `viewingTime` を使用）
    - リクエストボディから `viewingTypeGeneral`, `viewingDate`, `viewingTime`, `followUpAssignee` を受け取る
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.3, 5.4_

- [x] 2. POST /cancel-notification エンドポイントのメール送信ロジックを修正する
  - `backend/src/routes/buyer-appointments.ts` の `POST /cancel-notification` エンドポイントを修正する
  - 同じPythonスクリプト（`fix_buyer_appointments.py`）内で処理する
  - 変更内容：
    - 宛先を物件担当（`sales_assignee`）のみに変更（後続担当・固定メール `tomoko.kunihiro@ifoo-oita.com` を削除）
    - `property_listings` の SELECT に `display_address`, `address` を追加
    - `displayAddress` フォールバックロジックを実装
    - 件名を `${displayAddress}の内覧キャンセルです` に変更
    - 本文を要件定義書の形式に変更（`previousViewingDate` をキャンセル前の内覧日として使用）
    - リクエストボディから `previousViewingDate`, `viewingMobile`, `viewingTypeGeneral`, `followUpAssignee` を受け取る
    - 売主情報（`sellers.name`, `sellers.phone_number`）を `decrypt()` で復号して本文に含める
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.2, 5.3, 5.4_

- [x] 3. チェックポイント - 修正内容を確認する
  - Pythonスクリプトを実行してファイルを更新する
  - `getDiagnostics` でTypeScriptエラーがないか確認する
  - エンコーディングが UTF-8（BOMなし）であることを確認する
  - 全てのテストが通ることを確認し、疑問点があればユーザーに確認する

## Notes

- タスクに `*` が付いているものはオプションでスキップ可能
- 日本語を含むファイルの編集は必ずPythonスクリプト経由で行う（`file-encoding-protection.md` のルール）
- `ENCRYPTION_KEY` は絶対に変更しない
- `sellers.name` / `sellers.phone_number` は必ず `decrypt()` で復号してから使用する
- メール送信失敗は `POST /` ではカレンダー登録の成功に影響させない（try-catch で囲む）
