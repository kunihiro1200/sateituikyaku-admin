# デザインドキュメント：買主リスト「初動担当」条件付き必須機能

## Overview

受付日が2026/3/30以降の買主レコードで、以下のいずれかの変更が発生した場合に「初動担当」（`initial_assignee`）フィールドを必須とする機能。

**トリガー条件（いずれか）**:
1. 「【問合メール】電話対応」（`inquiry_email_phone`）フィールドが変更された
2. 「●問合時ヒアリング」（`inquiry_hearing`）フィールドが空でなく、かつ変更された

**適用画面**:
- 買主詳細画面（`BuyerDetailPage.tsx`）
- 新規買主登録画面（`NewBuyerPage.tsx`）

---

## Architecture

### 変更前の値の追跡（_THISROW_BEFORE相当）

フロントエンドで「変更前の値」を保持するために、`useRef` または `useState` を使って初期値をスナップショットとして記録する。

```
fetchBuyer() 完了
  → buyer データを state にセット
  → inquiry_email_phone の初期値を ref に記録
  → inquiry_hearing の初期値を ref に記録
```

### バリデーション発動フロー（BuyerDetailPage）

```
ユーザーがフィールドを変更
  → handleFieldChange() / handleSaveHearing() が呼ばれる
  → 変更後の値と初期値（ref）を比較
  → 条件を満たす場合、initial_assignee の必須チェックを追加
  → checkMissingFields() が initial_assignee を missingKeys に追加
  → ValidationWarningDialog に表示
```

### バリデーション発動フロー（NewBuyerPage）

```
ユーザーが登録ボタンを押す
  → handleSubmit() が呼ばれる
  → reception_date >= 2026-03-30 かつ
    (inquiry_email_phone が入力済み OR inquiry_hearing が入力済み)
    かつ initial_assignee が空
  → エラーメッセージを表示して登録を阻止
```

---

## Components and Interfaces

### BuyerDetailPage の変更点

#### 1. 変更前の値を保持する ref の追加

```typescript
// 変更前の値を保持（_THISROW_BEFORE相当）
const initialInquiryEmailPhoneRef = useRef<string>('');
const initialInquiryHearingRef = useRef<string>('');
```

#### 2. fetchBuyer() での初期値記録

```typescript
const fetchBuyer = async () => {
  const res = await api.get(`/api/buyers/${buyer_number}`);
  setBuyer(res.data);
  // 変更前の値として記録
  initialInquiryEmailPhoneRef.current = res.data.inquiry_email_phone || '';
  initialInquiryHearingRef.current = res.data.inquiry_hearing || '';
  // ...
};
```

#### 3. 条件付き必須判定ヘルパー関数

```typescript
// 初動担当の条件付き必須判定
// 受付日が2026-03-30以降 かつ
// (inquiry_email_phone が変更された OR inquiry_hearing が変更されかつ空でない)
const isInitialAssigneeConditionallyRequired = (
  currentData: any,
  changedFields: Record<string, any>
): boolean => {
  // 受付日チェック
  if (!currentData.reception_date) return false;
  const receptionDate = new Date(currentData.reception_date);
  if (receptionDate < new Date('2026-03-30')) return false;

  // inquiry_email_phone が変更されたか
  const emailPhoneChanged =
    'inquiry_email_phone' in changedFields &&
    changedFields.inquiry_email_phone !== initialInquiryEmailPhoneRef.current;

  // inquiry_hearing が変更されかつ空でないか
  const hearingValue = 'inquiry_hearing' in changedFields
    ? changedFields.inquiry_hearing
    : currentData.inquiry_hearing;
  const hearingChanged =
    'inquiry_hearing' in changedFields &&
    changedFields.inquiry_hearing !== initialInquiryHearingRef.current;
  const hearingFilledAndChanged =
    hearingChanged && hearingValue && String(hearingValue).trim();

  return emailPhoneChanged || Boolean(hearingFilledAndChanged);
};
```

#### 4. checkMissingFields() の拡張

既存の `checkMissingFields()` に条件付き必須チェックを追加する。`initial_assignee` の重複追加を防ぐため、既存の常時必須チェックと統合する。

```typescript
const checkMissingFields = (): string[] => {
  if (!buyer) return [];
  const missingKeys: string[] = [];

  // 初動担当：常時必須 OR 条件付き必須
  const allChangedFields = Object.values(sectionChangedFields)
    .reduce((acc, fields) => ({ ...acc, ...fields }), {});
  const conditionallyRequired = isInitialAssigneeConditionallyRequired(buyer, allChangedFields);
  
  if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
    // 常時必須チェック（既存）または条件付き必須チェック（新規）
    // どちらかが true なら追加（重複なし）
    missingKeys.push('initial_assignee');
  }
  // ... 既存の他フィールドチェック
};
```

> **注意**: 要件5.2の通り、`initial_assignee` を `missingKeys` に2回追加しないよう、既存の常時必須チェックと条件付き必須チェックを1つの `if` ブロックに統合する。

### NewBuyerPage の変更点

#### 条件付き必須バリデーション

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // 既存バリデーション
  if (!name) {
    setError('氏名は必須です');
    return;
  }

  // 初動担当の条件付き必須バリデーション（新規追加）
  const receptionDateObj = receptionDate ? new Date(receptionDate) : null;
  const isAfterCutoff = receptionDateObj && receptionDateObj >= new Date('2026-03-30');
  if (isAfterCutoff) {
    const emailPhoneFilled = inquiryEmailPhone && inquiryEmailPhone.trim();
    const hearingFilled = inquiryHearing && inquiryHearing.trim();
    if ((emailPhoneFilled || hearingFilled) && (!initialAssignee || !initialAssignee.trim())) {
      setError('初動担当は必須です（受付日2026/3/30以降かつ問合メール電話対応または問合時ヒアリングが入力されている場合）');
      return;
    }
  }

  // ... 既存の登録処理
};
```

---

## Data Models

### 関連するフィールド（buyersテーブル）

| フィールド名 | DBカラム | 型 | 説明 |
|------------|---------|-----|------|
| 初動担当 | `initial_assignee` | TEXT | 必須チェック対象 |
| 受付日 | `reception_date` | DATE | 条件判定に使用（`>= 2026-03-30`） |
| 【問合メール】電話対応 | `inquiry_email_phone` | TEXT | 変更トリガー1 |
| ●問合時ヒアリング | `inquiry_hearing` | TEXT | 変更トリガー2（空でない場合のみ） |

### フロントエンドの状態管理

| 状態 | 型 | 説明 |
|------|-----|------|
| `initialInquiryEmailPhoneRef` | `React.MutableRefObject<string>` | 変更前の `inquiry_email_phone` 値 |
| `initialInquiryHearingRef` | `React.MutableRefObject<string>` | 変更前の `inquiry_hearing` 値 |
| `missingRequiredFields` | `Set<string>` | 未入力の必須フィールドキーのセット（既存） |
| `sectionChangedFields` | `Record<string, Record<string, any>>` | セクション別の変更フィールド（既存） |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 受付日カットオフ前は条件付き必須が発動しない

*For any* 買主レコードで受付日が2026-03-30より前の場合、`inquiry_email_phone` または `inquiry_hearing` がどのように変更されても、`isInitialAssigneeConditionallyRequired` は `false` を返す

**Validates: Requirements 1.3, 4.3**

### Property 2: inquiry_email_phone 変更時の必須発動

*For any* 受付日が2026-03-30以降の買主レコードで、`inquiry_email_phone` の現在値が変更前の値と異なる場合、`initial_assignee` が空であれば `checkMissingFields` は `initial_assignee` を含む配列を返す

**Validates: Requirements 1.1, 2.1, 2.3**

### Property 3: inquiry_hearing 変更かつ空でない場合の必須発動

*For any* 受付日が2026-03-30以降の買主レコードで、`inquiry_hearing` の現在値が変更前の値と異なり、かつ変更後の値が空でない場合、`initial_assignee` が空であれば `checkMissingFields` は `initial_assignee` を含む配列を返す

**Validates: Requirements 1.2, 2.2, 2.4**

### Property 4: inquiry_hearing が空に変更された場合は発動しない

*For any* 受付日が2026-03-30以降の買主レコードで、`inquiry_hearing` が変更されたが変更後の値が空（空文字またはホワイトスペースのみ）の場合、`inquiry_email_phone` が変更されていなければ条件付き必須バリデーションは発動しない

**Validates: Requirements 1.2**

### Property 5: 変更なしの場合は発動しない

*For any* 買主レコードで `inquiry_email_phone` も `inquiry_hearing` も変更されていない場合（`sectionChangedFields` にこれらのキーが存在しない）、受付日に関わらず条件付き必須バリデーションは発動しない

**Validates: Requirements 1.4, 2.3, 2.4**

### Property 6: initial_assignee の重複追加なし

*For any* 買主レコードで `checkMissingFields` を呼び出した場合、返される配列に `initial_assignee` の表示名（「初動担当」）が2回以上含まれることはない

**Validates: Requirements 5.2**

### Property 7: 新規登録画面での条件付き必須

*For any* 新規登録フォームで受付日が2026-03-30以降かつ `inquiry_email_phone` または `inquiry_hearing` に値が入力されており、`initial_assignee` が空の場合、`handleSubmit` はエラーを設定して登録を阻止する

**Validates: Requirements 4.1, 4.2**

### Property 8: 新規登録画面でのカットオフ前スキップ

*For any* 新規登録フォームで受付日が2026-03-30より前の場合、`inquiry_email_phone` や `inquiry_hearing` の入力状態に関わらず、初動担当の条件付き必須バリデーションは発動しない

**Validates: Requirements 4.3**

### Property 9: 既存の必須フィールドバリデーションの保護

*For any* 買主レコードで `checkMissingFields` を呼び出した場合、`inquiry_source`・`latest_status`・`distribution_type` 等の既存必須フィールドのバリデーション結果は、今回の変更前と同一である

**Validates: Requirements 5.1, 5.3**

---

## Error Handling

### BuyerDetailPage

| エラーケース | 処理 |
|------------|------|
| 保存時に `initial_assignee` が空で条件を満たす | `ValidationWarningDialog` を表示し、「初動担当」を未入力フィールドとして一覧表示 |
| `fetchBuyer` 失敗 | 既存のエラーハンドリングに従う（ref の初期化は行われない） |
| `reception_date` が null/undefined | 条件付き必須は発動しない（`false` を返す） |

### NewBuyerPage

| エラーケース | 処理 |
|------------|------|
| 条件を満たす状態で登録ボタン押下 | `setError()` でエラーメッセージを表示し、`return` で登録を阻止 |
| `reception_date` が空 | 条件付き必須は発動しない |

### エンコーディング保護

日本語を含む `.tsx` ファイルの編集は、Pythonスクリプトを使用してUTF-8エンコーディングで書き込む。`strReplace` ツールによる直接編集は行わない。

---

## Testing Strategy

### ユニットテスト

以下の関数・ロジックに対してユニットテストを作成する：

1. **`isInitialAssigneeConditionallyRequired` ヘルパー関数**
   - 受付日が2026-03-30より前 → `false`
   - 受付日が2026-03-30以降 + `inquiry_email_phone` 変更あり → `true`
   - 受付日が2026-03-30以降 + `inquiry_hearing` 変更あり・空でない → `true`
   - 受付日が2026-03-30以降 + `inquiry_hearing` 変更あり・空 → `false`
   - 受付日が2026-03-30以降 + 変更なし → `false`

2. **`checkMissingFields` の拡張部分**
   - `initial_assignee` が重複して追加されないこと
   - 既存の必須フィールドチェックが壊れていないこと

3. **NewBuyerPage のバリデーションロジック**
   - 条件を満たす場合にエラーが設定されること
   - 条件を満たさない場合にエラーが設定されないこと

### プロパティベーステスト

プロパティベーステストには **fast-check**（TypeScript対応）を使用する。各テストは最低100回のイテレーションで実行する。

各テストには以下のタグコメントを付与する：
`// Feature: buyer-initial-assignee-required, Property {N}: {property_text}`

#### Property 1 のテスト

```typescript
// Feature: buyer-initial-assignee-required, Property 1: 受付日カットオフ前は条件付き必須が発動しない
it('受付日が2026-03-30より前の場合、条件付き必須は発動しない', () => {
  fc.assert(
    fc.property(
      fc.date({ min: new Date('2000-01-01'), max: new Date('2026-03-29') }),
      fc.string(),
      fc.string(),
      (date, emailPhone, hearing) => {
        const result = isInitialAssigneeConditionallyRequired(
          { reception_date: date.toISOString().split('T')[0] },
          { inquiry_email_phone: emailPhone, inquiry_hearing: hearing }
        );
        return result === false;
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 2 のテスト

```typescript
// Feature: buyer-initial-assignee-required, Property 2: inquiry_email_phone 変更時の必須発動
it('受付日2026-03-30以降でinquiry_email_phoneが変更された場合、必須が発動する', () => {
  fc.assert(
    fc.property(
      fc.date({ min: new Date('2026-03-30'), max: new Date('2030-12-31') }),
      fc.string({ minLength: 1 }),
      fc.string({ minLength: 1 }),
      (date, before, after) => {
        fc.pre(before !== after);
        const result = isInitialAssigneeConditionallyRequired(
          { reception_date: date.toISOString().split('T')[0] },
          { inquiry_email_phone: after },
          before // initialRef
        );
        return result === true;
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 3 のテスト

```typescript
// Feature: buyer-initial-assignee-required, Property 3: inquiry_hearing 変更かつ空でない場合の必須発動
it('受付日2026-03-30以降でinquiry_hearingが変更されかつ空でない場合、必須が発動する', () => {
  fc.assert(
    fc.property(
      fc.date({ min: new Date('2026-03-30'), max: new Date('2030-12-31') }),
      fc.string(),
      fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
      (date, before, after) => {
        fc.pre(before !== after);
        const result = isInitialAssigneeConditionallyRequired(
          { reception_date: date.toISOString().split('T')[0] },
          { inquiry_hearing: after },
          undefined, // emailPhone ref
          before // hearing ref
        );
        return result === true;
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 6 のテスト（重複なし）

```typescript
// Feature: buyer-initial-assignee-required, Property 6: initial_assignee の重複追加なし
it('checkMissingFields の結果に initial_assignee が重複して含まれない', () => {
  fc.assert(
    fc.property(
      fc.record({
        reception_date: fc.constant('2026-04-01'),
        initial_assignee: fc.constant(''),
        inquiry_email_phone: fc.string(),
        inquiry_hearing: fc.string(),
        inquiry_source: fc.string(),
        distribution_type: fc.string(),
        broker_inquiry: fc.string(),
        latest_status: fc.string(),
      }),
      (buyerData) => {
        const missing = simulateCheckMissingFields(buyerData);
        const count = missing.filter(k => k === 'initial_assignee').length;
        return count <= 1;
      }
    ),
    { numRuns: 100 }
  );
});
```

#### Property 9 のテスト（既存フィールド保護）

```typescript
// Feature: buyer-initial-assignee-required, Property 9: 既存の必須フィールドバリデーションの保護
it('既存の必須フィールドのバリデーション結果が変わらない', () => {
  fc.assert(
    fc.property(
      fc.record({
        reception_date: fc.constant('2026-04-01'),
        initial_assignee: fc.constant('Y'),
        inquiry_source: fc.option(fc.string({ minLength: 1 })),
        distribution_type: fc.option(fc.string({ minLength: 1 })),
        latest_status: fc.option(fc.string({ minLength: 1 })),
        broker_inquiry: fc.string(),
        inquiry_email_phone: fc.string(),
        inquiry_hearing: fc.string(),
      }),
      (buyerData) => {
        const missing = simulateCheckMissingFields(buyerData);
        // inquiry_sourceが空でbroker_inquiryが「業者問合せ」でない場合は必須
        if (!buyerData.inquiry_source && buyerData.broker_inquiry !== '業者問合せ') {
          return missing.includes('inquiry_source');
        }
        // distribution_typeが空なら必須
        if (!buyerData.distribution_type) {
          return missing.includes('distribution_type');
        }
        return true;
      }
    ),
    { numRuns: 100 }
  );
});
```

### 統合テスト（手動確認）

- 買主詳細画面で `inquiry_email_phone` を変更 → 保存時に「初動担当」が ValidationWarningDialog に表示されること
- 買主詳細画面で `inquiry_hearing` を変更（空でない値）→ 保存時に「初動担当」が ValidationWarningDialog に表示されること
- 受付日が2026-03-29以前の買主で同様の変更 → バリデーションが発動しないこと
- 新規登録画面で条件を満たす入力 → 登録ボタン押下時にエラーメッセージが表示されること
- 既存の必須フィールド（`inquiry_source`、`distribution_type` 等）のバリデーションが引き続き正常に動作すること
