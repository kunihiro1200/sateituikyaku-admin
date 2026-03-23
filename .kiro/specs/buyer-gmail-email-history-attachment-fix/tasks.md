# Implementation Tasks

## Tasks

- [x] 1. バグ1修正: gmail.ts の buyer_id を buyer_number に変更
  - [x] 1.1 `backend/src/routes/gmail.ts` の `saveEmailHistory` 呼び出しで `buyerId` を `buyer.buyer_number` に変更

- [x] 2. バグ2修正: バックエンドに添付ファイル受信処理を追加
  - [x] 2.1 `backend/src/routes/gmail.ts` に `multer` を追加し、`/send` エンドポイントで `multipart/form-data` を受信できるようにする
  - [x] 2.2 `backend/src/services/EmailService.ts` の `sendBuyerEmail()` に添付ファイル処理を追加（MIME multipart メッセージ構築）

- [x] 3. バグ2修正: フロントエンドに添付ファイルUIを追加
  - [x] 3.1 `frontend/frontend/src/types/emailTemplate.ts` の `EmailData` 型に `attachments?: File[]` を追加
  - [x] 3.2 `frontend/frontend/src/components/BuyerEmailCompositionModal.tsx` に添付ファイルUI（ファイル選択ボタン + Chip リスト）を追加
  - [x] 3.3 `frontend/frontend/src/components/BuyerGmailSendButton.tsx` の `handleSendEmail` で添付ファイルがある場合に `FormData` で送信するよう変更
