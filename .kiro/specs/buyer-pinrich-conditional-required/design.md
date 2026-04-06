# 設計ドキュメント

## 概要

買主詳細ページ（BuyerDetailPage.tsx）において、「Pinrich」フィールドを条件付き必須項目として実装する機能の設計書。

メールアドレスが空白でなく、かつ「業者問合せ」フィールドが空白の場合に、「Pinrich」フィールドの入力を必須とする。

---

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    BuyerDetailPage.tsx                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  条件付き必須バリデーションロジック                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ isPinrichRequired(buyer)                        │  │  │
│  │  │  - メールアドレス != null/空白                  │  │  │
│  │  │  - 業者問合せ == null/空白                      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ checkMissingFields()                            │  │  │
│  │  │  - 全必須フィールドをチェック                   │  │  │
│  │  │  - missingRequiredFields を更新                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  UI コンポーネント                                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ メールアドレス（テキストフィールド）            │  │  │
│  │  │  - onChange → 必須状態を再計算                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 業者問合せ（ボックス選択）                      │  │  │
│  │  │  - onChange → 必須状態を再計算                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Pinrich（ドロップダウン）                       │  │  │
│  │  │  - 必須時は赤枠ハイライト                       │  │  │
│  │  │  - onChange → 必須状態を再計算                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ValidationWarningDialog                                 │  │
│  │  - 未入力必須フィールド一覧を表示                       │  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

```
1. ページ読み込み
   fetchBuyer() → buyer state 更新
   ↓
   isPinrichRequired(buyer) 判定
   ↓
   missingRequiredFields 初期化

2. メールアドレス変更
   ユーザー入力 → buyer state 更新
   ↓
   isPinrichRequired(buyer) 再判定
   ↓
   missingRequiredFields 更新
   ↓
   UI ハイライト更新

3. 業者問合せ変更
   ユーザー入力 → buyer state 更新
   ↓
   isPinrichRequired(buyer) 再判定
   ↓
   missingRequiredFields 更新
   ↓
   UI ハイライト更新

4. Pinrich変更
   ユーザー入力 → buyer state 更新
   ↓
   missingRequiredFields 更新
   ↓
   UI ハイライト解除

5. 保存ボタン押下
   checkMissingFields() 実行
   ↓
   未入力必須フィールドあり？
   ├─ Yes → ValidationWarningDialog 表示
   └─ No → 保存処理実行
```

---

## コンポーネントとインターフェース

### 主要コンポーネント

#### 1. BuyerDetailPage.tsx

**責務**:
- 買主詳細情報の表示と編集
- 条件付き必須バリデーションの実装
- UI ハイライト制御

**主要な State**:
```typescript
const [buyer, setBuyer] = useState<Buyer | null>(null);
const [missingRequiredFields, setMissingRequiredFields] = useState<Set<string>>(new Set());
```

**主要な関数**:
- `isPinrichRequired(data: any): boolean` - Pinrichの必須判定
- `checkMissingFields(): string[]` - 全必須フィールドのチェック
- `handleFieldChange(sectionTitle: string, fieldName: string, newValue: any)` - フィールド変更ハンドラー

#### 2. ValidationWarningDialog

**責務**:
- 未入力必須フィールドの警告表示
- 保存前のバリデーション結果の通知

**Props**:
```typescript
interface ValidationWarningDialogProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  missingFields: string[];
}
```

---

## データモデル

### Buyer インターフェース

```typescript
interface Buyer {
  buyer_id: string;
  buyer_number: string;
  name: string;
  phone_number: string;
  email: string | null;  // メールアドレス
  pinrich: string | null;  // 「未選択」「配信中」「クローズ」
  broker_inquiry: string | null;  // 「業者問合せ」「業者（両手）」
  inquiry_source: string | null;
  latest_status: string | null;
  distribution_type: string | null;
  // ... その他のフィールド
}
```

### フィールド定義

| フィールド名 | データベースカラム名 | 型 | 説明 |
|------------|-------------------|-----|------|
| メールアドレス | `email` | TEXT | 買主のメールアドレス |
| Pinrich | `pinrich` | TEXT | 「未選択」「配信中」「クローズ」の3択 |
| 業者問合せ | `broker_inquiry` | TEXT | 「業者問合せ」「業者（両手）」の2択 |

---

## Low-Level Design

### 1. 条件付き必須判定ロジック

#### isPinrichRequired 関数

**新規実装**:
```typescript
// ✅ 新規追加
const isPinrichRequired = (data: any): boolean => {
  // 条件1: メールアドレスが空白でないこと
  if (!data.email) return false;
  const emailTrimmed = String(data.email).trim();
  if (emailTrimmed.length === 0) return false;

  // 条件2: 業者問合せが空白であること
  if (data.broker_inquiry) {
    const brokerTrimmed = String(data.broker_inquiry).trim();
    if (brokerTrimmed.length > 0) return false;
  }

  return true;
};
```

**ロジック説明**:
1. `email` が `null`、`undefined`、空文字列、空白文字のみの場合 → 必須でない
2. `broker_inquiry` が `null`、`undefined`、空文字列、空白文字のみでない場合 → 必須でない
3. 上記全てを満たす場合 → 必須

**条件式（スプレッドシート互換）**:
```
AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))
```

**ISNOTBLANK の実装**:
```typescript
const isNotBlank = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const trimmed = String(value).trim();
  return trimmed.length > 0;
};
```

**ISBLANK の実装**:
```typescript
const isBlank = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  const trimmed = String(value).trim();
  return trimmed.length === 0;
};
```

---

### 2. checkMissingFields 関数の修正

**修正箇所**:
```typescript
const checkMissingFields = (): string[] => {
  if (!buyer) return [];

  const missingKeys: string[] = [];

  // ... 既存の必須チェック ...

  // Pinrich：条件付き必須（新規追加）
  if (isPinrichRequired(buyer) && 
      (!buyer.pinrich || !String(buyer.pinrich).trim() || buyer.pinrich === '未選択')) {
    missingKeys.push('pinrich');
  }

  // ハイライト用 state を更新
  setMissingRequiredFields(new Set(missingKeys));

  return missingKeys.map(k => REQUIRED_FIELD_LABEL_MAP[k] || k);
};
```

**重要ポイント**:
- `isPinrichRequired(buyer)` が `true` の場合のみ、`pinrich` の入力をチェック
- `pinrich` が「未選択」の場合も未入力として扱う
- 既存の必須チェックロジックを維持（重複追加なし）
- `missingRequiredFields` を更新してUIハイライトを制御

---

### 3. REQUIRED_FIELD_LABEL_MAP の更新

**実装箇所**: BuyerDetailPage.tsx の定数定義

```typescript
const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
  initial_assignee: '初動担当',
  inquiry_source: '問合せ元',
  latest_status: '★最新状況',
  distribution_type: '配信メール',
  inquiry_email_phone: '【問合メール】電話対応',
  three_calls_confirmed: '3回架電確認済み',
  desired_area: 'エリア（希望条件）',
  desired_property_type: '希望種別（希望条件）',
  price_range_house: '価格帯（戸建）',
  price_range_apartment: '価格帯（マンション）',
  price_range_land: '価格帯（土地）',
  price_range_any: '価格帯（いずれか）',
  owned_home_hearing_result: '持家ヒアリング結果',
  pinrich: 'Pinrich',  // ✅ 新規追加
};
```

**確認事項**:
- `pinrich` を追加
- ValidationWarningDialog に正しい表示名が渡される

---

### 4. メールアドレス変更時の動的バリデーション

**実装箇所**: メールアドレスのテキストフィールド変更時

```typescript
// メールアドレスのフィールド変更ハンドラー（InlineEditableFieldから呼ばれる）
// handleFieldChange 経由で呼ばれるため、特別な処理は不要
// ただし、buyer state 更新後に missingRequiredFields を再計算する必要がある

// setBuyer 後に checkMissingFields を呼び出す処理を追加
useEffect(() => {
  if (buyer) {
    checkMissingFields();
  }
}, [buyer?.email, buyer?.broker_inquiry, buyer?.pinrich]);
```

**動作フロー**:
1. ユーザーがメールアドレスを変更
2. `buyer.email` を更新
3. `useEffect` が発火
4. `checkMissingFields()` で必須状態を再判定
5. 必須条件を満たす場合:
   - `pinrich` が空なら `missingRequiredFields` に追加
6. 必須条件を満たさない場合:
   - `missingRequiredFields` から削除

---

### 5. 業者問合せ変更時の動的バリデーション

**実装箇所**: 業者問合せのボックス選択変更時

```typescript
// 業者問合せのフィールド変更ハンドラー（InlineEditableFieldから呼ばれる）
// handleFieldChange 経由で呼ばれるため、特別な処理は不要
// useEffect で buyer.broker_inquiry の変更を監視して自動的に再計算される
```

**動作フロー**:
1. ユーザーが業者問合せを選択
2. `buyer.broker_inquiry` を更新
3. `useEffect` が発火
4. `checkMissingFields()` で必須状態を再判定
5. 業者問合せが選択された場合:
   - `missingRequiredFields` から `pinrich` を削除
6. 業者問合せが空白にクリアされた場合:
   - メールアドレスが空白でなく、Pinrichが空欄なら `missingRequiredFields` に `pinrich` を追加

---

### 6. Pinrichドロップダウン変更時の動的バリデーション

**実装箇所**: Pinrichのドロップダウン選択時

```typescript
// Pinrichのフィールド変更ハンドラー（InlineEditableFieldから呼ばれる）
// handleFieldChange 経由で呼ばれるため、特別な処理は不要
// useEffect で buyer.pinrich の変更を監視して自動的に再計算される
```

**動作フロー**:
1. ユーザーがPinrichのドロップダウンを選択
2. `buyer.pinrich` を更新
3. `useEffect` が発火
4. `checkMissingFields()` で必須状態を再判定
5. 値が入力された場合:
   - `missingRequiredFields` から削除（ハイライト解除）
6. 値が「未選択」に変更された場合:
   - 必須条件を満たす場合のみ `missingRequiredFields` に追加

---

### 7. 初期表示時の必須フィールドチェック

**実装箇所**: `fetchBuyer()` 関数内

```typescript
const fetchBuyer = async () => {
  try {
    setLoading(true);
    const res = await api.get(`/api/buyers/${buyer_number}`);
    setBuyer(res.data);
    
    // ... 既存の初期化処理 ...
    
    // 初回表示時から未入力の必須フィールドをハイライト
    const initialMissing: string[] = [];
    
    // ... 既存の必須チェック ...
    
    // Pinrich：条件付き必須（新規追加）
    if (isPinrichRequired(res.data) && 
        (!res.data.pinrich || !String(res.data.pinrich).trim() || res.data.pinrich === '未選択')) {
      initialMissing.push('pinrich');
    }
    
    if (initialMissing.length > 0) {
      setMissingRequiredFields(new Set(initialMissing));
    }
  } catch (error) {
    console.error('Failed to fetch buyer:', error);
  } finally {
    setLoading(false);
  }
};
```

**動作フロー**:
1. ページ読み込み時に `fetchBuyer()` を実行
2. 買主データを取得
3. `isPinrichRequired(res.data)` で必須状態を判定
4. 必須条件を満たし、かつ `pinrich` が空または「未選択」の場合:
   - `initialMissing` に追加
5. `missingRequiredFields` を初期化
6. UI に赤枠ハイライトを表示

---

### 8. UI ハイライト表示

**実装箇所**: Pinrichのドロップダウンフィールド

Pinrichフィールドは `InlineEditableField` コンポーネントを使用しているため、`missingRequiredFields` に `pinrich` が含まれている場合、自動的に赤枠ハイライトが表示されます。

```typescript
// BUYER_FIELD_SECTIONS の定義（既存）
{
  key: 'pinrich',
  label: 'Pinrich',
  inlineEditable: true,
  fieldType: 'dropdown'
},
```

**InlineEditableField コンポーネントの動作**:
- `missingRequiredFields.has('pinrich')` が `true` の場合
- ドロップダウンフィールドに赤枠（`error` prop）を表示

---

## エラーハンドリング

### 1. null/undefined チェック

**問題**: `buyer` が `null` の場合、`buyer.email` でエラー

**対策**:
```typescript
const checkMissingFields = (): string[] => {
  if (!buyer) return [];  // ✅ 早期リターン
  
  // ... 必須チェック ...
};

const isPinrichRequired = (data: any): boolean => {
  if (!data) return false;  // ✅ 早期リターン
  if (!data.email) return false;
  // ...
};
```

### 2. 文字列変換エラー

**問題**: `email` が `number` 型の場合、`trim()` でエラー

**対策**:
```typescript
const emailTrimmed = String(data.email).trim();  // ✅ String() で変換
const brokerTrimmed = String(data.broker_inquiry).trim();  // ✅ String() で変換
```

---

## テスト戦略

### 1. ユニットテスト

#### isPinrichRequired 関数のテスト

```typescript
describe('isPinrichRequired', () => {
  it('メールアドレスが空白でなく、業者問合せが空白の場合、trueを返す', () => {
    const buyer = {
      email: 'test@example.com',
      broker_inquiry: null,
    };
    expect(isPinrichRequired(buyer)).toBe(true);
  });

  it('メールアドレスが空白の場合、falseを返す', () => {
    const buyer = {
      email: '',
      broker_inquiry: null,
    };
    expect(isPinrichRequired(buyer)).toBe(false);
  });

  it('業者問合せが空白でない場合、falseを返す', () => {
    const buyer = {
      email: 'test@example.com',
      broker_inquiry: '業者問合せ',
    };
    expect(isPinrichRequired(buyer)).toBe(false);
  });

  it('メールアドレスがnullの場合、falseを返す', () => {
    const buyer = {
      email: null,
      broker_inquiry: null,
    };
    expect(isPinrichRequired(buyer)).toBe(false);
  });

  it('メールアドレスが空白文字のみの場合、falseを返す', () => {
    const buyer = {
      email: '   ',
      broker_inquiry: null,
    };
    expect(isPinrichRequired(buyer)).toBe(false);
  });

  it('業者問合せが空白文字のみの場合、trueを返す', () => {
    const buyer = {
      email: 'test@example.com',
      broker_inquiry: '   ',
    };
    expect(isPinrichRequired(buyer)).toBe(true);
  });
});
```

### 2. 統合テスト

#### シナリオ1: 初期表示時のハイライト

**前提条件**:
- メールアドレス: test@example.com
- 業者問合せ: 空
- Pinrich: 空

**期待結果**:
- Pinrichフィールドが赤枠でハイライト表示される

#### シナリオ2: メールアドレス変更時の動的バリデーション

**操作**:
1. メールアドレスを「test@example.com」に変更
2. Pinrichが空のまま

**期待結果**:
- Pinrichフィールドが赤枠でハイライト表示される

#### シナリオ3: 業者問合せ選択時のハイライト解除

**操作**:
1. 業者問合せを「業者問合せ」に変更

**期待結果**:
- Pinrichフィールドの赤枠ハイライトが解除される

#### シナリオ4: Pinrich入力時のハイライト解除

**操作**:
1. Pinrichを「配信中」に変更

**期待結果**:
- Pinrichフィールドの赤枠ハイライトが解除される

#### シナリオ5: 保存時のバリデーション

**操作**:
1. メールアドレス: test@example.com
2. 業者問合せ: 空
3. Pinrich: 空
4. 保存ボタンをクリック

**期待結果**:
- ValidationWarningDialog が表示される
- 未入力必須フィールド一覧に「Pinrich」が含まれる

### 3. エッジケーステスト

#### エッジケース1: メールアドレスが空白文字のみ

**テストケース**:
- メールアドレス: "   " (空白3文字)
- 業者問合せ: 空
- Pinrich: 空

**期待結果**: 必須バリデーションが発動しない

#### エッジケース2: 業者問合せが空白文字のみ

**テストケース**:
- メールアドレス: test@example.com
- 業者問合せ: "   " (空白3文字)
- Pinrich: 空

**期待結果**: 必須バリデーションが発動する

#### エッジケース3: Pinrichが「未選択」

**テストケース**:
- メールアドレス: test@example.com
- 業者問合せ: 空
- Pinrich: 「未選択」

**期待結果**: 必須バリデーションが発動する（「未選択」は未入力として扱う）

---

## 実装手順

### Phase 1: isPinrichRequired 関数の実装

1. `isPinrichRequired` 関数を追加
2. メールアドレスと業者問合せの条件判定ロジックを実装
3. エラーハンドリングを追加

### Phase 2: checkMissingFields 関数の修正

1. `checkMissingFields` 関数に Pinrich の条件付き必須チェックを追加
2. `REQUIRED_FIELD_LABEL_MAP` に `pinrich` を追加

### Phase 3: 動的バリデーションの実装

1. `useEffect` を追加して `buyer.email`、`buyer.broker_inquiry`、`buyer.pinrich` の変更を監視
2. 変更時に `checkMissingFields()` を自動実行

### Phase 4: 初期表示時のバリデーション

1. `fetchBuyer()` 関数内に初期チェックロジックを追加
2. `initialMissing` に `pinrich` を追加

### Phase 5: テストとデバッグ

1. ユニットテストを実行
2. 統合テストを実行
3. エッジケーステストを実行
4. ブラウザでの動作確認

---

## 注意事項

### 1. 既存の必須バリデーションとの共存

**重要**: 既存の必須チェックロジックを壊さないこと

**確認事項**:
- `checkMissingFields()` 関数内で `pinrich` が重複して追加されないこと
- 既存の必須フィールド（`inquiry_source`、`latest_status`、`distribution_type` 等）のバリデーションが正常に動作すること

### 2. 日本語ファイル編集時のエンコーディング保護

**重要**: `strReplace` ツールで日本語ファイルを直接編集しないこと

**推奨方法**:
1. `git restore` で正常なUTF-8ファイルを取得
2. Pythonスクリプトで変更を適用（UTF-8で書き込み）
3. `getDiagnostics` でエラーがないか確認
4. コミット＆プッシュ

### 3. 条件式の一貫性

**重要**: スプレッドシートの条件式と完全に一致させること

**スプレッドシート条件式**:
```
AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))
```

**TypeScript実装**:
```typescript
isNotBlank(email) && isBlank(broker_inquiry)
```

### 4. 「未選択」の扱い

**重要**: Pinrichが「未選択」の場合は未入力として扱うこと

**理由**:
- 「未選択」はデフォルト値であり、実質的に未入力と同じ
- ユーザーが明示的に「配信中」または「クローズ」を選択する必要がある

---

## まとめ

この設計書では、買主詳細ページにおける「Pinrich」フィールドの条件付き必須バリデーション機能を実装するための詳細な設計を提供しました。

**主要な実装ポイント**:
1. `isPinrichRequired` 関数の実装（メールアドレスと業者問合せの条件判定）
2. `checkMissingFields` 関数の修正（Pinrichの条件付き必須チェック追加）
3. 動的バリデーションの実装（`useEffect` で自動再計算）
4. 初期表示時の必須フィールドチェック
5. UI ハイライト表示（`InlineEditableField` の自動ハイライト機能を利用）

**既存機能との共存**:
- 既存の必須バリデーションロジックを維持
- `checkMissingFields()` 関数に条件付き必須チェックを追加
- 重複追加を防止

**テスト戦略**:
- ユニットテスト: `isPinrichRequired` 関数
- 統合テスト: UI操作とバリデーション
- エッジケーステスト: 境界値と特殊ケース

この設計に基づいて実装することで、要件定義書に記載された全ての受け入れ基準を満たすことができます。

