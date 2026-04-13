# 物件リスト メール送信履歴 本文表示バグ 修正設計

## Overview

物件リスト詳細ページの「売主への送信履歴」セクションで、値下げ配信メール（GMAIL）の送信履歴詳細モーダルを開くと、本文欄に実際のメール本文ではなく「N件に送信」という文字列が表示されるバグを修正する。

根本原因は `GmailDistributionButton` の `onSendSuccess` コールバックの型に `body` フィールドが含まれておらず、`handleConfirmationConfirm` がコールバック呼び出し時に `editedBody`（実際のメール本文）を渡していないことにある。その結果、親コンポーネント `PropertyListingDetailPage` の `handleGmailDistributionSendSuccess` が本文を受け取れず、`message` フィールドに `${result.successCount}件に送信` という固定文字列を保存している。

修正は最小限の変更で行う：
1. `onSendSuccess` コールバックの型に `body` フィールドを追加
2. `handleConfirmationConfirm` でコールバック呼び出し時に `editedBody`（実際のメール本文）を渡す
3. `handleGmailDistributionSendSuccess` で `result.body` を `message` フィールドに保存する

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `GmailDistributionButton` の `onSendSuccess` コールバックに `body` フィールドが含まれず、`message` フィールドに固定文字列が保存される状態
- **Property (P)**: 期待される正しい動作 — 送信履歴詳細モーダルの本文欄に実際に送信されたメール本文が表示される
- **Preservation**: 修正によって変更してはならない既存の動作（スナックバー表示、chat_type保存、件名・送信者名・送信日時の保存、通常メール/SMSの動作、送信フロー）
- **handleConfirmationConfirm**: `GmailDistributionButton.tsx` 内の関数。確認モーダルで「送信」ボタンを押した際に実行され、`gmailDistributionService.sendEmailsDirectly` を呼び出す
- **editedBody**: `GmailDistributionButton` のステート。確認モーダルで編集されたメール本文を保持する
- **onSendSuccess**: `GmailDistributionButton` の props。送信成功時に親コンポーネントへ通知するコールバック
- **handleGmailDistributionSendSuccess**: `PropertyListingDetailPage.tsx` 内の関数。`onSendSuccess` コールバックとして渡され、`saveSellerSendHistory` を呼び出す
- **saveSellerSendHistory**: `propertyListingApi` のメソッド。`property_chat_history` テーブルに送信履歴を保存する

## Bug Details

### Bug Condition

バグは値下げ配信メール（GMAIL）を送信した後、送信履歴詳細モーダルを開いた際に発生する。`GmailDistributionButton` の `handleConfirmationConfirm` が送信成功後に `onSendSuccess` コールバックを呼び出す際、`editedBody`（実際のメール本文）を渡していないため、親コンポーネントが本文を取得できない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {
    component: string,
    sendResult: { success: boolean, successCount: number },
    onSendSuccessPayload: { successCount: number, subject: string, senderAddress: string, body?: string }
  }
  OUTPUT: boolean

  RETURN input.component = 'GmailDistributionButton'
         AND input.sendResult.success = true
         AND input.onSendSuccessPayload.body = undefined
END FUNCTION
```

### Examples

- **例1（バグあり）**: メール送信成功後、`onSendSuccess({ successCount: 3, subject: '値下げのお知らせ', senderAddress: 'tenant@ifoo-oita.com' })` が呼ばれる → `message` フィールドに `「3件に送信」` が保存される → 送信履歴詳細モーダルの本文欄に `「3件に送信」` が表示される
- **例2（バグあり）**: 1件送信後、`onSendSuccess({ successCount: 1, subject: '...', senderAddress: '...' })` が呼ばれる → `message` フィールドに `「1件に送信」` が保存される
- **例3（修正後の期待動作）**: メール送信成功後、`onSendSuccess({ successCount: 3, subject: '値下げのお知らせ', senderAddress: 'tenant@ifoo-oita.com', body: '大分市中央町1-1-1の物件が...' })` が呼ばれる → `message` フィールドに実際のメール本文が保存される → 送信履歴詳細モーダルの本文欄に実際のメール本文が表示される
- **エッジケース**: `editedBody` が空文字列の場合、`body` として空文字列が渡される → `message` フィールドに空文字列が保存される（許容される動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 送信成功後のスナックバー表示（`メールを送信しました (N件)\n送信元: ${senderAddress}`）は変更しない
- `property_chat_history` テーブルへの `chat_type: 'seller_gmail'` でのレコード保存は変更しない
- 送信履歴の件名（`subject`）・送信者名（`sender_name`）・送信日時（`sent_at`）の保存・表示は変更しない
- 通常メール（`seller_email`）・SMS（`seller_sms`）の送信・履歴保存フローは変更しない
- `GmailDistributionButton` の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）は変更しない

**Scope:**
`GmailDistributionButton` の `onSendSuccess` コールバックへの `body` フィールド追加と、`handleGmailDistributionSendSuccess` での `message` フィールドの保存先変更のみを行う。それ以外の全ての動作は完全に変更しない。

## Hypothesized Root Cause

バグ説明の分析に基づき、最も可能性の高い原因は以下の通り：

1. **onSendSuccess コールバックの型定義に body が欠落**: `GmailDistributionButtonProps` の `onSendSuccess` の型が `{ successCount: number; subject: string; senderAddress: string }` であり、`body` フィールドが含まれていない。これにより TypeScript レベルで `body` を渡すことができない。

2. **handleConfirmationConfirm での body の未渡し**: `handleConfirmationConfirm` 内で `onSendSuccess?.({ successCount, subject, senderAddress })` を呼び出す際に、既に `editedBody` ステートに実際のメール本文が格納されているにもかかわらず、それをコールバックに含めていない。

3. **handleGmailDistributionSendSuccess での固定文字列使用**: `PropertyListingDetailPage` の `handleGmailDistributionSendSuccess` が `message: \`${result.successCount}件に送信\`` という固定文字列を使用しており、`result.body` を参照していない。

4. **設計上の見落とし**: `onSendSuccess` コールバックは元々「送信件数・件名・送信者アドレス」を親コンポーネントに通知する目的で設計されたが、「メール本文」を履歴として保存する要件が後から追加された際に、コールバックの型と呼び出し箇所の更新が漏れた可能性がある。

## Correctness Properties

Property 1: Bug Condition - 値下げ配信メール送信履歴に実際のメール本文が保存される

_For any_ 値下げ配信メール送信成功イベントにおいてバグ条件が成立する（isBugCondition が true を返す）場合、修正後の `handleConfirmationConfirm` は `onSendSuccess` コールバックに `body` フィールドを含めて呼び出し、`handleGmailDistributionSendSuccess` は `saveSellerSendHistory` の `message` フィールドに実際のメール本文（`result.body`）を保存しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存の送信フローと履歴保存動作が変更されない

_For any_ バグ条件が成立しない入力（通常メール送信、SMS送信、GmailDistributionButtonの各モーダル操作、スナックバー表示など）において、修正後のコードは修正前のコードと同一の動作を維持し、既存の全ての機能（スナックバー表示、chat_type保存、件名・送信者名・送信日時の保存、通常メール/SMSフロー、送信フロー）を変更してはならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File 1**: `frontend/frontend/src/components/GmailDistributionButton.tsx`

**変更1: onSendSuccess コールバックの型に body フィールドを追加**

```typescript
// 変更前
onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string }) => void;

// 変更後
onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string; body: string }) => void;
```

**変更2: handleConfirmationConfirm で onSendSuccess 呼び出し時に editedBody を渡す**

```typescript
// 変更前
onSendSuccess?.({
  successCount: result.successCount,
  subject: replacePlaceholders(selectedTemplate.subject, buyerName),
  senderAddress,
});

// 変更後
onSendSuccess?.({
  successCount: result.successCount,
  subject: replacePlaceholders(selectedTemplate.subject, buyerName),
  senderAddress,
  body: editedBody || replacePlaceholders(selectedTemplate.body, buyerName),
});
```

---

**File 2**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**変更3: handleGmailDistributionSendSuccess の型と message フィールドを修正**

```typescript
// 変更前
const handleGmailDistributionSendSuccess = async (result: {
  successCount: number;
  subject: string;
  senderAddress: string;
}) => {
  try {
    await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
      chat_type: 'seller_gmail',
      subject: result.subject,
      message: `${result.successCount}件に送信`,
      sender_name: employee?.name || employee?.initials || '不明',
    });

// 変更後
const handleGmailDistributionSendSuccess = async (result: {
  successCount: number;
  subject: string;
  senderAddress: string;
  body: string;
}) => {
  try {
    await propertyListingApi.saveSellerSendHistory(propertyNumber!, {
      chat_type: 'seller_gmail',
      subject: result.subject,
      message: result.body,
      sender_name: employee?.name || employee?.initials || '不明',
    });
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず修正前のコードでバグを実証するカウンターサンプルを収集し、次に修正後のコードで正しい動作と既存動作の保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを実証するカウンターサンプルを収集し、根本原因分析を確認または反証する。

**Test Plan**: `GmailDistributionButton` の `handleConfirmationConfirm` をシミュレートし、`onSendSuccess` コールバックに `body` が含まれないことを確認する。修正前のコードでテストを実行して失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **onSendSuccess に body が含まれないテスト**: `handleConfirmationConfirm` 実行後、`onSendSuccess` コールバックの引数に `body` フィールドが存在しないことを確認（修正前は FAIL）
2. **message フィールドに固定文字列が保存されるテスト**: `handleGmailDistributionSendSuccess` が `saveSellerSendHistory` を `message: '3件に送信'` で呼び出すことを確認（修正前は PASS、修正後は FAIL）
3. **editedBody が渡されないテスト**: `editedBody` に本文が設定されている状態で送信しても、`onSendSuccess` コールバックに本文が含まれないことを確認（修正前は FAIL）

**Expected Counterexamples**:
- `onSendSuccess` コールバックの引数オブジェクトに `body` プロパティが存在しない
- `saveSellerSendHistory` の `message` フィールドが `'N件に送信'` という固定文字列になっている
- 可能性のある原因: 型定義の欠落、コールバック呼び出し時の引数不足

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleConfirmationConfirm_fixed(input)
  ASSERT onSendSuccess が body フィールドを含む引数で呼ばれた
  ASSERT saveSellerSendHistory が message: result.body で呼ばれた
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同一の動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleConfirmationConfirm_original(input) = handleConfirmationConfirm_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な入力（件数、件名、送信者アドレス、本文の組み合わせ）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存動作が変更されていないことを強力に保証できる

**Test Plan**: 修正前のコードで通常メール・SMS・スナックバー表示の動作を観察し、修正後も同一動作であることをプロパティベーステストで検証する。

**Test Cases**:
1. **スナックバー表示の保全**: 送信成功後のスナックバーメッセージが `メールを送信しました (N件)` のままであることを確認
2. **chat_type 保全**: `saveSellerSendHistory` が `chat_type: 'seller_gmail'` で呼ばれることを確認
3. **件名・送信者名の保全**: `subject` と `sender_name` が正しく保存されることを確認
4. **通常メール・SMS フローの保全**: `handleSendEmail`・`handleSendSms` の動作が変更されていないことを確認
5. **送信フローの保全**: テンプレート選択 → 買主フィルタ → 確認 → 送信の各ステップが変更されていないことを確認

### Unit Tests

- `handleConfirmationConfirm` が `onSendSuccess` を `body` フィールド付きで呼び出すことを確認
- `handleGmailDistributionSendSuccess` が `saveSellerSendHistory` を `message: result.body` で呼び出すことを確認
- `editedBody` が空の場合、テンプレートから生成した本文が `body` として渡されることを確認
- `onSendSuccess` が未定義の場合でもエラーが発生しないことを確認（オプショナルチェーン `?.` の動作確認）

### Property-Based Tests

- ランダムな `editedBody`（任意の文字列）に対して、`onSendSuccess` の `body` フィールドが常に `editedBody` と一致することを検証
- ランダムな送信件数・件名・送信者アドレスの組み合わせに対して、スナックバーメッセージが `successCount` を使用していることを検証（`body` の変更に影響されない）
- ランダムな `result.body` に対して、`saveSellerSendHistory` の `message` フィールドが常に `result.body` と一致することを検証

### Integration Tests

- 値下げ配信メール送信後、送信履歴一覧に新しいレコードが追加されることを確認
- 送信履歴詳細モーダルを開いた際、本文欄に実際のメール本文が表示されることを確認
- 通常メール・SMS の送信履歴詳細モーダルが引き続き正しく動作することを確認（リグレッション確認）
