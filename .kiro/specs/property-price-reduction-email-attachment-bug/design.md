# 値下げ配信メール画像添付バグ デザインドキュメント

## Overview

物件リスト詳細ページの「公開前、値下げメール」配信機能において、確認モーダルで画像を選択して送信しても、受信者のメールに画像が添付されないバグの修正設計。

バグは3層にわたる問題で構成されている：
1. **フロントエンド（コンポーネント層）**: `GmailDistributionButton.handleConfirmationConfirm` が `selectedImages` を `gmailDistributionService.sendEmailsDirectly` に渡していない
2. **フロントエンド（サービス層）**: `sendEmailsDirectly` が JSON のみで送信しており、バイナリ画像データを含む `multipart/form-data` を送信していない
3. **バックエンド（エンドポイント層）**: `send-distribution-emails` エンドポイントが `multer` ミドルウェアを使用しておらず、添付ファイルを処理できない

修正方針は、既存の `send-template-email` エンドポイント（`emails.ts`）の添付ファイル処理パターンを参考に、`send-distribution-emails` エンドポイントにも同様の添付ファイル対応を追加することである。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — ユーザーが確認モーダルで1枚以上の画像を選択して送信ボタンを押した状態
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作 — 選択された画像がメールに添付されて送信される
- **Preservation**: 修正によって変更してはならない既存の動作 — 画像なし送信、複数受信者への個別送信、activity_logs記録、フォールバック処理など
- **handleConfirmationConfirm**: `GmailDistributionButton.tsx` 内の確認モーダルで「送信」ボタンが押された際に実行される関数
- **sendEmailsDirectly**: `gmailDistributionService.ts` 内のメール直接送信メソッド。現在は JSON のみで API を呼び出している
- **send-distribution-emails**: `backend/src/routes/propertyListings.ts` 内の一括配信メール送信エンドポイント。現在は `multer` を使用していない
- **send-template-email**: `backend/src/routes/emails.ts` 内の売主向けメール送信エンドポイント。添付ファイル処理の参考実装
- **selectedImages**: `GmailDistributionButton` の state。確認モーダルで選択された画像の配列
- **multer**: Node.js の `multipart/form-data` 処理ミドルウェア。バイナリファイルのアップロードに必要

## Bug Details

### Bug Condition

バグは、ユーザーが確認モーダルで1枚以上の画像を選択して送信ボタンを押したときに発動する。
`handleConfirmationConfirm` は `selectedImages` を保持しているが、`sendEmailsDirectly` の呼び出し時に渡していない。
さらに、`sendEmailsDirectly` は JSON のみで API を呼び出すため、バイナリ画像データを含められない。
バックエンドも `multer` を使用していないため、仮にフロントエンドが `multipart/form-data` を送信しても処理できない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { selectedImages: ImageItem[], sendAction: 'confirm' }
  OUTPUT: boolean

  RETURN input.selectedImages.length > 0
         AND input.sendAction = 'confirm'
         AND selectedImagesPassedToSendEmailsDirectly(input.selectedImages) = false
END FUNCTION
```

### Examples

- **例1（バグ発動）**: ユーザーが確認モーダルで画像を1枚選択して送信 → メールは送信されるが画像は添付されない
- **例2（バグ発動）**: ユーザーが確認モーダルで画像を3枚選択して送信 → メールは送信されるが画像は全て無視される
- **例3（バグ非発動）**: ユーザーが画像を選択せずに送信 → テキストのみのメールが正常に送信される（既存動作）
- **エッジケース**: ユーザーが画像を選択後にキャンセルして再度送信 → `selectedImages` がリセットされているため画像なしで送信される（正常）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 画像を添付せずに送信する場合、従来通りテキストのみのメールが正常に送信される
- 複数の受信者に配信する場合、各受信者に個別にメールを送信し、`{buyerName}` プレースホルダーが正しく置換される
- メール送信成功後、`activity_logs` テーブルへの記録と `onSendSuccess` コールバックの呼び出しが行われる
- 送信に失敗した場合、Gmail Web UI へのフォールバック処理が行われる
- 送信元アドレスを変更した場合、変更されたアドレスから送信される
- 確認モーダルのクローズ時に `selectedImages` がリセットされる

**スコープ:**
画像添付に関係しない全ての入力（画像なし送信、マウスクリック、テンプレート選択、買主フィルタ操作など）は、この修正によって完全に影響を受けてはならない。

## Hypothesized Root Cause

コードの調査により、以下の根本原因が確認された：

1. **フロントエンド（コンポーネント層）: `selectedImages` が渡されていない**
   - `handleConfirmationConfirm` は `selectedImages` state を保持している
   - しかし `gmailDistributionService.sendEmailsDirectly(...)` の呼び出し時に `selectedImages` を引数として渡していない
   - `sendEmailsDirectly` のシグネチャにも `attachments` パラメータが存在しない

2. **フロントエンド（サービス層）: JSON のみで送信している**
   - `sendEmailsDirectly` は `api.post(...)` を使って JSON ボディのみで送信している
   - バイナリ画像データを含む `multipart/form-data` には対応していない
   - 参考: `send-template-email` エンドポイントは `attachments` を JSON の配列（`base64Data`, `driveFileId`, `url` のいずれか）として受け取り、バックエンドで処理している

3. **バックエンド（エンドポイント層）: `multer` ミドルウェアが未設定**
   - `send-distribution-emails` エンドポイントは `multer` を使用していない
   - ただし、`send-template-email` エンドポイント（`emails.ts`）の実装を見ると、添付ファイルは `multipart/form-data` ではなく **JSON の `attachments` 配列**（`base64Data` または `driveFileId`）として受け取っている
   - つまり、バックエンドの修正は `multer` の追加ではなく、`req.body.attachments` を処理するロジックの追加が正しいアプローチ

4. **修正方針の修正（bugfix.md との差異）**
   - bugfix.md では「バックエンドに `multer` を追加する」と記載されているが、実際の `send-template-email` の実装を見ると、添付ファイルは JSON の `attachments` 配列として受け取っている
   - 正しい修正方針は: フロントエンドから `attachments` を JSON 配列として送信し、バックエンドで `req.body.attachments` を処理する

## Correctness Properties

Property 1: Bug Condition - 画像添付メール送信

_For any_ 入力において `selectedImages.length > 0` かつ `sendAction = 'confirm'` の場合（isBugCondition が true を返す）、修正後の `handleConfirmationConfirm` は選択された全ての画像を添付した状態でメールを送信し、受信者のメールに画像が添付されていること。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 画像なし送信の既存動作

_For any_ 入力において `selectedImages.length = 0`（isBugCondition が false を返す）の場合、修正後のコードは修正前のコードと全く同じ動作をし、テキストのみのメールが正常に送信されること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の3箇所を修正する：

---

**File 1**: `frontend/frontend/src/components/GmailDistributionButton.tsx`

**Function**: `handleConfirmationConfirm`

**Specific Changes**:
1. **`selectedImages` を `sendEmailsDirectly` に渡す**: `handleConfirmationConfirm` 内の `gmailDistributionService.sendEmailsDirectly(...)` 呼び出しに `selectedImages` を追加する
2. **`selectedImages` を `attachments` 形式に変換**: `selectedImages` の各要素を `{ id, name, base64Data?, driveFileId?, url? }` 形式に変換して渡す

```typescript
// 修正前
const result = await gmailDistributionService.sendEmailsDirectly(
  selectedTemplate,
  { ... },
  selectedBuyers.map(b => b.email),
  senderAddress,
  buyers
);

// 修正後
const attachments = selectedImages.map(img => ({
  id: img.id,
  name: img.name,
  mimeType: img.mimeType,
  ...(img.base64Data ? { base64Data: img.base64Data } : {}),
  ...(img.driveFileId ? { driveFileId: img.driveFileId } : {}),
  ...(img.url ? { url: img.url } : {}),
}));

const result = await gmailDistributionService.sendEmailsDirectly(
  selectedTemplate,
  { ... },
  selectedBuyers.map(b => b.email),
  senderAddress,
  buyers,
  attachments  // 追加
);
```

---

**File 2**: `frontend/frontend/src/services/gmailDistributionService.ts`

**Function**: `sendEmailsDirectly`

**Specific Changes**:
1. **`attachments` パラメータを追加**: メソッドシグネチャに `attachments?: Array<{...}>` を追加する
2. **`attachments` を JSON ボディに含める**: `api.post(...)` の JSON ボディに `attachments` を追加する（`multipart/form-data` への変更は不要）

```typescript
// 修正後のシグネチャ
async sendEmailsDirectly(
  template: any,
  propertyData: Record<string, string>,
  recipientEmails: string[],
  from: string,
  buyers: Array<{ buyer_number: string; email: string; [key: string]: any }>,
  attachments?: Array<{
    id: string;
    name: string;
    mimeType?: string;
    base64Data?: string;
    driveFileId?: string;
    url?: string;
  }>
): Promise<...>

// 修正後のリクエストボディ
const response = await api.post(
  `/api/property-listings/${propertyData.propertyNumber}/send-distribution-emails`,
  {
    templateId: template.id,
    recipientEmails,
    recipients,
    subject,
    content: body,
    htmlBody,
    from,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,  // 追加
  }
);
```

---

**File 3**: `backend/src/routes/propertyListings.ts`

**Function**: `router.post('/:propertyNumber/send-distribution-emails', ...)`

**Specific Changes**:
1. **`attachments` を `req.body` から取得**: `const { ..., attachments } = req.body;` に追加
2. **添付ファイル処理ロジックを追加**: `send-template-email` エンドポイント（`emails.ts`）と同様のパターンで、`attachments` がある場合は `sendEmailWithCcAndAttachments` を使用し、ない場合は既存の `sendTemplateEmail` を使用する
3. **Google Drive ファイル取得**: `driveFileId` がある場合は `GoogleDriveService.getFile()` でデータを取得する

```typescript
// 修正後の各受信者へのメール送信部分
return await Promise.allSettled(
  normalizedRecipients.map(async (recipient) => {
    const email = typeof recipient === 'string' ? recipient : recipient.email;
    
    // 添付ファイルがある場合の処理
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const { GoogleDriveService } = await import('../services/GoogleDriveService');
      const driveService = new GoogleDriveService();
      
      const emailAttachmentsRaw = await Promise.all(
        attachments.map(async (img: any) => {
          if (img.base64Data) {
            return { filename: img.name, mimeType: img.mimeType, data: Buffer.from(img.base64Data, 'base64'), cid: `attachment-${img.id}` };
          }
          if (img.url) { /* URL取得処理 */ }
          const fileData = await driveService.getFile(img.id || img.driveFileId);
          if (!fileData) return null;
          return { filename: img.name, mimeType: fileData.mimeType, data: fileData.data, cid: `attachment-${img.id}` };
        })
      );
      const emailAttachments = emailAttachmentsRaw.filter(Boolean) as any[];
      
      return await emailService.sendEmailWithCcAndAttachments({
        to: email,
        subject,
        body: htmlBody || content,
        from,
        attachments: emailAttachments,
        isHtml: !!htmlBody,
      });
    }
    
    // 添付ファイルなし: 既存フロー（変更なし）
    return await emailService.sendTemplateEmail(dummySeller as any, subject, content, from, req.employee?.id || 'system', htmlBody, from);
  })
);
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：
1. **探索フェーズ**: 未修正コードでバグの存在を確認し、根本原因を検証する
2. **修正検証フェーズ**: 修正後のコードでバグが解消され、既存動作が保全されていることを確認する

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグの存在を示す反例を発見し、根本原因分析を確認または反証する。

**Test Plan**: `handleConfirmationConfirm` が `selectedImages` を `sendEmailsDirectly` に渡していないことを確認するテストを書く。未修正コードで実行して失敗を観察する。

**Test Cases**:
1. **画像1枚添付テスト**: `selectedImages` に1枚の画像を設定して `handleConfirmationConfirm` を実行 → `sendEmailsDirectly` に `attachments` が渡されないことを確認（未修正コードで失敗）
2. **画像複数枚添付テスト**: `selectedImages` に3枚の画像を設定して実行 → 同様に `attachments` が渡されないことを確認（未修正コードで失敗）
3. **バックエンドエンドポイントテスト**: `attachments` を含む JSON リクエストを `send-distribution-emails` に送信 → 添付ファイルが処理されないことを確認（未修正コードで失敗）
4. **エッジケース**: `selectedImages` が空配列の場合 → `attachments` なしで送信されることを確認（未修正コードで PASS）

**Expected Counterexamples**:
- `sendEmailsDirectly` の呼び出し引数に `attachments` が含まれない
- バックエンドが `req.body.attachments` を無視して `sendTemplateEmail` のみを呼び出す

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を示すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleConfirmationConfirm_fixed(input)
  ASSERT emailSentWithAttachments(result, input.selectedImages)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ動作をすることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleConfirmationConfirm_original(input) = handleConfirmationConfirm_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 画像なし送信のパターンを多数自動生成できる
- 手動テストでは見落としがちなエッジケース（空配列、undefined など）を網羅できる
- 既存動作が全ての非バグ入力で保全されていることを強く保証できる

**Test Plan**: 未修正コードで画像なし送信の動作を観察し、その動作を保全テストとして記述する。

**Test Cases**:
1. **画像なし送信の保全**: 画像なしで送信した場合、修正前後で同じ動作をすることを確認
2. **複数受信者への個別送信の保全**: 複数の買主に個別送信する動作が変わらないことを確認
3. **activity_logs 記録の保全**: メール送信成功後の activity_logs 記録が変わらないことを確認
4. **フォールバック処理の保全**: API 送信失敗時の Gmail Web UI フォールバックが変わらないことを確認
5. **送信元アドレス変更の保全**: 送信元アドレスの変更が正しく反映されることを確認

### Unit Tests

- `handleConfirmationConfirm` が `selectedImages` を `sendEmailsDirectly` に渡すことを確認
- `sendEmailsDirectly` が `attachments` パラメータを受け取り、JSON ボディに含めることを確認
- `send-distribution-emails` エンドポイントが `attachments` を処理し、`sendEmailWithCcAndAttachments` を呼び出すことを確認
- `attachments` が空または未指定の場合、既存フロー（`sendTemplateEmail`）が呼び出されることを確認

### Property-Based Tests

- 任意の枚数（1〜5枚）の画像を添付した場合、全ての画像が `sendEmailsDirectly` に渡されることを確認
- 任意の受信者数（1〜10人）に対して、各受信者に添付ファイル付きメールが送信されることを確認
- 画像なし（`selectedImages.length = 0`）の場合、修正前後で全く同じ動作をすることを確認

### Integration Tests

- フロントエンドから画像を選択して送信した場合、バックエンドが添付ファイルを受け取ることを確認
- Google Drive 画像、ローカル画像（Base64）、URL 画像の各ソースで添付が機能することを確認
- 複数受信者への配信で、全員に添付ファイル付きメールが届くことを確認
