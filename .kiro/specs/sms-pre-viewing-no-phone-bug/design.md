# SMS内覧前日ボタン（電話番号なし買主）バグ修正 Design

## Overview

`BuyerViewingResultPage.tsx` の内覧前日SMSボタン表示条件が `!buyer.email && buyer.phone_number` になっており、電話番号はあるがメールアドレスもある買主にはSMSボタンが表示されない。また、電話番号がない買主（買主番号: 7185）では条件を満たさずSMSボタンが一切表示されない。

修正方針は、SMSボタンの表示条件を `buyer.phone_number` のみに変更し、Eメールボタンは `buyer.email` のみで制御する。両方ある場合は両方表示する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `buyer.phone_number` が存在するにもかかわらず、SMSボタンが表示されない状態
- **Property (P)**: 期待される正しい動作 — `buyer.phone_number` が存在する場合、SMSボタンが表示される
- **Preservation**: 修正によって変えてはいけない既存動作 — Eメールボタンの表示条件、内覧前日判定ロジック、SMS履歴記録ロジック
- **isBugCondition**: `buyer.phone_number` が存在し、かつSMSボタンが表示されていない状態を識別する関数
- **isViewingPreDay**: 内覧日前日かどうかを判定する関数（`BuyerViewingResultPage.tsx` 内）
- **BuyerViewingResultPage**: 修正対象のページコンポーネント（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）

## Bug Details

### Bug Condition

SMSボタンの表示条件が `!buyer.email && buyer.phone_number` になっているため、電話番号があってもメールアドレスがある買主にはSMSボタンが表示されない。電話番号がない買主（買主番号: 7185）では条件を満たさずSMSボタンが表示されない。

**Formal Specification:**
```
FUNCTION isBugCondition(buyer)
  INPUT: buyer of type Buyer
  OUTPUT: boolean

  RETURN buyer.phone_number IS NOT NULL
         AND buyer.phone_number != ''
         AND smsButtonIsNotDisplayed(buyer)
END FUNCTION
```

### Examples

- 買主番号7185（電話番号なし・メールあり）: 内覧前日でもSMSボタンが表示されない → **バグ**
- 電話番号あり・メールあり: `!buyer.email` が false のためSMSボタンが表示されない → **バグ**
- 電話番号あり・メールなし: `!buyer.email && buyer.phone_number` が true のためSMSボタンが表示される → 正常（ただし条件が不適切）
- 電話番号なし・メールなし: SMSボタンが表示されない → 正しい動作（送信手段がない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- メールアドレスが登録済みの買主には引き続きEメールボタンを表示する（`buyer.email` のみで制御）
- 内覧日前日でない場合は引き続きボタン群を表示しない（`isViewingPreDay()` の条件は変更しない）
- `broker_inquiry === '業者問合せ'` の場合は引き続きボタン群を表示しない
- `notification_sender` が入力済みの場合は引き続きボタン群を表示しない
- SMS送信時の履歴記録APIコール（`/api/buyers/:buyerNumber/sms-history`）は変更しない

**Scope:**
SMSボタンの表示条件（`!buyer.email && buyer.phone_number` → `buyer.phone_number`）のみを変更する。それ以外の全ての表示ロジック・送信ロジックは変更しない。

## Hypothesized Root Cause

1. **誤った排他条件**: `!buyer.email && buyer.phone_number` という条件は「メールがない場合のみSMSを表示」という意図で書かれたと推測されるが、要件は「電話番号があればSMSを表示」であるべき
   - 正しい条件: `buyer.phone_number`（電話番号の有無のみで判定）
   - Eメールボタンは別途 `buyer.email` で制御されているため、両方表示は自然に実現される

2. **コメントの誤り**: コード上のコメントが「メアドがない場合（または電話番号がある場合）はSMSボタン」となっており、実装意図が曖昧だった

## Correctness Properties

Property 1: Bug Condition - 電話番号があればSMSボタンが表示される

_For any_ buyer where `buyer.phone_number` is non-empty (isBugCondition returns true), the fixed `BuyerViewingResultPage` SHALL display the SMS button regardless of whether `buyer.email` is set.

**Validates: Requirements 2.2, 2.3**

Property 2: Preservation - 電話番号がない場合はSMSボタンが表示されない

_For any_ buyer where `buyer.phone_number` is empty or null (isBugCondition returns false), the fixed component SHALL NOT display the SMS button, preserving the behavior that SMS cannot be sent without a phone number.

**Validates: Requirements 2.1, 2.4, 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

**Function**: `BuyerViewingResultPage` コンポーネント内のSMSボタン表示条件

**Specific Changes:**

1. **SMSボタン表示条件の変更**:
   - 変更前: `{!buyer.email && buyer.phone_number && (() => {`
   - 変更後: `{buyer.phone_number && (() => {`

2. **コメントの修正**:
   - 変更前: `{/* メアドがない場合（または電話番号がある場合）はSMSボタン */}`
   - 変更後: `{/* 電話番号がある場合はSMSボタン */}`

変更箇所は1行のみ。Eメールボタンの表示条件（`buyer.email`）は変更しない。

## Testing Strategy

### Validation Approach

未修正コードでバグを再現するテストを先に書き、修正後に全テストがパスすることを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `buyer.phone_number` があるにもかかわらずSMSボタンが表示されないことを確認する。

**Test Plan**: 表示条件ロジックを抽出した関数に対してテストを書き、未修正コードで失敗することを確認する。

**Test Cases:**
1. **電話番号あり・メールあり**: `!buyer.email && buyer.phone_number` が false → SMSボタン非表示（未修正コードで失敗）
2. **電話番号あり・メールなし**: `!buyer.email && buyer.phone_number` が true → SMSボタン表示（未修正コードで通過）
3. **電話番号なし・メールあり**: SMSボタン非表示（未修正・修正後ともに正しい）
4. **電話番号なし・メールなし**: SMSボタン非表示（未修正・修正後ともに正しい）

**Expected Counterexamples:**
- 電話番号あり・メールありの買主でSMSボタンが表示されない
- 原因: `!buyer.email` が false になるため条件全体が false になる

### Fix Checking

**Goal**: 修正後、`buyer.phone_number` が存在する全ての入力でSMSボタンが表示されることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := renderSmsButton_fixed(buyer)
  ASSERT smsButtonIsDisplayed(result)
END FOR
```

### Preservation Checking

**Goal**: `buyer.phone_number` が存在しない全ての入力で、修正前後の動作が同一であることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT renderSmsButton_original(buyer) = renderSmsButton_fixed(buyer)
END FOR
```

**Testing Approach**: プロパティベーステストで多様な買主データを生成し、保全を確認する。

**Test Cases:**
1. **電話番号なし保全**: 電話番号がない買主でSMSボタンが表示されないことを確認
2. **Eメールボタン保全**: メールアドレスがある買主でEメールボタンが引き続き表示されることを確認
3. **内覧前日条件保全**: `isViewingPreDay()` が false の場合、ボタン群が表示されないことを確認

### Unit Tests

- 電話番号あり・メールあり → SMSボタンとEメールボタンの両方が表示される
- 電話番号あり・メールなし → SMSボタンのみ表示される
- 電話番号なし・メールあり → Eメールボタンのみ表示される
- 電話番号なし・メールなし → どちらのボタンも表示されない

### Property-Based Tests

- `buyer.phone_number` が存在する全ての買主でSMSボタンが表示される（Property 1）
- `buyer.phone_number` が存在しない全ての買主でSMSボタンが表示されない（Property 2）
- `buyer.email` の有無に関わらず、Eメールボタンの表示条件は `buyer.email` のみで決まる

### Integration Tests

- 買主番号7185（電話番号なし・メールあり）の内覧ページでEメールボタンのみ表示される
- 電話番号あり・メールあり買主の内覧ページで両方のボタンが表示される
- SMS送信ボタンクリック時に `/api/buyers/:buyerNumber/sms-history` が呼ばれる
