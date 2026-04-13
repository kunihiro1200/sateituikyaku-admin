# buyer-desired-conditions-validation-bug バグ修正デザイン

## Overview

`BuyerDesiredConditionsPage.tsx` の `handleSaveAll` 関数において、`pendingChanges` に複数フィールドの変更が蓄積されている場合、各フィールドを**個別に**バリデーションしているため、他の `pendingChanges` が考慮されない問題を修正する。

修正方針は、`handleSaveAll` 専用のバリデーションとして `{ ...buyer, ...pendingChanges }` を使って全変更を一括適用した仮想状態でチェックするロジックに置き換える。既存の `checkDistributionRequiredFields` 関数は `handleInlineFieldSave` でも使用されているため変更しない。

## Glossary

- **Bug_Condition (C)**: `pendingChanges` に複数フィールドが含まれており、かつ配信メールが「要」の場合に、個別バリデーションが他の `pendingChanges` を無視して誤エラーを発生させる条件
- **Property (P)**: `handleSaveAll` が `{ ...buyer, ...pendingChanges }` の仮想状態で全必須フィールドを確認し、全て揃っていれば保存を実行するという期待動作
- **Preservation**: `handleInlineFieldSave` の1フィールド単位バリデーション、および配信メール「要」時の必須チェック自体は変更しない
- **handleSaveAll**: `BuyerDesiredConditionsPage.tsx` 内の保存ボタン押下時に `pendingChanges` を一括保存する関数
- **pendingChanges**: ユーザーが編集したが未保存のフィールド変更を蓄積するオブジェクト（`Record<string, any>`）
- **checkDistributionRequiredFields**: 1フィールド単位で配信メール「要」時の必須チェックを行う既存関数（`handleInlineFieldSave` で使用）
- **distribution_type**: 配信メールの設定値。「要」の場合に希望条件の必須バリデーションが発動する

## Bug Details

### Bug Condition

`handleSaveAll` 内のバリデーションループが `pendingChanges` の各エントリーを個別に `checkDistributionRequiredFields(fieldName, newValue)` に渡している。この関数は `{ ...buyer, [fieldName]: newValue }` という**1フィールドのみ**を適用した仮想状態でチェックするため、同じ `pendingChanges` 内の他フィールドの変更が無視される。

**Formal Specification:**
```
FUNCTION isBugCondition(pendingChanges, buyer)
  INPUT: pendingChanges of type Record<string, any>
         buyer of type Buyer
  OUTPUT: boolean

  RETURN Object.keys(pendingChanges).length > 1
         AND String(buyer.distribution_type || '').trim() === '要'
         AND EXISTS fieldName IN pendingChanges WHERE
               checkDistributionRequiredFields(fieldName, pendingChanges[fieldName])
               considers only { ...buyer, [fieldName]: pendingChanges[fieldName] }
               ignoring other entries in pendingChanges
END FUNCTION
```

### Examples

- **例1（バグ発現）**: `pendingChanges = { desired_area: '㊶別府', price_range_land: '3000万円台' }` で `distribution_type = '要'`、`desired_property_type = '土地'` の場合 → `desired_area` のチェック時に `price_range_land` が考慮されず「価格帯（土地）は必須です」エラーが発生して保存不可
- **例2（バグ発現）**: `pendingChanges = { desired_property_type: '戸建て', price_range_house: '3000万円台' }` で `distribution_type = '要'`、`desired_area` が既存値あり → `desired_property_type` のチェック時に `price_range_house` が考慮されず「価格帯（戸建）は必須です」エラーが発生
- **例3（正常動作）**: `pendingChanges = { desired_area: '㊶別府' }` の1フィールドのみ → 個別チェックでも問題なし
- **エッジケース**: `pendingChanges = { distribution_type: '不要' }` → 配信メールが「要」でなくなるため、バリデーション自体がスキップされる

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `handleInlineFieldSave` から個別フィールドを直接保存する際は、引き続き `checkDistributionRequiredFields` を使用した1フィールド単位のバリデーションを行う
- 配信メールが「要」以外（「不要」や未設定）の場合は、バリデーションなしで保存処理を実行する
- `pendingChanges` に1フィールドのみが含まれており、かつ必須フィールドが未入力の場合は、バリデーションエラーを表示して保存を中断する
- 配信メールが「要」で `desired_area` が未入力の場合は「エリアは必須です」エラーを表示する
- 配信メールが「要」で希望種別が「土地」かつ `price_range_land` が未入力の場合は「価格帯（土地）は必須です」エラーを表示する

**Scope:**
`handleSaveAll` のバリデーションロジックのみを変更する。`checkDistributionRequiredFields` 関数自体、`handleInlineFieldSave`、その他の保存・表示ロジックは一切変更しない。

## Hypothesized Root Cause

バグの根本原因は `handleSaveAll` 内のバリデーションループの設計にある：

1. **個別ループによる文脈欠落**: `for (const [fieldName, newValue] of Object.entries(pendingChanges))` で各フィールドを個別にチェックしているため、ループの各イテレーションで他の `pendingChanges` エントリーが考慮されない

2. **checkDistributionRequiredFields の設計前提**: この関数は `handleInlineFieldSave`（1フィールドずつ保存）向けに設計されており、`{ ...buyer, [fieldName]: newValue }` という1フィールド適用の仮想状態を前提としている。`handleSaveAll`（複数フィールド一括保存）での使用には適していない

3. **仮想状態の不完全性**: `handleSaveAll` では `pendingChanges` 全体を `buyer` に適用した `{ ...buyer, ...pendingChanges }` が正しい仮想状態だが、現在のコードはこれを構築していない

## Correctness Properties

Property 1: Bug Condition - 複数フィールド一括変更時の正しいバリデーション

_For any_ `pendingChanges` に複数フィールドが含まれており、かつ `{ ...buyer, ...pendingChanges }` の仮想状態で全必須フィールド（エリア・希望種別・希望種別に応じた価格帯）が揃っている場合、修正後の `handleSaveAll` SHALL バリデーションエラーを表示せず保存処理を実行する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 必須フィールド未入力時のエラー継続

_For any_ `pendingChanges` において、`{ ...buyer, ...pendingChanges }` の仮想状態で配信メールが「要」かつ必須フィールド（エリア・希望種別・価格帯）のいずれかが未入力の場合、修正後の `handleSaveAll` SHALL バリデーションエラーを表示して保存を中断する（修正前と同じ動作）。

**Validates: Requirements 3.1, 3.4, 3.5**

Property 3: Preservation - 配信メール「要」以外の場合はバリデーションスキップ

_For any_ `pendingChanges` において、`{ ...buyer, ...pendingChanges }` の仮想状態で `distribution_type` が「要」でない場合、修正後の `handleSaveAll` SHALL バリデーションチェックを行わず保存処理を実行する。

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx`

**Function**: `handleSaveAll`

**Specific Changes**:

1. **既存のバリデーションループを削除**: `for (const [fieldName, newValue] of Object.entries(pendingChanges))` のループ全体を削除する

2. **一括仮想状態の構築**: `const mergedBuyer = { ...buyer, ...pendingChanges }` で全 `pendingChanges` を適用した仮想状態を構築する

3. **一括バリデーションロジックの追加**: `mergedBuyer` を使って `distribution_type` が「要」の場合のみ必須チェックを実行する

4. **checkDistributionRequiredFields は変更しない**: `handleInlineFieldSave` で引き続き使用されるため、この関数は現状維持

**修正前コード:**
```typescript
// 配信メール「要」時の必須バリデーション
for (const [fieldName, newValue] of Object.entries(pendingChanges)) {
  const validationError = checkDistributionRequiredFields(fieldName, newValue);
  if (validationError) {
    setSnackbar({ open: true, message: validationError, severity: 'error' });
    return;
  }
}
```

**修正後コード:**
```typescript
// pendingChanges全体を一括適用した仮想状態でバリデーション
const mergedBuyer = { ...buyer, ...pendingChanges };
const distributionType = String(mergedBuyer.distribution_type || '').trim();
if (distributionType === '要') {
  const desiredArea = String(mergedBuyer.desired_area || '').trim();
  const desiredPropertyType = String(mergedBuyer.desired_property_type || '').trim();
  const priceRangeHouse = String(mergedBuyer.price_range_house || '').trim();
  const priceRangeApartment = String(mergedBuyer.price_range_apartment || '').trim();
  const priceRangeLand = String(mergedBuyer.price_range_land || '').trim();

  const missing: string[] = [];
  if (!desiredArea) missing.push('エリア');
  if (!desiredPropertyType) missing.push('希望種別');

  const needsHouse = desiredPropertyType.includes('戸建て');
  const needsApartment = desiredPropertyType.includes('マンション');
  const needsLand = desiredPropertyType.includes('土地');
  const hasAnyPriceRange = priceRangeHouse || priceRangeApartment || priceRangeLand;

  if (needsHouse && !priceRangeHouse) missing.push('価格帯（戸建）');
  if (needsApartment && !priceRangeApartment) missing.push('価格帯（マンション）');
  if (needsLand && !priceRangeLand) missing.push('価格帯（土地）');
  if (!needsHouse && !needsApartment && !needsLand && !hasAnyPriceRange) {
    missing.push('価格帯（戸建・マンション・土地のいずれか）');
  }

  if (missing.length > 0) {
    setSnackbar({ open: true, message: `配信メールが「要」の場合、${missing.join('・')}は必須です。希望条件を入力してください。`, severity: 'error' });
    return;
  }
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず未修正コードでバグを再現するテストを書いて根本原因を確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因（個別ループによる他フィールド無視）を確認する。

**Test Plan**: `handleSaveAll` のバリデーション部分を単体でテストし、複数フィールドが `pendingChanges` にある場合に誤エラーが発生することを確認する。未修正コードで実行して失敗を観察する。

**Test Cases**:
1. **複数フィールド一括変更テスト**: `pendingChanges = { desired_area: '㊶別府', price_range_land: '3000万円台' }`、`distribution_type = '要'`、`desired_property_type = '土地'` → 未修正コードでは「価格帯（土地）は必須です」エラーが発生する（will fail on unfixed code）
2. **希望種別と価格帯の同時変更テスト**: `pendingChanges = { desired_property_type: '戸建て', price_range_house: '3000万円台' }` → 未修正コードでは「価格帯（戸建）は必須です」エラーが発生する（will fail on unfixed code）
3. **3フィールド同時変更テスト**: `pendingChanges = { desired_area: '㊶別府', desired_property_type: '土地', price_range_land: '3000万円台' }` → 未修正コードでは最初のフィールドチェック時に他フィールドが無視されてエラーが発生する（will fail on unfixed code）
4. **1フィールドのみテスト**: `pendingChanges = { desired_area: '' }` → 未修正・修正後ともにエラーが発生する（エリア未入力）

**Expected Counterexamples**:
- 全必須フィールドが `pendingChanges` に含まれているにもかかわらず、個別チェック時に他フィールドが無視されてエラーが発生する
- 原因: `checkDistributionRequiredFields` が `{ ...buyer, [fieldName]: newValue }` の1フィールド仮想状態のみを参照している

### Fix Checking

**Goal**: 修正後のコードで、全必須フィールドが揃っている場合にバリデーションエラーが発生しないことを確認する。

**Pseudocode:**
```
FOR ALL pendingChanges WHERE isBugCondition(pendingChanges, buyer) DO
  result := handleSaveAll_fixed(pendingChanges, buyer)
  ASSERT result.validationError === null
  ASSERT result.saveExecuted === true
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、必須フィールドが未入力の場合は引き続きエラーが発生することを確認する。

**Pseudocode:**
```
FOR ALL pendingChanges WHERE NOT isBugCondition(pendingChanges, buyer) DO
  ASSERT handleSaveAll_original(pendingChanges, buyer).error
       = handleSaveAll_fixed(pendingChanges, buyer).error
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な `pendingChanges` の組み合わせを自動生成できる
- 手動テストでは見落としやすいエッジケース（フィールドの組み合わせ）を網羅できる
- 「必須フィールドが欠けている場合は常にエラー」という不変条件を強力に保証できる

**Test Cases**:
1. **エリア未入力の保持**: `pendingChanges = { desired_area: '' }` で `distribution_type = '要'` → 修正後もエラーが発生することを確認
2. **価格帯未入力の保持**: `pendingChanges = { desired_property_type: '土地' }` で `price_range_land` が未入力 → 修正後もエラーが発生することを確認
3. **配信メール「不要」時のスキップ保持**: `distribution_type = '不要'` → 修正後もバリデーションなしで保存が実行されることを確認
4. **handleInlineFieldSave の動作保持**: `handleInlineFieldSave` が `checkDistributionRequiredFields` を引き続き使用することを確認

### Unit Tests

- 複数フィールドが `pendingChanges` にある場合の一括バリデーション（修正後）
- 1フィールドのみの場合の動作（修正前後で同じ）
- `distribution_type` が「要」以外の場合のバリデーションスキップ
- 希望種別に応じた価格帯チェック（戸建て・マンション・土地・未設定）

### Property-Based Tests

- 任意の複数フィールド `pendingChanges` で、`{ ...buyer, ...pendingChanges }` の仮想状態で全必須フィールドが揃っていれば保存成功することを検証（Property 1）
- 任意の `pendingChanges` で、仮想状態で必須フィールドが欠けている場合は常にエラーが発生することを検証（Property 2）
- 任意の `pendingChanges` で、`distribution_type` が「要」でない場合は常にバリデーションスキップされることを検証（Property 3）

### Integration Tests

- 希望条件ページで複数フィールドを変更してから保存ボタンを押した場合の正常保存フロー
- `handleInlineFieldSave` による個別フィールド保存が引き続き正常動作することの確認
- 配信メール「要」設定の買主で、全必須フィールドを一括変更して保存できることの確認
