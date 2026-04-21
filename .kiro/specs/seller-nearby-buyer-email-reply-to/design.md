# 設計ドキュメント: 売主リスト近隣買主候補メール Reply-To 機能

## 概要

売主リストの近隣買主候補メール送信機能において、Reply-To ヘッダーを追加する。
メール送信確認モーダル（`EmailConfirmationModal`）にスタッフ選択ドロップダウンを追加し、
選択されたスタッフのメールアドレスを Reply-To ヘッダーとして設定する。
未選択時はデフォルト値 `tenant@ifoo-oita.com` を使用する。

### 変更の背景

現在の近隣買主候補メール送信では、買主が「返信」ボタンを押した際の宛先が設定されていない。
Reply-To ヘッダーを追加することで、買主からの返信が担当スタッフに直接届くようになる。

---

## アーキテクチャ

```mermaid
graph TD
    A[NearbyBuyersList.tsx] -->|handleSendEmail| B[EmailConfirmationModal.tsx]
    B -->|GET /api/employees/active| C[backend/src/routes/employees.ts]
    C -->|employees テーブル| D[(Supabase DB)]
    B -->|onConfirm: subject, body, attachments, replyTo| A
    A -->|POST /api/emails/send-distribution\n{ replyTo: string }| E[backend/src/routes/emails.ts]
    E -->|sendDistributionEmail\n{ replyTo: string }| F[EmailService.supabase.ts]
    F -->|Reply-To ヘッダー付き MIME メッセージ| G[Gmail API]
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/components/EmailConfirmationModal.tsx` | Reply-To 選択ドロップダウン追加、`onConfirm` シグネチャ拡張 |
| `frontend/frontend/src/components/NearbyBuyersList.tsx` | `handleConfirmSendEmail` シグネチャ拡張、`replyTo` を API リクエストに追加 |
| `backend/src/routes/emails.ts` | `send-distribution` エンドポイントの `replyTo` バリデーション追加 |
| `backend/src/services/EmailService.supabase.ts` | `sendDistributionEmail` の `replyTo` パラメータ追加、Reply-To ヘッダー設定 |

---

## コンポーネントとインターフェース

### フロントエンド: `EmailConfirmationModal` の変更

#### Props インターフェース拡張

```typescript
interface EmailConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  // replyTo: string を追加
  onConfirm: (subject: string, body: string, attachments: ImageFile[], replyTo: string) => Promise<void>;
  recipientCount: number;
  defaultSubject: string;
  defaultBody: string;
}
```

#### 内部状態の追加

```typescript
const DEFAULT_REPLY_TO = 'tenant@ifoo-oita.com';

// スタッフ一覧の状態
const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
const [employeesLoading, setEmployeesLoading] = useState(false);

// Reply-To 選択状態（初期値: Default_ReplyTo）
const [replyTo, setReplyTo] = useState<string>(DEFAULT_REPLY_TO);
```

#### スタッフ一覧の取得

モーダルが開かれたとき（`open === true`）に `GET /api/employees/active` を呼び出してスタッフ一覧を取得する。
取得失敗時は `DEFAULT_REPLY_TO` のみを選択肢として表示する。

```typescript
useEffect(() => {
  if (open) {
    setSubject(defaultSubject);
    setBody(defaultBody);
    setAttachments([]);
    setReplyTo(DEFAULT_REPLY_TO); // リセット
    fetchEmployees();
  }
}, [open, defaultSubject, defaultBody]);

const fetchEmployees = async () => {
  setEmployeesLoading(true);
  try {
    const response = await api.get('/api/employees/active');
    setEmployees(response.data.employees || []);
  } catch (error) {
    console.warn('[EmailConfirmationModal] Failed to fetch employees:', error);
    setEmployees([]); // フォールバック: Default_ReplyTo のみ表示
  } finally {
    setEmployeesLoading(false);
  }
};
```

#### ドロップダウン UI

MUI の `Select` コンポーネントを使用する。
選択肢は「デフォルト（tenant@ifoo-oita.com）」+ スタッフ全員のメールアドレス。

```tsx
<Box sx={{ mb: 3 }}>
  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
    返信先（Reply-To）
  </Typography>
  <Select
    fullWidth
    value={replyTo}
    onChange={(e) => setReplyTo(e.target.value as string)}
    disabled={sending || employeesLoading}
    size="small"
  >
    <MenuItem value={DEFAULT_REPLY_TO}>
      デフォルト（{DEFAULT_REPLY_TO}）
    </MenuItem>
    {employees
      .filter(emp => emp.email && emp.email !== DEFAULT_REPLY_TO)
      .map(emp => (
        <MenuItem key={emp.id} value={emp.email}>
          {emp.name}（{emp.email}）
        </MenuItem>
      ))
    }
  </Select>
</Box>
```

#### `handleConfirm` の変更

```typescript
const handleConfirm = async () => {
  setSending(true);
  try {
    // replyTo が空の場合は DEFAULT_REPLY_TO を使用
    const effectiveReplyTo = replyTo.trim() || DEFAULT_REPLY_TO;
    await onConfirm(subject, body, attachments, effectiveReplyTo);
    setAttachments([]);
    onClose();
  } catch (error) {
    // エラーは親コンポーネントで処理される
  } finally {
    setSending(false);
  }
};
```

---

### フロントエンド: `NearbyBuyersList` の変更

#### `handleConfirmSendEmail` シグネチャ拡張

```typescript
// 変更前
const handleConfirmSendEmail = async (subject: string, body: string, attachments: ImageFile[]) => {

// 変更後
const handleConfirmSendEmail = async (subject: string, body: string, attachments: ImageFile[], replyTo: string) => {
```

#### API リクエストへの `replyTo` 追加

```typescript
return await api.post('/api/emails/send-distribution', {
  senderAddress: 'tenant@ifoo-oita.com',
  recipients: [{ email: candidate.email!, buyerNumber: candidate.buyer_number }],
  subject,
  body: personalizedBody,
  propertyNumber: effectivePropertyNumber || undefined,
  replyTo, // 追加
  ...(attachmentPayloads.length > 0 ? { attachments: attachmentPayloads } : {}),
});
```

---

### バックエンド: `POST /api/emails/send-distribution` の変更

#### バリデーション追加

```typescript
body('replyTo').optional().isEmail().withMessage('Invalid replyTo email address'),
```

#### `replyTo` の取り出しと `sendDistributionEmail` への受け渡し

```typescript
const { senderAddress, recipients, subject, body, propertyNumber, attachments, source: requestSource, replyTo } = req.body;

const result = await emailService.sendDistributionEmail({
  senderAddress,
  recipients: normalizedRecipients,
  subject,
  body,
  propertyNumber: propertyNumber || 'unknown',
  attachments: processedAttachments,
  replyTo: replyTo || 'tenant@ifoo-oita.com', // 未指定時はデフォルト
});
```

---

### バックエンド: `EmailService.sendDistributionEmail` の変更

#### パラメータ型拡張

```typescript
async sendDistributionEmail(params: {
  senderAddress: string;
  recipients: Array<{ email: string; name: string | null }> | string[];
  subject: string;
  body: string;
  propertyNumber: string;
  replyTo?: string; // 追加
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: Buffer;
  }>;
}): Promise<{ ... }>
```

#### MIME メッセージへの Reply-To ヘッダー追加

添付なし・添付ありの両方のメッセージ構築箇所に Reply-To ヘッダーを追加する。

```typescript
const effectiveReplyTo = params.replyTo?.trim() || 'tenant@ifoo-oita.com';

// 添付なしの場合
const messageParts = [
  `From: ${params.senderAddress}`,
  `To: ${recipient.email}`,
  `Reply-To: ${effectiveReplyTo}`, // 追加
  `Subject: ${encodedPersonalizedSubject}`,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: 8bit',
  '',
  personalizedBody,
];

// 添付ありの場合も同様に Reply-To ヘッダーを追加
const messageParts = [
  `From: ${params.senderAddress}`,
  `To: ${recipient.email}`,
  `Reply-To: ${effectiveReplyTo}`, // 追加
  `Subject: ${encodedPersonalizedSubject}`,
  'MIME-Version: 1.0',
  `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ...
];
```

---

## データモデル

### API リクエスト/レスポンス

#### `POST /api/emails/send-distribution` リクエストボディ（変更後）

```typescript
{
  senderAddress: string;          // 送信元アドレス（ホワイトリスト検証あり）
  recipients: Array<{
    email: string;
    buyerNumber?: string;
  }>;
  subject: string;
  body: string;
  propertyNumber?: string;
  replyTo?: string;               // 追加: Reply-To アドレス（省略時は tenant@ifoo-oita.com）
  attachments?: Array<{
    id: string;
    name: string;
    base64Data?: string;
    mimeType?: string;
    url?: string;
  }>;
}
```

#### `GET /api/employees/active` レスポンス（既存・変更なし）

```typescript
{
  employees: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    initials: string;
    phone_number: string | null;
  }>;
}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成り立つべき特性や動作のことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: Reply-To ヘッダーの設定

*任意の* 有効なメールアドレス文字列 `replyTo` に対して、`sendDistributionEmail` が生成する MIME メッセージには `Reply-To: {replyTo}` ヘッダーが含まれる。

**Validates: Requirements 2.3, 2.5**

### Property 2: replyTo 未指定時のデフォルト値適用

*任意の* `replyTo` が null・undefined・空文字列の場合、`sendDistributionEmail` が生成する MIME メッセージには `Reply-To: tenant@ifoo-oita.com` ヘッダーが含まれる。

**Validates: Requirements 2.4**

### Property 3: onConfirm への replyTo 引数の受け渡し

*任意の* 有効なメールアドレス文字列を Reply-To ドロップダウンで選択して `onConfirm` を呼び出したとき、`onConfirm` の第4引数にその選択値が渡される。

**Validates: Requirements 4.2**

### Property 4: 無効なメールアドレスのバリデーション拒否

*任意の* 無効なメールアドレス形式の文字列を `replyTo` として `POST /api/emails/send-distribution` に送信したとき、エンドポイントは HTTP 400 を返す。

**Validates: Requirements 3.1, 3.2**

**プロパティ反省（冗長性の排除）**:
- Property 1 と Property 2 は同じ `sendDistributionEmail` の Reply-To ヘッダー設定ロジックをテストしているが、有効値とデフォルト値（フォールバック）という異なる側面をカバーしているため、両方に価値がある。
- Property 3 は UI コンポーネントのコールバック引数の受け渡しをテストしており、他のプロパティとは独立している。
- Property 4 はバックエンドのバリデーションロジックをテストしており、他のプロパティとは独立している。

---

## エラーハンドリング

### フロントエンド

| ケース | 対応 |
|-------|------|
| `GET /api/employees/active` が失敗した場合 | `employees` を空配列にし、`DEFAULT_REPLY_TO` のみをドロップダウンに表示する |
| `replyTo` が空文字列の場合 | `DEFAULT_REPLY_TO`（`tenant@ifoo-oita.com`）を使用する |
| スタッフ一覧取得中（ローディング中）の場合 | ドロップダウンを `disabled` にする |

### バックエンド

| ケース | 対応 |
|-------|------|
| `replyTo` フィールドが省略された場合 | `tenant@ifoo-oita.com` をデフォルト値として使用する |
| `replyTo` フィールドが無効なメールアドレス形式の場合 | HTTP 400 とバリデーションエラーメッセージを返す |
| `replyTo` フィールドが空文字列の場合 | `tenant@ifoo-oita.com` をデフォルト値として使用する |

---

## テスト戦略

### ユニットテスト（例ベース）

1. **`EmailConfirmationModal` コンポーネント**:
   - モーダルが開かれたとき、Reply-To ドロップダウンが表示される
   - 初期値が `tenant@ifoo-oita.com` になっている
   - スタッフ一覧取得失敗時、`tenant@ifoo-oita.com` のみが選択肢として表示される
   - `replyTo` が空の場合、`onConfirm` に `tenant@ifoo-oita.com` が渡される

2. **`send-distribution` エンドポイント**:
   - `replyTo` が省略された場合、バリデーションエラーが発生しない
   - `replyTo` が無効なメールアドレス形式の場合、HTTP 400 が返される

3. **`sendDistributionEmail` メソッド**:
   - `replyTo` が未指定の場合、MIME メッセージに `Reply-To: tenant@ifoo-oita.com` が含まれる

### プロパティベーステスト（fast-check 使用）

プロパティベーステストは `sendDistributionEmail` の MIME メッセージ生成ロジックと、バリデーションロジックに適用する。

**ライブラリ**: `fast-check`（既存プロジェクトで使用済み）

**最小イテレーション数**: 100回

**テストタグ形式**: `Feature: seller-nearby-buyer-email-reply-to, Property {番号}: {プロパティ内容}`

#### Property 1: Reply-To ヘッダーの設定

```typescript
// Feature: seller-nearby-buyer-email-reply-to, Property 1: Reply-To ヘッダーの設定
fc.assert(fc.property(
  fc.emailAddress(),
  async (replyTo) => {
    // sendDistributionEmail の内部 MIME 生成ロジックをテスト（Gmail API はモック）
    const mimeMessage = buildDistributionMimeMessage({
      senderAddress: 'tenant@ifoo-oita.com',
      recipientEmail: 'buyer@example.com',
      subject: 'テスト',
      body: 'テスト本文',
      replyTo,
    });
    return mimeMessage.includes(`Reply-To: ${replyTo}`);
  }
), { numRuns: 100 });
```

#### Property 2: replyTo 未指定時のデフォルト値適用

```typescript
// Feature: seller-nearby-buyer-email-reply-to, Property 2: replyTo 未指定時のデフォルト値適用
fc.assert(fc.property(
  fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant('')),
  (replyTo) => {
    const mimeMessage = buildDistributionMimeMessage({
      senderAddress: 'tenant@ifoo-oita.com',
      recipientEmail: 'buyer@example.com',
      subject: 'テスト',
      body: 'テスト本文',
      replyTo: replyTo as any,
    });
    return mimeMessage.includes('Reply-To: tenant@ifoo-oita.com');
  }
), { numRuns: 100 });
```

#### Property 3: onConfirm への replyTo 引数の受け渡し

```typescript
// Feature: seller-nearby-buyer-email-reply-to, Property 3: onConfirm への replyTo 引数の受け渡し
fc.assert(fc.property(
  fc.emailAddress(),
  async (replyToAddress) => {
    let capturedReplyTo: string | undefined;
    const onConfirm = async (_subject: string, _body: string, _attachments: ImageFile[], replyTo: string) => {
      capturedReplyTo = replyTo;
    };
    // ドロップダウンで replyToAddress を選択して onConfirm を呼び出す
    // （コンポーネントテストで実装）
    return capturedReplyTo === replyToAddress;
  }
), { numRuns: 100 });
```

#### Property 4: 無効なメールアドレスのバリデーション拒否

```typescript
// Feature: seller-nearby-buyer-email-reply-to, Property 4: 無効なメールアドレスのバリデーション拒否
fc.assert(fc.property(
  fc.string().filter(s => s.length > 0 && !isValidEmail(s)),
  async (invalidEmail) => {
    const response = await request(app)
      .post('/api/emails/send-distribution')
      .send({
        senderAddress: 'tenant@ifoo-oita.com',
        recipients: [{ email: 'buyer@example.com' }],
        subject: 'テスト',
        body: 'テスト本文',
        replyTo: invalidEmail,
      });
    return response.status === 400;
  }
), { numRuns: 100 });
```

### インテグレーションテスト

- `POST /api/emails/send-distribution` に `replyTo` を含めてリクエストし、Gmail API に渡される MIME メッセージに `Reply-To` ヘッダーが含まれることを確認（Gmail API はモック）
- `GET /api/employees/active` のレスポンスが `EmailConfirmationModal` のドロップダウンに正しく反映されることを確認
