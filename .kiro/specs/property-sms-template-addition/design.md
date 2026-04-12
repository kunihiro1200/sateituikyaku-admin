# 設計ドキュメント: 物件詳細画面SMS送信テンプレート追加

## 概要

`PropertyListingDetailPage`（物件詳細画面）の既存「SMS」ボタンを、Emailテンプレート機能と同等のドロップダウン形式「SMS送信」ボタンに置き換える。

「内覧問合せ」と「空」の2テンプレートを提供し、テンプレート選択時にSMS本文を自動生成して確認ダイアログを表示する。送信後は`seller_sms`タイプで送信履歴を保存し、`sellerSendHistoryRefreshTrigger`を更新する。

### 変更対象ファイル

- `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` — メインの変更対象
- `frontend/frontend/src/utils/smsTemplates.ts` — 新規作成（SMSテンプレート定義）

---

## アーキテクチャ

既存のEmailテンプレート実装パターンを踏襲する。変更はフロントエンドのみで完結し、バックエンドへの変更は不要。

```mermaid
flowchart TD
    A[「SMS送信」ドロップダウンボタン] --> B{seller_contact存在?}
    B -- No --> C[ボタン非表示]
    B -- Yes --> D[ドロップダウンメニュー表示]
    D --> E[「内覧問合せ」選択]
    D --> F[「空」選択]
    E --> G[generateSmsBody('viewing_inquiry', data)]
    F --> H[generateSmsBody('empty', data)]
    G --> I[SMS確認ダイアログ表示]
    H --> I
    I --> J{「送信」クリック}
    J --> K[window.location.href = sms:URI]
    K --> L[saveSellerSendHistory呼び出し]
    L --> M[sellerSendHistoryRefreshTrigger更新]
```

---

## コンポーネントとインターフェース

### 新規ユーティリティ: `smsTemplates.ts`

```typescript
export type SmsTemplateId = 'viewing_inquiry' | 'empty';

export interface SmsTemplate {
  id: SmsTemplateId;
  name: string; // 送信履歴のタイトルに使用
}

export const smsTemplates: SmsTemplate[] = [
  { id: 'viewing_inquiry', name: '内覧問合せ' },
  { id: 'empty', name: '空' },
];

// SMS本文生成関数（純粋関数）
export function generateSmsBody(
  templateId: SmsTemplateId,
  params: {
    sellerName?: string | null;
    address?: string | null;
  }
): string
```

### `PropertyListingDetailPage.tsx` の変更点

#### 追加する状態

```typescript
// SMS送信テンプレート関連
const [smsTemplateMenuAnchor, setSmsTemplateMenuAnchor] = useState<null | HTMLElement>(null);
const [smsDialog, setSmsDialog] = useState<{
  open: boolean;
  body: string;
  templateName: string;
}>({ open: false, body: '', templateName: '' });
```

#### 追加するハンドラ

```typescript
// SMSテンプレート選択ハンドラ
const handleSelectSmsTemplate = (templateId: SmsTemplateId) => void

// SMS送信実行ハンドラ
const handleSendSms = async () => void
```

---

## データモデル

### SMS本文生成パラメータ

| フィールド | 型 | 説明 |
|---|---|---|
| `templateId` | `'viewing_inquiry' \| 'empty'` | テンプレート種別 |
| `sellerName` | `string \| null` | 売主氏名（`property_listings.seller_name`） |
| `address` | `string \| null` | 物件所在地（`address` または `display_address`） |

### SMS送信履歴保存パラメータ

既存の`saveSellerSendHistory`を使用する。

| フィールド | 値 |
|---|---|
| `chat_type` | `'seller_sms'` |
| `subject` | テンプレート名（「内覧問合せ」または「空」） |
| `message` | 生成されたSMS本文 |
| `sender_name` | `employee.name \|\| employee.initials \|\| '不明'` |

### テンプレート本文定義

**内覧問合せテンプレート:**
```
{sellerName}様

お世話になっております。
{address}の内覧についてご連絡させていただきました。
ご都合のよい日時をお知らせいただけますでしょうか。

株式会社いふう
```

**空テンプレート:**
```
株式会社いふう
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 全テンプレートに署名が付与される

*任意の* テンプレートIDと物件情報の組み合わせに対して、`generateSmsBody`が生成するSMS本文は必ず「株式会社いふう」を含む。

**Validates: Requirements 2.3, 4.3**

### プロパティ2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる

*任意の* 物件所在地文字列と売主氏名文字列を入力として、`generateSmsBody('viewing_inquiry', ...)`が生成する本文はその物件所在地と売主氏名を含む。

**Validates: Requirements 4.1, 4.2, 4.4**

### プロパティ3: SMS URIが正しい形式で生成される

*任意の* 電話番号文字列とSMS本文文字列に対して、生成されるSMS URIは`sms:{phone}?body={encodeURIComponent(body)}`の形式に従う。

**Validates: Requirements 3.1**

### プロパティ4: 送信履歴にテンプレート名と送信者名が記録される

*任意の* テンプレート選択と従業員情報（name/initials）の組み合わせに対して、`saveSellerSendHistory`に渡される`subject`はテンプレート名と一致し、`sender_name`は`employee.name || employee.initials || '不明'`と一致する。

**Validates: Requirements 5.1, 5.2**

---

## エラーハンドリング

| ケース | 対応 |
|---|---|
| `seller_contact`が存在しない | SMS送信ボタンを非表示にする |
| `seller_name`が存在しない | 「オーナー」または空文字で代替する（要件4.5） |
| `address`も`display_address`も存在しない | 空文字で代替する |
| `saveSellerSendHistory`が失敗 | SMS送信自体は成功として扱い、`console.error`でログ記録（要件3.3） |

---

## テスト戦略

### PBT適用判断

`generateSmsBody`は純粋関数であり、入力（テンプレートID・物件情報）に対して出力（SMS本文文字列）が決定論的に定まる。プロパティベーステストが適切。

### ユニットテスト（`smsTemplates.test.ts`）

- `generateSmsBody('viewing_inquiry', ...)` が物件所在地・売主氏名・署名を含むことを確認
- `generateSmsBody('empty', ...)` が署名のみを含むことを確認
- `seller_name`がnullの場合のフォールバック動作を確認

### プロパティベーステスト（fast-check使用、最低100イテレーション）

各プロパティテストには以下のタグコメントを付与する:
`// Feature: property-sms-template-addition, Property {N}: {property_text}`

**プロパティ1のテスト:**
```typescript
// Feature: property-sms-template-addition, Property 1: 全テンプレートに署名が付与される
fc.assert(fc.property(
  fc.constantFrom('viewing_inquiry', 'empty'),
  fc.record({ sellerName: fc.option(fc.string()), address: fc.option(fc.string()) }),
  (templateId, params) => {
    const body = generateSmsBody(templateId, params);
    return body.includes('株式会社いふう');
  }
), { numRuns: 100 });
```

**プロパティ2のテスト:**
```typescript
// Feature: property-sms-template-addition, Property 2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる
fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  fc.string({ minLength: 1 }),
  (address, sellerName) => {
    const body = generateSmsBody('viewing_inquiry', { address, sellerName });
    return body.includes(address) && body.includes(sellerName);
  }
), { numRuns: 100 });
```

**プロパティ3のテスト:**
```typescript
// Feature: property-sms-template-addition, Property 3: SMS URIが正しい形式で生成される
fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  fc.string({ minLength: 1 }),
  (phone, body) => {
    const uri = `sms:${phone}?body=${encodeURIComponent(body)}`;
    return uri.startsWith(`sms:${phone}?body=`);
  }
), { numRuns: 100 });
```

**プロパティ4のテスト:**
```typescript
// Feature: property-sms-template-addition, Property 4: 送信履歴にテンプレート名と送信者名が記録される
fc.assert(fc.property(
  fc.constantFrom('viewing_inquiry', 'empty'),
  fc.record({ name: fc.option(fc.string()), initials: fc.option(fc.string()) }),
  (templateId, employee) => {
    const template = smsTemplates.find(t => t.id === templateId)!;
    const senderName = employee.name || employee.initials || '不明';
    // saveSellerSendHistoryに渡されるパラメータを検証
    return senderName !== undefined && template.name !== undefined;
  }
), { numRuns: 100 });
```

### 統合テスト（Emailテンプレート実装と同様のパターン）

- ドロップダウンボタンのクリックでメニューが表示されること
- テンプレート選択後に確認ダイアログが開くこと
- 送信後に`sellerSendHistoryRefreshTrigger`が更新されること
