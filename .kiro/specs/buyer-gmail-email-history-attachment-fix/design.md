# Design Document

## Overview

買主Gmail送信の2つのバグを修正する。

1. `email_history.buyer_id` に UUID ではなく `buyer_number` を保存する
2. `BuyerEmailCompositionModal` に添付ファイルUI を追加し、バックエンドで受信・送信する

## Architecture

### バグ1: buyer_id の修正

**変更箇所**: `backend/src/routes/gmail.ts`

`saveEmailHistory` 呼び出し時に `buyerId`（UUID）ではなく `buyer.buyer_number` を渡す。
`buyer` オブジェクトはすでに `buyerService.getById(buyerId)` で取得済みなので、`buyer.buyer_number` を使うだけ。

```
Before: buyerId: buyerId  (UUID)
After:  buyerId: buyer.buyer_number  (例: "4370")
```

### バグ2: 添付ファイル機能

**フロントエンド変更**:

1. `BuyerEmailCompositionModal.tsx`
   - `attachments: File[]` state を追加
   - `useRef<HTMLInputElement>` でファイル入力を管理
   - 「ファイルを追加」ボタン + Chip リスト（削除可能）を追加
   - `onSend` に `attachments` を渡せるよう `EmailData` 型を拡張

2. `BuyerGmailSendButton.tsx`
   - `handleSendEmail` で添付ファイルがある場合は `FormData` で送信
   - 添付なしの場合は従来通り JSON で送信（後方互換性）

**バックエンド変更**:

1. `backend/src/routes/gmail.ts`
   - `multer` を使って `multipart/form-data` を受信
   - 添付ファイルを `EmailService.sendBuyerEmail()` に渡す

2. `backend/src/services/EmailService.ts`
   - `sendBuyerEmail()` に `attachments?: Express.Multer.File[]` パラメータを追加
   - 添付ファイルがある場合は MIME multipart メッセージを構築

## Data Models

### EmailData 型の拡張（フロントエンド）

```typescript
interface EmailData {
  buyerId: string;
  propertyId?: string;
  templateId: string;
  subject: string;
  body: string;
  recipientEmail: string;
  attachments?: File[];  // 追加
}
```

### sendBuyerEmail パラメータの拡張（バックエンド）

```typescript
{
  to: string;
  subject: string;
  body: string;
  from?: string;
  attachments?: Express.Multer.File[];  // 追加
}
```

## MIME multipart メール構築

添付ファイルがある場合、以下の構造で MIME メッセージを構築する：

```
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="BOUNDARY"

--BOUNDARY
Content-Type: text/html; charset=utf-8
Content-Transfer-Encoding: quoted-printable

<HTMLボディ>

--BOUNDARY
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="ファイル名"
Content-Transfer-Encoding: base64

<base64エンコードされたファイルデータ>
--BOUNDARY--
```

添付ファイルがない場合は従来通り `text/html` のみのメッセージを使用する。

## Error Handling

- 添付ファイルのサイズ制限: `multer` で 10MB/ファイル、合計 25MB（Gmail の制限）
- 添付なしの場合は従来通り JSON リクエストも受け付ける（`multer` の `optional` 設定）
