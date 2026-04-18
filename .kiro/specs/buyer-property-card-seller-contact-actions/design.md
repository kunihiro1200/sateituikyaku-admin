# 設計ドキュメント: 買主詳細画面 物件カード 売主連絡アクション

## Overview

買主詳細画面（BuyerDetailPage）内の「物件詳細カード」（PropertyInfoCard）に表示される売主情報セクションに、以下の2つのアクション機能を追加する。

1. **連絡先クリックで電話発信**：`seller_contact` を `tel:` リンクとして表示し、クリックで電話発信 + 送信履歴記録
2. **メールアドレス横のメール送信ボタン**：PropertyListingDetailPage と同じテンプレート選択フローでメール送信 + 送信履歴記録

変更対象は `PropertyInfoCard.tsx` のみ（フロントエンド）。バックエンドAPIはすべて既存のものを再利用する。

---

## Architecture

```mermaid
graph TD
    A[BuyerDetailPage] --> B[PropertyInfoCard]
    B --> C{seller_contact あり?}
    C -->|Yes| D[tel: リンク表示]
    C -->|No| E[通常テキスト表示]
    D -->|クリック| F[window.location.href = tel:xxx]
    F --> G[saveSellerSendHistory API\nchat_type: seller_sms]

    B --> H{seller_email あり?}
    H -->|Yes| I[EmailIcon ボタン表示]
    H -->|No| J[ボタン非表示]
    I -->|クリック| K[GET /api/email-templates/property-non-report]
    K --> L[テンプレート選択メニュー表示]
    L -->|選択| M[POST /api/email-templates/property/merge]
    M --> N[メール送信ダイアログ表示]
    N -->|送信| O[POST /api/emails/by-seller-number/{propertyNumber}/send-template-email]
    O --> P[saveSellerSendHistory API\nchat_type: seller_email]

    G --> Q[(property_chat_history テーブル)]
    P --> Q
```

### 既存APIの再利用

| API | 用途 | 変更 |
|-----|------|------|
| `GET /api/email-templates/property-non-report` | 物件テンプレート一覧取得 | なし |
| `POST /api/email-templates/property/merge` | テンプレートのプレースホルダー置換 | なし |
| `POST /api/emails/by-seller-number/{propertyNumber}/send-template-email` | メール送信 | なし |
| `POST /api/property-listings/{propertyNumber}/seller-send-history` | 送信履歴保存 | なし |

---

## Components and Interfaces

### PropertyInfoCard.tsx（主要変更対象）

#### 追加する state

```typescript
// 電話発信関連
// （state 不要 - クリック時に直接処理）

// メール送信ダイアログ関連
const [emailDialogOpen, setEmailDialogOpen] = useState(false);
const [emailSubject, setEmailSubject] = useState('');
const [emailBody, setEmailBody] = useState('');
const [emailRecipient, setEmailRecipient] = useState('');
const [selectedTemplateName, setSelectedTemplateName] = useState('');
const [sendingEmail, setSendingEmail] = useState(false);

// テンプレートメニュー関連
const [propertyEmailTemplates, setPropertyEmailTemplates] = useState<
  Array<{ id: string; name: string; subject: string; body: string }>
>([]);
const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

// 送信元・返信先
const [senderAddress, setSenderAddress] = useState<string>(getSenderAddress());
const [replyTo, setReplyTo] = useState<string>('');
const [jimuStaff, setJimuStaff] = useState<Array<{ initials: string; name: string; email?: string }>>([]);

// 画像添付
const [selectedImages, setSelectedImages] = useState<any[]>([]);
const [showImageSelector, setShowImageSelector] = useState(false);
```

#### 追加する handler

```typescript
// 電話発信 + 履歴記録
const handlePhoneCall = async (phoneNumber: string) => { ... }

// メール送信ボタンクリック → テンプレート一覧取得
const handleEmailButtonClick = async (event: React.MouseEvent<HTMLElement>) => { ... }

// テンプレート選択 → merge → ダイアログ表示
const handleSelectTemplate = async (templateId: string) => { ... }

// メール送信実行 + 履歴記録
const handleSendEmail = async () => { ... }

// ダイアログキャンセル
const handleEmailDialogClose = () => { ... }
```

#### 追加する import

```typescript
import { useAuthStore } from '../store/authStore';
import { propertyListingApi } from '../services/api';
import { getSenderAddress, saveSenderAddress } from '../utils/senderAddressStorage';
import RichTextEmailEditor from './RichTextEmailEditor';
import SenderAddressSelector from './SenderAddressSelector';
import ImageSelectorModal from './ImageSelectorModal';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem,
  Menu, Chip,
} from '@mui/material';
```

### PropertyInfoCardProps（変更なし）

既存の `PropertyInfoCardProps` インターフェースは変更しない。`useAuthStore` はコンポーネント内部で呼び出す。

---

## Data Models

### 送信履歴保存リクエスト（既存）

```typescript
// POST /api/property-listings/{propertyNumber}/seller-send-history
interface SellerSendHistoryRequest {
  chat_type: 'seller_email' | 'seller_sms' | 'seller_gmail';
  subject: string;
  message: string;
  sender_name: string;
}
```

#### 電話発信時のパラメータ

| フィールド | 値 |
|-----------|-----|
| `chat_type` | `'seller_sms'` |
| `subject` | `'電話発信'` |
| `message` | `seller_contact` の値（電話番号） |
| `sender_name` | `employee?.name \|\| employee?.initials \|\| '不明'` |

#### メール送信時のパラメータ

| フィールド | 値 |
|-----------|-----|
| `chat_type` | `'seller_email'` |
| `subject` | 選択したテンプレート名 または 件名 |
| `message` | メール本文（HTML） |
| `sender_name` | `employee?.name \|\| employee?.initials \|\| '不明'` |

### メール送信リクエスト（既存）

```typescript
// POST /api/emails/by-seller-number/{propertyNumber}/send-template-email
interface SendTemplateEmailRequest {
  templateId: string;       // 'custom' 固定
  to: string;               // seller_email
  subject: string;
  content: string;
  htmlBody: string;
  from: string;             // senderAddress
  replyTo?: string;
  attachments?: Array<{
    id: string;
    name: string;
    base64Data?: string;
    mimeType?: string;
    url?: string;
  }>;
}
```

### PropertyFullDetails インターフェース（追加フィールド）

`PropertyInfoCard.tsx` 内の `PropertyFullDetails` インターフェースに以下を追加する（`seller_email` は既存の `seller_contact` と同様に追加）：

```typescript
interface PropertyFullDetails {
  // ... 既存フィールド ...
  seller_contact?: string;   // 既存
  seller_email?: string;     // 追加
  seller_name?: string;      // 追加
}
```

---

## Error Handling

### 電話発信時のエラー処理

- `window.location.href = 'tel:...'` は失敗しない（ブラウザ依存の動作）
- 送信履歴の保存に失敗した場合：`console.error` に記録し、ユーザーへのエラー表示は行わない
- 電話発信自体は常に成功として扱う

### メール送信時のエラー処理

| エラー発生箇所 | 処理 |
|--------------|------|
| テンプレート一覧取得失敗 | スナックバーでエラー表示、メニューを閉じる |
| テンプレートmerge失敗 | スナックバーでエラー表示 |
| メール送信失敗 | スナックバーでエラー表示（`error.response?.data?.error?.message` を優先） |
| 送信履歴保存失敗 | `console.error` に記録のみ、メール送信は成功として扱う |

### スナックバー

既存の `snackbarOpen` / `snackbarMessage` state を再利用する。

---

## Testing Strategy

この機能はUIコンポーネントの変更が主体であり、純粋関数やデータ変換ロジックが少ない。
プロパティベーステスト（PBT）は適用せず、例示テストと統合テストで品質を担保する。

**PBTを適用しない理由**：
- テスト対象はReactコンポーネントのUI操作フロー（レンダリング、クリックハンドラ、ダイアログ開閉）
- 入力値の変化（電話番号やメールアドレスの内容）によって動作が変わるロジックがない
- 外部APIへのコールが主体で、ビジネスロジックの変換処理がない

### 単体テスト（例示テスト）

#### 電話発信機能

| テストケース | 確認内容 |
|------------|---------|
| seller_contact あり | `tel:` リンクとしてレンダリングされる |
| seller_contact なし | 通常テキストとして表示される（リンクなし） |
| リンククリック | `window.location.href` が `tel:{seller_contact}` に設定される |
| リンククリック | `saveSellerSendHistory` が `chat_type: 'seller_sms'`, `subject: '電話発信'` で呼ばれる |
| 履歴保存失敗 | `console.error` が呼ばれ、UIにエラーが表示されない |

#### メール送信機能

| テストケース | 確認内容 |
|------------|---------|
| seller_email あり | EmailIcon ボタンが表示される |
| seller_email なし | EmailIcon ボタンが表示されない |
| ボタンクリック | `GET /api/email-templates/property-non-report` が呼ばれる |
| テンプレート選択 | `POST /api/email-templates/property/merge` が呼ばれる |
| 送信ボタンクリック | `POST /api/emails/by-seller-number/{propertyNumber}/send-template-email` が呼ばれる |
| 送信成功 | `saveSellerSendHistory` が `chat_type: 'seller_email'` で呼ばれる |
| 送信失敗 | スナックバーにエラーメッセージが表示される |
| キャンセル | ダイアログが閉じ、全 state がリセットされる |

#### ログインユーザー情報

| テストケース | 確認内容 |
|------------|---------|
| employee.name あり | `sender_name` に `employee.name` が使われる |
| employee.name なし・initials あり | `sender_name` に `employee.initials` が使われる |
| employee なし | `sender_name` に `'不明'` が使われる |

### 手動テスト（動作確認）

1. 買主詳細画面を開き、物件詳細カードの売主情報セクションを確認
2. `seller_contact` が電話リンクとして表示されることを確認
3. 電話リンクをクリックし、デバイスの電話アプリが起動することを確認
4. 物件詳細画面（PropertyListingDetailPage）の「売主・物件の送信履歴」に「電話発信」が記録されることを確認
5. メール送信ボタンをクリックし、テンプレート選択メニューが表示されることを確認
6. テンプレートを選択し、件名・本文が自動入力されたダイアログが開くことを確認
7. メールを送信し、「売主・物件の送信履歴」にメール送信履歴が記録されることを確認
