# デザインドキュメント: 業者問合せフィールド（buyer-agency-inquiry-field）

## 概要

新規買主登録画面（`NewBuyerPage.tsx`）と買主詳細画面（`BuyerDetailPage.tsx`）に、「法人名」（`company_name`）フィールドへの入力を条件として「業者問合せ」（`broker_inquiry`）フィールドを条件付きで表示する機能を追加する。

`broker_inquiry`カラムはデータベース（`buyers`テーブル）およびスプレッドシートマッピング（`buyer-column-mapping.json`）に既に存在しており、フロントエンドへの追加のみが必要となる。

## アーキテクチャ

本機能はフロントエンドのみの変更で完結する。バックエンドの`POST /api/buyers`エンドポイントは既に`broker_inquiry`フィールドを受け付けており、スプレッドシートへの同期マッピングも設定済みである。

```
[NewBuyerPage / BuyerDetailPage]
  ↓ company_name の入力状態を監視
  ↓ 条件付きで broker_inquiry フィールドを表示
  ↓ POST /api/buyers または PATCH /api/buyers/:id
[BuyerService (backend/src/services/BuyerService.ts)]
  ↓ broker_inquiry を DB に保存
  ↓ SyncQueue 経由でスプレッドシートに即時同期
[buyer-column-mapping.json]
  ↓ "業者問合せ" カラムにマッピング済み
```

## コンポーネントとインターフェース

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/pages/NewBuyerPage.tsx` | `company_name`・`broker_inquiry`フィールドの追加、条件付き表示ロジック |
| `frontend/frontend/src/pages/BuyerDetailPage.tsx` | `BUYER_FIELD_SECTIONS`の基本情報セクションに`broker_inquiry`フィールドを追加、条件付き表示ロジック |

### 業者問合せの選択肢

```typescript
const BROKER_INQUIRY_OPTIONS = [
  { label: '業者問合せ', value: '業者問合せ' },
  { label: '業者（両手）', value: '業者（両手）' },
];
```

### 条件付き表示ロジック

```typescript
// 法人名に1文字以上の入力がある場合に業者問合せを表示
const showBrokerInquiry = (companyName: string | undefined): boolean => {
  return Boolean(companyName && companyName.trim().length > 0);
};
```

## データモデル

### buyers テーブル（既存）

```sql
broker_inquiry TEXT  -- 業者問合せ（「業者問合せ」または「業者（両手）」）
```

### スプレッドシートマッピング（既存）

`frontend/frontend/src/backend/config/buyer-column-mapping.json`:
```json
{
  "spreadsheetToDatabase": {
    "業者問合せ": "broker_inquiry"
  }
}
```

### NewBuyerPage の状態

```typescript
// 追加するstate
const [companyName, setCompanyName] = useState('');
const [brokerInquiry, setBrokerInquiry] = useState('');

// 送信データ
const buyerData = {
  // ...既存フィールド
  company_name: companyName,
  broker_inquiry: companyName.trim() ? brokerInquiry : '',
};
```

### BuyerDetailPage の BUYER_FIELD_SECTIONS 変更

```typescript
{
  title: '基本情報',
  fields: [
    { key: 'buyer_number', label: '買主番号', inlineEditable: true, readOnly: true },
    { key: 'name', label: '氏名・会社名', inlineEditable: true },
    { key: 'phone_number', label: '電話番号', inlineEditable: true },
    { key: 'email', label: 'メールアドレス', inlineEditable: true },
    { key: 'company_name', label: '法人名', inlineEditable: true },
    // 追加: company_name に値がある場合のみ表示
    { key: 'broker_inquiry', label: '業者問合せ', inlineEditable: true, fieldType: 'dropdown', conditionalOn: 'company_name' },
  ],
},
```

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 法人名の有無と業者問合せの表示状態の一致

*任意の* `company_name` の値に対して、その値が空でない場合は業者問合せフィールドが表示され、空の場合は非表示になる。すなわち、業者問合せフィールドの表示状態は `company_name` が空でないことと等価である。

**Validates: Requirements 1.2, 1.3, 4.2, 4.3**

### Property 2: 法人名クリア時の業者問合せ値のリセット

*任意の* 法人名と業者問合せの組み合わせに対して、法人名をクリアした後に業者問合せの値は空文字列にリセットされる。

**Validates: Requirements 1.4**

### Property 3: 登録リクエストへの broker_inquiry の包含

*任意の* フォーム送信に対して、`POST /api/buyers` リクエストのペイロードには常に `broker_inquiry` フィールドが含まれる。法人名が空の場合は空文字列、法人名がある場合は選択された値が送信される。

**Validates: Requirements 3.1, 3.2**

### Property 4: BuyerDetailPage での条件付き表示

*任意の* 買主データに対して、`company_name` が空でない場合は業者問合せフィールドが表示され、空の場合は非表示になる。

**Validates: Requirements 4.2, 4.3**

## エラーハンドリング

- 業者問合せフィールドは必須ではない（法人名がある場合でも未選択のまま登録可能）
- 法人名がクリアされた場合、業者問合せの値は自動的にリセットされる
- BuyerDetailPage でのインライン編集失敗時は既存のエラーハンドリング（`handleInlineFieldSave`）に委ねる

## テスト戦略

### ユニットテスト

- `showBrokerInquiry()` 関数のテスト
  - 空文字列 → `false`
  - 空白のみ → `false`
  - 1文字以上 → `true`

### プロパティベーステスト

各プロパティは最低100回のイテレーションで実行する。

**Property 1: 法人名の有無と業者問合せの表示状態の一致**
```typescript
// Feature: buyer-agency-inquiry-field, Property 1: 法人名の有無と業者問合せの表示状態の一致
// 任意の文字列（空・非空）を生成し、showBrokerInquiry() の結果が
// 文字列が空でないことと等価であることを検証
fc.assert(
  fc.property(fc.string(), (companyName) => {
    const result = showBrokerInquiry(companyName);
    const expected = companyName.trim().length > 0;
    return result === expected;
  }),
  { numRuns: 100 }
);
```

**Property 2: 法人名クリア時の業者問合せ値のリセット**
```typescript
// Feature: buyer-agency-inquiry-field, Property 2: 法人名クリア時の業者問合せ値のリセット
// 任意の法人名と業者問合せ値を設定後、法人名をクリアした場合に
// 送信データの broker_inquiry が空文字列になることを検証
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),
    fc.constantFrom('業者問合せ', '業者（両手）'),
    (companyName, brokerInquiry) => {
      const result = buildBuyerData({ companyName: '', brokerInquiry });
      return result.broker_inquiry === '';
    }
  ),
  { numRuns: 100 }
);
```

**Property 3: 登録リクエストへの broker_inquiry の包含**
```typescript
// Feature: buyer-agency-inquiry-field, Property 3: 登録リクエストへの broker_inquiry の包含
// 任意のフォームデータに対して、送信ペイロードに broker_inquiry が含まれることを検証
fc.assert(
  fc.property(
    fc.record({
      companyName: fc.string(),
      brokerInquiry: fc.constantFrom('', '業者問合せ', '業者（両手）'),
    }),
    ({ companyName, brokerInquiry }) => {
      const payload = buildBuyerData({ companyName, brokerInquiry });
      return 'broker_inquiry' in payload;
    }
  ),
  { numRuns: 100 }
);
```

### プロパティベーステストライブラリ

TypeScript/React プロジェクトのため、**fast-check** を使用する。

```bash
npm install --save-dev fast-check
```

### 統合テスト（手動確認）

1. NewBuyerPage で法人名を入力 → 業者問合せが表示されることを確認
2. NewBuyerPage で法人名をクリア → 業者問合せが非表示になり値がリセットされることを確認
3. 業者問合せを選択して登録 → DBに正しく保存されることを確認
4. BuyerDetailPage で法人名がある買主 → 業者問合せが表示されることを確認
5. BuyerDetailPage で法人名がない買主 → 業者問合せが非表示であることを確認
