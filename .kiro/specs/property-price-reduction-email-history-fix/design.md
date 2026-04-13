# 値下げ配信メール送信履歴未保存バグ修正 デザインドキュメント

## Overview

`PropertyListingDetailPage` の「公開前、値下げメール」ボタン（`GmailDistributionButton`コンポーネント）からメールを送信した際、`property_chat_history` テーブルへの送信履歴保存処理が実装されていない。

売主へのメール送信（`seller_email`）やSMS送信（`seller_sms`）では送信成功後に `saveSellerSendHistory` が呼ばれているが、`GmailDistributionButton` の `handleConfirmationConfirm` 関数にはこの処理が存在しない。

修正方針は最小限の変更に留める。`GmailDistributionButton` に `onSendSuccess` コールバックプロップを追加し、`PropertyListingDetailPage` 側で `saveSellerSendHistory` を呼び出す。これにより既存の `seller_email` / `seller_sms` の処理パターンと一貫性を保つ。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `GmailDistributionButton` 経由でメール送信が成功したにもかかわらず、`property_chat_history` テーブルへの保存処理が実行されない状態
- **Property (P)**: 期待される正しい動作 — 送信成功後に `property_chat_history` テーブルに `chat_type: 'seller_gmail'` のレコードが保存される
- **Preservation**: 修正によって変更してはならない既存の動作 — `seller_email` / `seller_sms` の送信履歴保存処理、`GmailDistributionButton` の送信フロー自体
- **`handleConfirmationConfirm`**: `GmailDistributionButton.tsx` 内の関数。確認モーダルで「送信」を押した際に実行され、`gmailDistributionService.sendEmailsDirectly` を呼び出す
- **`saveSellerSendHistory`**: `propertyListingApi` のメソッド。`POST /api/property-listings/:propertyNumber/seller-send-history` を呼び出し、`property_chat_history` テーブルにレコードを挿入する
- **`seller_gmail`**: 値下げ配信メール送信を表す `chat_type` 値。`SellerSendHistory` コンポーネントのフィルタリング対象に既に含まれている

## Bug Details

### Bug Condition

バグは `GmailDistributionButton` の `handleConfirmationConfirm` 関数内で `gmailDistributionService.sendEmailsDirectly` が成功した後に発現する。送信成功後の処理ブロックに `saveSellerSendHistory` の呼び出しが存在しないため、履歴が保存されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { component: string, sendResult: { success: boolean } }
  OUTPUT: boolean

  RETURN input.component = 'GmailDistributionButton'
         AND input.sendResult.success = true
         AND property_chat_history に対応するレコードが存在しない
END FUNCTION
```

### Examples

- **例1（バグ発現）**: 物件番号 `P001` で「公開前、値下げメール」ボタンを押し、テンプレート選択 → 買主フィルタ確認 → 送信確認と進んで送信成功 → `property_chat_history` にレコードが存在しない（期待: `chat_type: 'seller_gmail'` のレコードが存在する）
- **例2（バグ発現）**: 複数の買主（5件）に送信成功 → 左列「売主への送信履歴」に何も表示されない（期待: 送信件数・件名・送信者名を含む履歴が1件表示される）
- **例3（バグ非発現）**: 同じ画面で売主メール（`seller_email`）を送信 → 左列に履歴が表示される（既存の正常動作）
- **例4（バグ非発現）**: 送信が失敗した場合 → 履歴は保存されない（正常動作）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 売主へのメール送信（`seller_email`）後の `saveSellerSendHistory` 呼び出しは継続して動作する
- 売主へのSMS送信（`seller_sms`）後の `saveSellerSendHistory` 呼び出しは継続して動作する
- `GmailDistributionButton` の送信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）は変更しない
- 送信失敗時は履歴を保存しない動作を維持する
- `SellerSendHistory` コンポーネントの `seller_email` / `seller_sms` / `seller_gmail` フィルタリングは変更しない

**スコープ:**
`GmailDistributionButton` の送信成功パス以外のすべての処理は影響を受けない。具体的には:
- `seller_email` / `seller_sms` の送信処理
- `GmailDistributionButton` の送信失敗時のフォールバック処理（`fallbackToGmailWebUI`）
- `SellerSendHistory` コンポーネントの表示ロジック

## Hypothesized Root Cause

コードを確認した結果、根本原因は明確に特定できた:

1. **`handleConfirmationConfirm` に `saveSellerSendHistory` 呼び出しが存在しない**:
   - `GmailDistributionButton.tsx` の `handleConfirmationConfirm` 関数は `gmailDistributionService.sendEmailsDirectly` を呼び出した後、成功時に `setSnackbar` でメッセージを表示するだけで、履歴保存処理を行っていない
   - `PropertyListingDetailPage.tsx` の `handleSendEmail`（`seller_email`）や `handleSendSms`（`seller_sms`）では送信成功後に `saveSellerSendHistory` を呼び出しているが、`GmailDistributionButton` は独立したコンポーネントであり、`propertyListingApi` へのアクセス手段がない

2. **コンポーネント設計上の欠落**:
   - `GmailDistributionButton` は `propertyNumber` を受け取っているが、送信成功後に親コンポーネントへ通知するコールバックプロップ（`onSendSuccess` 等）が定義されていない
   - そのため、親コンポーネント（`PropertyListingDetailPage`）が送信成功を検知して履歴保存を行う手段がない

3. **`ReinsRegistrationPage` との非対称性**:
   - `ReinsRegistrationPage.tsx` では `saveSellerSendHistory` を `chat_type: 'seller_gmail'` で呼び出している実装が存在するが、`PropertyListingDetailPage` の `GmailDistributionButton` 使用箇所には同等の処理がない

## Correctness Properties

Property 1: Bug Condition - 値下げ配信メール送信成功時に履歴が保存される

_For any_ `GmailDistributionButton` 経由のメール送信において、`gmailDistributionService.sendEmailsDirectly` が成功した場合（`result.success = true` または `result.successCount > 0`）、修正後のコードは `property_chat_history` テーブルに `chat_type: 'seller_gmail'`、`property_number`、`subject`、`sender_name` を含むレコードを1件保存しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存の送信履歴保存処理が継続して動作する

_For any_ `GmailDistributionButton` 以外の送信処理（`seller_email`、`seller_sms`）において、修正後のコードは修正前と同一の動作を維持し、`saveSellerSendHistory` の呼び出しパターン・保存内容・エラーハンドリングが変更されてはならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**ファイル1**: `frontend/frontend/src/components/GmailDistributionButton.tsx`

**変更内容**:
1. **`onSendSuccess` コールバックプロップを追加**: `GmailDistributionButtonProps` インターフェースに `onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string }) => void` を追加する
2. **`handleConfirmationConfirm` 内でコールバックを呼び出す**: `result.success` または `result.successCount > 0` の場合に `onSendSuccess` を呼び出す

**ファイル2**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**変更内容**:
1. **`GmailDistributionButton` に `onSendSuccess` を渡す**: `handleGmailDistributionSendSuccess` ハンドラを定義し、`saveSellerSendHistory` を `chat_type: 'seller_gmail'` で呼び出す
2. **`setSellerSendHistoryRefreshTrigger` を呼び出す**: 履歴保存後に左列の表示を更新する

### 具体的な変更箇所

```typescript
// GmailDistributionButton.tsx - プロップ追加
interface GmailDistributionButtonProps {
  // ... 既存プロップ
  onSendSuccess?: (result: { successCount: number; subject: string; senderAddress: string }) => void;
}

// handleConfirmationConfirm 内の成功時処理に追加
if (result.success) {
  onSendSuccess?.({
    successCount: result.successCount,
    subject: replacePlaceholders(selectedTemplate.subject, buyerName),
    senderAddress,
  });
  // ... 既存のsetSnackbar処理
}
```

```typescript
// PropertyListingDetailPage.tsx - ハンドラ追加
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
    setSellerSendHistoryRefreshTrigger(prev => prev + 1);
  } catch (err) {
    console.error('[値下げ配信メール送信履歴] 保存に失敗しました:', err);
  }
};

// GmailDistributionButton の使用箇所に追加
<GmailDistributionButton
  // ... 既存プロップ
  onSendSuccess={handleGmailDistributionSendSuccess}
/>
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず未修正コードでバグを実証する反例を生成し、次に修正後のコードで正しい動作と既存動作の保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを実証する反例を生成し、根本原因分析を確認・反証する。

**Test Plan**: `GmailDistributionButton` の `handleConfirmationConfirm` をモックして `gmailDistributionService.sendEmailsDirectly` が成功した場合に `saveSellerSendHistory` が呼ばれないことを確認する。未修正コードで実行して失敗を観察する。

**Test Cases**:
1. **送信成功後の履歴保存テスト**: `sendEmailsDirectly` が `{ success: true, successCount: 3 }` を返した後、`saveSellerSendHistory` が呼ばれないことを確認（未修正コードで失敗する）
2. **`property_chat_history` レコード不存在テスト**: 送信成功後に `property_chat_history` テーブルに `seller_gmail` レコードが存在しないことを確認（未修正コードで失敗する）
3. **左列表示テスト**: 送信成功後に `SellerSendHistory` コンポーネントが更新されないことを確認（未修正コードで失敗する）

**Expected Counterexamples**:
- `saveSellerSendHistory` が一度も呼ばれない（`GmailDistributionButton` に `onSendSuccess` コールバックが存在しないため）
- 根本原因: `handleConfirmationConfirm` に履歴保存処理が実装されていない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立するすべての入力に対して期待される動作が実現されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleConfirmationConfirm_fixed(input)
  ASSERT saveSellerSendHistory が chat_type='seller_gmail' で呼ばれた
  ASSERT property_chat_history に対応するレコードが存在する
  ASSERT SellerSendHistory の refreshTrigger がインクリメントされた
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正前後で動作が同一であることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSendEmail_original(input) = handleSendEmail_fixed(input)
  ASSERT handleSendSms_original(input) = handleSendSms_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- `seller_email` / `seller_sms` の送信処理は多様な入力パターンを持つ
- 自動生成されるテストケースでエッジケースを網羅できる
- 既存動作が変更されていないことを強く保証できる

**Test Cases**:
1. **`seller_email` 保全テスト**: `handleSendEmail` が送信成功後に `saveSellerSendHistory(chat_type: 'seller_email')` を呼び出すことを確認
2. **`seller_sms` 保全テスト**: `handleSendSms` が送信成功後に `saveSellerSendHistory(chat_type: 'seller_sms')` を呼び出すことを確認
3. **送信失敗時の保全テスト**: `sendEmailsDirectly` が失敗した場合に `saveSellerSendHistory` が呼ばれないことを確認
4. **`GmailDistributionButton` 送信フロー保全テスト**: ボタンクリック → テンプレート選択 → 買主フィルタ → 確認の各ステップが変更されていないことを確認

### Unit Tests

- `GmailDistributionButton` の `handleConfirmationConfirm` が成功時に `onSendSuccess` を呼び出すことを確認
- `handleGmailDistributionSendSuccess` が `saveSellerSendHistory` を正しいパラメータで呼び出すことを確認
- 送信失敗時（`result.success = false`）に `onSendSuccess` が呼ばれないことを確認
- `saveSellerSendHistory` 失敗時にエラーがコンソールに記録され、UIに影響しないことを確認

### Property-Based Tests

- 任意の有効な送信結果（`successCount >= 1`）に対して `saveSellerSendHistory` が呼ばれることを検証
- 任意の `seller_email` / `seller_sms` 送信に対して既存の履歴保存処理が変更されていないことを検証
- 任意の送信失敗ケースに対して履歴が保存されないことを検証

### Integration Tests

- `PropertyListingDetailPage` で「公開前、値下げメール」送信後に左列「売主への送信履歴」に記録が表示されることを確認
- `seller_email` / `seller_sms` 送信後の履歴表示が引き続き正常に動作することを確認
- `SellerSendHistory` コンポーネントが `seller_gmail` の `chat_type` を正しくフィルタリングして表示することを確認
