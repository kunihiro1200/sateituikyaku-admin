# 設計ドキュメント

## 概要

買主詳細ページ（BuyerDetailPage.tsx）において、「持家ヒアリング結果」フィールドを条件付き必須項目として実装する機能の設計書。

受付日が2026年3月30日以降、かつ「問合時持家ヒアリング」フィールドが空白でない場合に、「持家ヒアリング結果」フィールドの入力を必須とする。

---

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                    BuyerDetailPage.tsx                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  条件付き必須バリデーションロジック                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ isHomeHearingResultRequired(buyer)              │  │  │
│  │  │  - 受付日 >= 2026-03-30                         │  │  │
│  │  │  - 問合時持家ヒアリング != null/空白/不要/未    │  │  │
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
│  │  │ 問合時持家ヒアリング（スタッフ選択ボタン）      │  │  │
│  │  │  - onChange → 必須状態を再計算                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 持家ヒアリング結果（4択ボタン）                 │  │  │
│  │  │  - 条件付き表示（問合時持家ヒアリング依存）     │  │  │
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
   isHomeHearingResultRequired(buyer) 判定
   ↓
   missingRequiredFields 初期化

2. 問合時持家ヒアリング変更
   ユーザー入力 → buyer state 更新
   ↓
   isHomeHearingResultRequired(buyer) 再判定
   ↓
   missingRequiredFields 更新
   ↓
   UI ハイライト更新

3. 持家ヒアリング結果変更
   ユーザー入力 → buyer state 更新
   ↓
   missingRequiredFields 更新
   ↓
   UI ハイライト解除

4. 保存ボタン押下
   checkMissingFields() 実行
   ↓
   未入力必須フィールドあり？
   ├─ Yes → ValidationWarningDialog 表示
   └─ No → 保存処理実行
```

---

## コンポーネントと
インターフェース

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
- `isHomeHearingResultRequired(data: any): boolean` - 持家ヒアリング結果の必須判定
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
  email: string;
  reception_date: string | null;  // YYYY-MM-DD形式
  owned_home_hearing_inquiry: string | null;  // スタッフイニシャル or "不要" or "未"
  owned_home_hearing_result: string | null;  // "持家（マンション）" | "持家（戸建）" | "賃貸" | "他不明"
  inquiry_source: string | null;
  latest_status: string | null;
  distribution_type: string | null;
  // ... その他のフィールド
}
```

### フィールド定義

| フィールド名 | データベースカラム名 | 型 | 説明 |
|------------|-------------------|-----|------|
| 受付日 | `reception_date` | DATE | 買主からの問い合わせを受け付けた日付 |
| 問合時持家ヒアリング | `owned_home_hearing_inquiry` | TEXT | ヒアリング実施者のイニシャル（Y、K等）または「不要」「未」 |
| 持家ヒアリング結果 | `owned_home_hearing_result` | TEXT | 「持家（マンション）」「持家（戸建）」「賃貸」「他不明」の4択 |

---

## Low-Level Design

### 1. 条件付き必須判定ロジック

#### isHomeHearingResultRequired 関数

**現在の実装（要修正）**:
```typescript
// ❌ 受付日の条件が含まれていない
const isHomeHearingResultRequired = (data: any): boolean => {
  if (!data.owned_home_hearing_inquiry) return false;
  const trimmed = String(data.owned_home_hearing_inquiry).trim();
  if (trimmed.length === 0) return false;
  if (trimmed === '不要' || trimmed === '未') return false;
  return true;
};
```

**修正後の実装**:
```typescript
// ✅ 受付日の条件を追加
const isHomeHearingResultRequired = (data: any): boolean => {
  // 条件1: 受付日が2026-03-30以降であること
  if (!data.reception_date) return false;
  const receptionDate = new Date(data.reception_date);
  const thresholdDate = new Date('2026-03-30');
  if (receptionDate < thresholdDate) return false;

  // 条件2: 問合時持家ヒアリングが空白でないこと
  if (!data.owned_home_hearing_inquiry) return false;
  const trimmed = String(data.owned_home_hearing_inquiry).trim();
  if (trimmed.length === 0) return false;
  
  // 条件3: 「不要」または「未」の場合は必須扱いにしない
  if (trimmed === '不要' || trimmed === '未') return false;

  return true;
};
```

**ロジック説明**:
1. `reception_date` が `null` または `undefined` の場合 → 必須でない
2. `reception_date` が `2026-03-30` より前の場合 → 必須でない
3. `owned_home_hearing_inquiry` が `null`、`undefined`、空文字列、空白文字のみの場合 → 必須でない
4. `owned_home_hearing_inquiry` が「不要」または「未」の場合 → 必須でない
5. 上記全てを満たさない場合 → 必須

**条件式（スプレッドシート互換）**:
```
AND([受付日]>="2026/3/30", ISNOTBLANK([問合時持家ヒアリング]))
```

**ISNOTBLANK の実装**:
```typescript
const isNotBlank = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  const trimmed = String(value).trim();
  return trimmed.length > 0;
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

  // 持家ヒアリング結果：条件付き必須（修正済み）
  if (isHomeHearingResultRequired(buyer) && 
      (!buyer.owned_home_hearing_result || !String(buyer.owned_home_hearing_result).trim())) {
    missingKeys.push('owned_home_hearing_result');
  }

  // ハイライト用 state を更新
  setMissingRequiredFields(new Set(missingKeys));

  return missingKeys.map(k => REQUIRED_FIELD_LABEL_MAP[k] || k);
};
```

**重要ポイント**:
- `isHomeHearingResultRequired(buyer)` が `true` の場合のみ、`owned_home_hearing_result` の入力をチェック
- 既存の必須チェックロジックを維持（重複追加なし）
- `missingRequiredFields` を更新してUIハイライトを制御

---

### 3. 問合時持家ヒアリング変更時の動的バリデーション

**実装箇所**: 問合時持家ヒアリングのボタン選択時

```typescript
// 問合時持家ヒアリングのボタンクリックハンドラー
const handleOwnedHomeHearingInquiryChange = (newValue: string) => {
  setBuyer(prev => {
    if (!prev) return prev;
    const updated = { ...prev, owned_home_hearing_inquiry: newValue };
    
    // 持家ヒアリング結果の必須状態を再計算
    setMissingRequiredFields(prevMissing => {
      const next = new Set(prevMissing);
      
      if (isHomeHearingResultRequired(updated)) {
        // 必須条件を満たす場合、持家ヒアリング結果が空なら追加
        if (!updated.owned_home_hearing_result || !String(updated.owned_home_hearing_result).trim()) {
          next.add('owned_home_hearing_result');
        }
      } else {
        // 必須条件を満たさない場合、削除
        next.delete('owned_home_hearing_result');
      }
      
      return next;
    });
    
    return updated;
  });
  
  // セクション変更フィールドに追加
  handleFieldChange(sectionTitle, 'owned_home_hearing_inquiry', newValue);
};
```

**動作フロー**:
1. ユーザーがスタッフイニシャルボタンをクリック
2. `buyer.owned_home_hearing_inquiry` を更新
3. `isHomeHearingResultRequired(updated)` で必須状態を再判定
4. 必須条件を満たす場合:
   - `owned_home_hearing_result` が空なら `missingRequiredFields` に追加
5. 必須条件を満たさない場合:
   - `missingRequiredFields` から削除

---

### 4. 持家ヒアリング結果変更時の動的バリデーション

**実装箇所**: 持家ヒアリング結果の4択ボタン選択時

```typescript
// 持家ヒアリング結果のボタンクリックハンドラー
const handleOwnedHomeHearingResultChange = (newValue: string) => {
  setBuyer(prev => {
    if (!prev) return prev;
    const updated = { ...prev, owned_home_hearing_result: newValue };
    
    // 必須状態を再計算
    setMissingRequiredFields(prevMissing => {
      const next = new Set(prevMissing);
      
      if (newValue && String(newValue).trim()) {
        // 値が入力された場合、必須フィールドから削除
        next.delete('owned_home_hearing_result');
      } else if (isHomeHearingResultRequired(prev)) {
        // 値が空で必須条件を満たす場合、追加
        next.add('owned_home_hearing_result');
      } else {
        // 必須条件を満たさない場合、削除
        next.delete('owned_home_hearing_result');
      }
      
      return next;
    });
    
    return updated;
  });
  
  // セクション変更フィールドに追加
  handleFieldChange(sectionTitle, 'owned_home_hearing_result', newValue);
};
```

**動作フロー**:
1. ユーザーが4択ボタンをクリック
2. `buyer.owned_home_hearing_result` を更新
3. 値が入力された場合:
   - `missingRequiredFields` から削除（ハイライト解除）
4. 値が空で必須条件を満たす場合:
   - `missingRequiredFields` に追加（ハイライト表示）
5. 必須条件を満たさない場合:
   - `missingRequiredFields` から削除

---

### 5. 初期表示時の必須フィールドチェック

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
    
    // 持家ヒアリング結果：条件付き必須
    if (isHomeHearingResultRequired(res.data) && 
        (!res.data.owned_home_hearing_result || !String(res.data.owned_home_hearing_result).trim())) {
      initialMissing.push('owned_home_hearing_result');
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
3. `isHomeHearingResultRequired(res.data)` で必須状態を判定
4. 必須条件を満たし、かつ `owned_home_hearing_result` が空の場合:
   - `initialMissing` に追加
5. `missingRequiredFields` を初期化
6. UI に赤枠ハイライトを表示

---

### 6. UI ハイライト表示

**実装箇所**: 持家ヒアリング結果の4択ボタン

```typescript
// 持家ヒアリング結果フィールドの表示
if (field.key === 'owned_home_hearing_result') {
  if (!buyer.owned_home_hearing_inquiry) return null;  // 問合時持家ヒアリングが空なら非表示
  
  const RESULT_OPTIONS = ['持家（マンション）', '持家（戸建）', '賃貸', '他不明'];
  const isResultMissing = missingRequiredFields.has('owned_home_hearing_result');
  
  return (
    <Grid item xs={12} key={`${section.title}-${field.key}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ minWidth: 150 }}>
          {field.label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {RESULT_OPTIONS.map((option) => {
            const isSelected = buyer.owned_home_hearing_result === option;
            return (
              <Button
                key={option}
                variant={isSelected ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleOwnedHomeHearingResultChange(option)}
                sx={{
                  // 必須条件を満たしているが未入力の場合は赤枠
                  border: isResultMissing && !isSelected ? '2px solid red' : undefined,
                }}
              >
                {option}
              </Button>
            );
          })}
        </Box>
      </Box>
    </Grid>
  );
}
```

**ハイライト条件**:
- `missingRequiredFields.has('owned_home_hearing_result')` が `true` の場合
- 選択されていないボタンに赤枠（`border: '2px solid red'`）を表示

---

### 7. 条件付き表示ロジック

**実装箇所**: 持家ヒアリング結果フィールドの表示制御

```typescript
// 持家ヒアリング結果フィールドは「問合時持家ヒアリング」が「不要」または「未」の場合は非表示
if (field.key === 'owned_home_hearing_result') {
  const inquiry = buyer.owned_home_hearing_inquiry;
  
  // 問合時持家ヒアリングが空、「不要」、「未」の場合は非表示
  if (!inquiry || inquiry === '不要' || inquiry === '未') {
    return null;  // フィールドを非表示
  }
  
  // ... 4択ボタンの表示 ...
}
```

**表示条件**:
- `owned_home_hearing_inquiry` が空でない
- `owned_home_hearing_inquiry` が「不要」でない
- `owned_home_hearing_inquiry` が「未」でない
- 上記全てを満たす場合のみ表示

**非表示時の動作**:
- フィールドが非表示の場合、必須バリデーションも発動しない
- `isHomeHearingResultRequired()` が `false` を返すため

---

### 8. REQUIRED_FIELD_LABEL_MAP の更新

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
  owned_home_hearing_result: '持家ヒアリング結果',  // ✅ 既に定義済み
};
```

**確認事項**:
- `owned_home_hearing_result` は既に定義済み
- ValidationWarningDialog に正しい表示名が渡される

---

## エラーハンドリング

### 1. 日付比較エラー

**問題**: `reception_date` が不正な形式の場合、`new Date()` が `Invalid Date` を返す

**対策**:
```typescript
const isHomeHearingResultRequired = (data: any): boolean => {
  if (!data.reception_date) return false;
  
  try {
    const receptionDate = new Date(data.reception_date);
    if (isNaN(receptionDate.getTime())) {
      console.error('Invalid reception_date:', data.reception_date);
      return false;
    }
    
    const thresholdDate = new Date('2026-03-30');
    if (receptionDate < thresholdDate) return false;
  } catch (error) {
    console.error('Date comparison error:', error);
    return false;
  }
  
  // ... 残りのロジック ...
};
```

### 2. null/undefined チェック

**問題**: `buyer` が `null` の場合、`buyer.owned_home_hearing_inquiry` でエラー

**対策**:
```typescript
const checkMissingFields = (): string[] => {
  if (!buyer) return [];  // ✅ 早期リターン
  
  // ... 必須チェック ...
};
```

### 3. 文字列変換エラー

**問題**: `owned_home_hearing_inquiry` が `number` 型の場合、`trim()` でエラー

**対策**:
```typescript
const trimmed = String(data.owned_home_hearing_inquiry).trim();  // ✅ String() で変換
```

---

## テスト戦略

### 1. ユニットテスト

#### isHomeHearingResultRequired 関数のテスト

```typescript
describe('isHomeHearingResultRequired', () => {
  it('受付日が2026-03-30以降で問合時持家ヒアリングが空でない場合、trueを返す', () => {
    const buyer = {
      reception_date: '2026-03-30',
      owned_home_hearing_inquiry: 'Y',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(true);
  });

  it('受付日が2026-03-30より前の場合、falseを返す', () => {
    const buyer = {
      reception_date: '2026-03-29',
      owned_home_hearing_inquiry: 'Y',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(false);
  });

  it('問合時持家ヒアリングが空の場合、falseを返す', () => {
    const buyer = {
      reception_date: '2026-03-30',
      owned_home_hearing_inquiry: '',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(false);
  });

  it('問合時持家ヒアリングが「不要」の場合、falseを返す', () => {
    const buyer = {
      reception_date: '2026-03-30',
      owned_home_hearing_inquiry: '不要',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(false);
  });

  it('問合時持家ヒアリングが「未」の場合、falseを返す', () => {
    const buyer = {
      reception_date: '2026-03-30',
      owned_home_hearing_inquiry: '未',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(false);
  });

  it('受付日がnullの場合、falseを返す', () => {
    const buyer = {
      reception_date: null,
      owned_home_hearing_inquiry: 'Y',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(false);
  });

  it('問合時持家ヒアリングが空白文字のみの場合、falseを返す', () => {
    const buyer = {
      reception_date: '2026-03-30',
      owned_home_hearing_inquiry: '   ',
    };
    expect(isHomeHearingResultRequired(buyer)).toBe(false);
  });
});
```

### 2. 統合テスト

#### シナリオ1: 初期表示時のハイライト

**前提条件**:
- 受付日: 2026-04-01
- 問合時持家ヒアリング: Y
- 持家ヒアリング結果: 空

**期待結果**:
- 持家ヒアリング結果フィールドが赤枠でハイライト表示される

#### シナリオ2: 問合時持家ヒアリング変更時の動的バリデーション

**操作**:
1. 問合時持家ヒアリングを「Y」に変更
2. 持家ヒアリング結果が空のまま

**期待結果**:
- 持家ヒアリング結果フィールドが赤枠でハイライト表示される

#### シナリオ3: 持家ヒアリング結果入力時のハイライト解除

**操作**:
1. 持家ヒアリング結果を「持家（マンション）」に変更

**期待結果**:
- 持家ヒアリング結果フィールドの赤枠ハイライトが解除される

#### シナリオ4: 保存時のバリデーション

**操作**:
1. 受付日: 2026-04-01
2. 問合時持家ヒアリング: Y
3. 持家ヒアリング結果: 空
4. 保存ボタンをクリック

**期待結果**:
- ValidationWarningDialog が表示される
- 未入力必須フィールド一覧に「持家ヒアリング結果」が含まれる

#### シナリオ5: 条件付き表示

**操作**:
1. 問合時持家ヒアリングを「不要」に変更

**期待結果**:
- 持家ヒアリング結果フィールドが非表示になる
- 必須バリデーションが発動しない

### 3. エッジケーステスト

#### エッジケース1: 受付日が境界値（2026-03-30）

**テストケース**:
- 受付日: 2026-03-30
- 問合時持家ヒアリング: Y
- 持家ヒアリング結果: 空

**期待結果**: 必須バリデーションが発動する

#### エッジケース2: 受付日が境界値の前日（2026-03-29）

**テストケース**:
- 受付日: 2026-03-29
- 問合時持家ヒアリング: Y
- 持家ヒアリング結果: 空

**期待結果**: 必須バリデーションが発動しない

#### エッジケース3: 問合時持家ヒアリングが空白文字のみ

**テストケース**:
- 受付日: 2026-04-01
- 問合時持家ヒアリング: "   " (空白3文字)
- 持家ヒアリング結果: 空

**期待結果**: 必須バリデーションが発動しない

#### エッジケース4: 受付日が未来の日付

**テストケース**:
- 受付日: 2027-01-01
- 問合時持家ヒアリング: Y
- 持家ヒアリング結果: 空

**期待結果**: 必須バリデーションが発動する

---

## 実装手順

### Phase 1: isHomeHearingResultRequired 関数の修正

1. `isHomeHearingResultRequired` 関数に受付日の条件を追加
2. 日付比較ロジックを実装
3. エラーハンドリングを追加

### Phase 2: 動的バリデーションの実装

1. 問合時持家ヒアリング変更時のハンドラーを修正
2. 持家ヒアリング結果変更時のハンドラーを修正
3. `missingRequiredFields` の更新ロジックを実装

### Phase 3: 初期表示時のバリデーション

1. `fetchBuyer()` 関数内に初期チェックロジックを追加
2. `initialMissing` に `owned_home_hearing_result` を追加

### Phase 4: UI ハイライトの実装

1. 持家ヒアリング結果の4択ボタンに赤枠スタイルを追加
2. `isResultMissing` フラグを使用してハイライト制御

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
- `checkMissingFields()` 関数内で `owned_home_hearing_result` が重複して追加されないこと
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
AND([受付日]>="2026/3/30", ISNOTBLANK([問合時持家ヒアリング]))
```

**TypeScript実装**:
```typescript
reception_date >= "2026-03-30" && isNotBlank(owned_home_hearing_inquiry)
```

### 4. 「不要」「未」の扱い

**重要**: 「不要」「未」の場合は必須扱いにしないこと

**理由**:
- 「不要」= ヒアリング不要と判断された買主
- 「未」= ヒアリング未実施の買主
- これらの場合、持家ヒアリング結果フィールドは非表示になる

---

## まとめ

この設計書では、買主詳細ページにおける「持家ヒアリング結果」フィールドの条件付き必須バリデーション機能を実装するための詳細な設計を提供しました。

**主要な実装ポイント**:
1. `isHomeHearingResultRequired` 関数に受付日の条件を追加
2. 問合時持家ヒアリング変更時の動的バリデーション
3. 持家ヒアリング結果変更時の動的バリデーション
4. 初期表示時の必須フィールドチェック
5. UI ハイライト表示
6. 条件付き表示ロジック

**既存機能との共存**:
- 既存の必須バリデーションロジックを維持
- `checkMissingFields()` 関数に条件付き必須チェックを追加
- 重複追加を防止

**テスト戦略**:
- ユニットテスト: `isHomeHearingResultRequired` 関数
- 統合テスト: UI操作とバリデーション
- エッジケーステスト: 境界値と特殊ケース

この設計に基づいて実装することで、要件定義書に記載された全ての受け入れ基準を満たすことができます。
