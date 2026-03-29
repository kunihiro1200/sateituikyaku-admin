# 設計ドキュメント: buyer-copy-fields-registration

## 概要

新規買主登録画面（`NewBuyerPage.tsx`）の基本情報セクションに「売主コピー」と「買主コピー」の2つのAutocompleteフィールドを追加する。

既存の `NewSellerPage.tsx` に実装されている同様のフィールドを参考に、買主登録フォームへ移植する。コピーフィールドは入力補助専用であり、DBには保存しない。

---

## アーキテクチャ

### 変更対象

- **フロントエンドのみ**: `frontend/frontend/src/pages/NewBuyerPage.tsx`
- バックエンド変更なし（既存APIエンドポイントを使用）
- DBマイグレーション不要（コピーフィールドはDBに保存しない）

### 使用する既存APIエンドポイント

| エンドポイント | 用途 |
|---|---|
| `GET /api/sellers/search?q={query}` | 売主コピー候補の検索 |
| `GET /api/sellers/by-number/{sellerNumber}` | 売主詳細情報の取得 |
| `GET /api/buyers/search?q={query}&limit=20` | 買主コピー候補の検索 |
| `GET /api/buyers/{buyer_number}` | 買主詳細情報の取得 |

---

## コンポーネントとインターフェース

### 新規追加する state

```typescript
// 売主コピー
const [sellerCopyInput, setSellerCopyInput] = useState('');
const [sellerCopyOptions, setSellerCopyOptions] = useState<Array<{sellerNumber: string; name: string; id: string}>>([]);
const [sellerCopyLoading, setSellerCopyLoading] = useState(false);

// 買主コピー
const [buyerCopyInput, setBuyerCopyInput] = useState('');
const [buyerCopyOptions, setBuyerCopyOptions] = useState<Array<{buyer_number: string; name: string}>>([]);
const [buyerCopyLoading, setBuyerCopyLoading] = useState(false);
```

### 新規追加するハンドラ関数

#### `handleSellerCopySearch(query: string)`

- `query.length < 2` の場合は候補をクリアして早期リターン
- `GET /api/sellers/search?q={query}` を呼び出して候補を `sellerCopyOptions` にセット

#### `handleSellerCopySelect(option: {sellerNumber: string; name: string; id: string} | null)`

- `GET /api/sellers/by-number/{option.sellerNumber}` で売主詳細を取得
- `seller.name` → `setName()`
- `seller.phoneNumber` → `setPhoneNumber()`
- `seller.email` → `setEmail()`
- `setInquirySource('売主')` を自動設定

#### `handleBuyerCopySearch(query: string)`

- `query.length < 2` の場合は候補をクリアして早期リターン
- `GET /api/buyers/search?q={query}&limit=20` を呼び出して候補を `buyerCopyOptions` にセット

#### `handleBuyerCopySelect(option: {buyer_number: string; name: string} | null)`

- `GET /api/buyers/{option.buyer_number}` で買主詳細を取得
- `buyer.name` → `setName()`
- `buyer.phoneNumber || buyer.phone_number` → `setPhoneNumber()`
- `buyer.email` → `setEmail()`
- `setInquirySource('2件目以降')` を自動設定

### フィールド配置順序（基本情報セクション）

```
1. 売主コピー（Autocomplete）  ← 新規追加
2. 買主コピー（Autocomplete）  ← 新規追加
3. 買主番号（自動採番・読み取り専用）
4. 氏名・会社名（必須）
5. 電話番号
6. メールアドレス
7. 法人名
8. 業者問合せ（法人名入力時のみ表示）
```

---

## データモデル

### コピーフィールドのデータフロー

```
ユーザーが売主コピーに入力
  ↓
handleSellerCopySearch() → /api/sellers/search → sellerCopyOptions
  ↓
ユーザーが候補を選択
  ↓
handleSellerCopySelect() → /api/sellers/by-number/{sellerNumber}
  ↓
name / phoneNumber / email / inquirySource を state に反映
  ↓
フォーム送信時は通常フィールドの値のみ POST /api/buyers に送信
（売主コピー・買主コピーの値は送信しない）
```

### 問合せ元の自動設定値

| コピー操作 | 自動設定値 | INQUIRY_SOURCE_OPTIONS の value |
|---|---|---|
| 売主コピーで売主選択 | `'売主'` | `'売主'`（category: 売主） |
| 買主コピーで買主選択 | `'2件目以降'` | `'2件目以降'`（category: その他） |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いを形式的に記述したものです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。*

### プロパティ 1: 売主コピー選択後の自動入力と問合せ元設定

*任意の* 売主データ（name, phoneNumber, email を持つ）に対して、売主コピーで選択した場合、フォームの氏名・電話番号・メールアドレスフィールドに売主の対応する値が反映され、かつ問合せ元（inquiry_source）が `'売主'` に設定される。

**検証対象: 要件 1.3, 1.4, 1.5, 4.2**

### プロパティ 2: 買主コピー選択後の自動入力と問合せ元設定

*任意の* 買主データ（name, phone_number, email を持つ）に対して、買主コピーで選択した場合、フォームの氏名・電話番号・メールアドレスフィールドに買主の対応する値が反映され、かつ問合せ元（inquiry_source）が `'2件目以降'` に設定される。

**検証対象: 要件 2.3, 2.4, 2.5, 4.1**

### プロパティ 3: コピーフィールドは2文字以上で検索APIを呼び出す

*任意の* 2文字以上の文字列入力に対して、対応する検索API（`/api/sellers/search` または `/api/buyers/search`）が呼び出される。逆に、1文字以下の入力に対してはAPIが呼び出されず候補リストが空のままである。

**検証対象: 要件 1.2, 2.2**

### プロパティ 4: 問合せ元の手動変更が優先される

*任意の* コピー操作による問合せ元の自動設定後に、ユーザーが手動で別の値を設定した場合、手動で設定した値が保持される（後から設定した値が優先される）。

**検証対象: 要件 4.3**

### プロパティ 5: コピーフィールドはDBに保存されない

*任意の* フォーム送信に対して、`POST /api/buyers` のリクエストボディに `sellerCopyInput` および `buyerCopyInput` の値が含まれない。

**検証対象: 要件 5.2**

---

## エラーハンドリング

| エラーケース | 対応 |
|---|---|
| 売主コピー検索結果が0件 | Autocomplete の `noOptionsText` に「該当する売主が見つかりません」を表示 |
| 買主コピー検索結果が0件 | Autocomplete の `noOptionsText` に「該当する買主が見つかりません」を表示 |
| 売主詳細取得失敗 | `setError('売主情報の取得に失敗しました')` でエラー表示 |
| 買主詳細取得失敗 | `setError('買主情報の取得に失敗しました')` でエラー表示 |
| 検索クエリが2文字未満 | APIを呼び出さず候補をクリア |

---

## テスト戦略

### ユニットテスト（具体例・エッジケース）

- 1文字入力時にAPIが呼ばれないこと
- 売主コピー選択後に `inquirySource` が `'売主'` になること
- 買主コピー選択後に `inquirySource` が `'2件目以降'` になること
- フォーム送信データにコピーフィールドが含まれないこと

### プロパティベーステスト

各プロパティに対して、ランダムな入力値を生成して検証する。

**使用ライブラリ**: `fast-check`（TypeScript/JavaScript向けプロパティベーステストライブラリ）

**最小実行回数**: 各プロパティテストにつき100回以上

**タグ形式**: `// Feature: buyer-copy-fields-registration, Property {番号}: {プロパティ内容}`

#### プロパティテスト実装方針

```typescript
// Feature: buyer-copy-fields-registration, Property 1: 売主コピー選択後の自動入力
// For any valid seller, selecting it via seller copy should populate name/phone/email
fc.assert(fc.asyncProperty(
  fc.record({ name: fc.string(), phoneNumber: fc.string(), email: fc.emailAddress() }),
  async (seller) => {
    // モックAPIレスポンスを設定してhandleSellerCopySelectを呼び出し
    // name/phone/emailが正しく反映されることを検証
  }
), { numRuns: 100 });
```

```typescript
// Feature: buyer-copy-fields-registration, Property 6: 短い検索クエリでは候補を表示しない
// For any string of length <= 1, no API call should be made
fc.assert(fc.property(
  fc.string({ maxLength: 1 }),
  (query) => {
    // handleSellerCopySearch(query) を呼び出し
    // APIが呼ばれないことを検証
  }
), { numRuns: 100 });
```

### 両テストの補完関係

- **ユニットテスト**: 具体的な値（`'売主'`、`'2件目以降'`）の正確性を検証
- **プロパティテスト**: 任意の入力に対して不変条件が成立することを検証
- 両者を組み合わせることで、具体例の正確性と汎用的な正確性の両方を保証する
