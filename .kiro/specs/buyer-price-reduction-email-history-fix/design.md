# 値下げメール配信履歴の記録 バグ修正設計書

## Overview

「値下げメール配信」から送信したメールが買主詳細ページの「メール・SMS送信履歴」に記録されないバグを修正します。コミット d95b0ca0 で「他社物件新着配信」と「買主候補リスト」からの送信履歴は正常に記録されるようになりましたが、物件リスト詳細ページの「公開前、値下げメール配信」からの送信履歴のみが記録されていません。

本修正では、`/api/property-listings/:propertyNumber/send-distribution-emails` エンドポイントに `ActivityLogService.logEmail()` の呼び出しを追加し、他の配信機能と同様に履歴を記録できるようにします。

## Glossary

- **Bug_Condition (C)**: 「値下げメール配信」から送信したメールが `activity_logs` テーブルに記録されない条件
- **Property (P)**: 「値下げメール配信」から送信したメールが `activity_logs` テーブルに正しく記録され、買主詳細ページの「メール・SMS送信履歴」に表示される
- **Preservation**: 「他社物件新着配信」「買主候補リスト」「買主詳細ページからの直接送信」の履歴記録機能が引き続き正常に動作する
- **send-distribution-emails エンドポイント**: `backend/src/routes/propertyListings.ts` の `POST /:propertyNumber/send-distribution-emails` - 物件リスト詳細ページの「値下げメール配信」から呼び出されるエンドポイント
- **ActivityLogService.logEmail()**: `backend/src/services/ActivityLogService.ts` のメソッド - メール送信履歴を `activity_logs` テーブルに記録する
- **source識別子**: `metadata.source` フィールドに保存される送信元識別子（`pre_public_price_reduction`, `buyer_candidate_list`, `nearby_buyers` など）

## Bug Details

### Bug Condition

バグは、従業員が物件リスト詳細ページの「値下げメール配信」ボタンからメールを送信した際に発生します。`/api/property-listings/:propertyNumber/send-distribution-emails` エンドポイントは `EmailService.sendTemplateEmail()` を呼び出してメールを送信しますが、`ActivityLogService.logEmail()` を呼び出していないため、`activity_logs` テーブルに履歴が記録されません。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { endpoint: string, hasActivityLogCall: boolean }
  OUTPUT: boolean
  
  RETURN input.endpoint == '/api/property-listings/:propertyNumber/send-distribution-emails'
         AND input.hasActivityLogCall == false
         AND emailSentSuccessfully == true
END FUNCTION
```

### Examples

- **例1**: 買主番号6752に対して物件AA9926の「値下げメール配信」からメールを送信 → メールは送信されるが、買主詳細ページの「メール・SMS送信履歴」に表示されない
- **例2**: 複数の買主に対して「値下げメール配信」から一斉送信 → 全員にメールは届くが、誰の履歴にも記録されない
- **例3**: 「他社物件新着配信」から送信 → 正常に履歴が記録される（期待通り）
- **例4**: 「買主候補リスト」から送信 → 正常に履歴が記録される（期待通り）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「他社物件新着配信」からのメール送信履歴が引き続き `activity_logs` テーブルに記録される
- 「買主候補リスト」からのメール送信履歴が引き続き `activity_logs` テーブルに記録される
- 買主詳細ページから直接送信したメール・SMSの履歴が引き続き記録される
- 既存の送信履歴が送信日時の降順（新しい順）で表示される
- `activity_logs` テーブルのフィールド構造（`target_type`, `target_id`, `action`, `metadata.source`, `metadata.property_numbers`, `metadata.subject`, `metadata.sender_email`）が維持される

**Scope:**
「値下げメール配信」以外のメール送信機能（`/api/emails/send-distribution` エンドポイントを使用する機能）は完全に影響を受けません。これには以下が含まれます：
- 「他社物件新着配信」（NearbyBuyersList.tsx）
- 「買主候補リスト」（BuyerCandidateListPage.tsx）
- Gmail配信ボタン（GmailDistributionButton.tsx）

## Hypothesized Root Cause

要件定義書とコードレビューに基づき、最も可能性の高い原因は以下の通りです：

1. **ActivityLogService呼び出しの欠如**: `/api/property-listings/:propertyNumber/send-distribution-emails` エンドポイント（`backend/src/routes/propertyListings.ts`）が `ActivityLogService.logEmail()` を呼び出していない
   - 他のエンドポイント（`/api/emails/send-distribution`）は正常に `ActivityLogService.logEmail()` を呼び出している
   - コミット d95b0ca0 で追加された履歴記録機能が、このエンドポイントには適用されていない

2. **買主番号の欠如**: エンドポイントが受信者のメールアドレスのみを受け取り、買主番号（`buyer_number`）を受け取っていない可能性
   - `activity_logs.target_id` には買主番号を保存する必要がある
   - フロントエンド（`gmailDistributionService.ts`）が買主番号を送信していない可能性

3. **source識別子の欠如**: エンドポイントが送信元識別子（`source`）を受け取っていない
   - `metadata.source` に `pre_public_price_reduction` を保存する必要がある

4. **従業員IDの欠如**: エンドポイントが従業員ID（`req.employee?.id`）を正しく取得できていない可能性
   - 認証ミドルウェアが正しく動作していない可能性

## Correctness Properties

Property 1: Bug Condition - 値下げメール配信履歴の記録

_For any_ メール送信リクエストで、送信元が「値下げメール配信」（`/api/property-listings/:propertyNumber/send-distribution-emails` エンドポイント）であり、メールが正常に送信された場合、修正後のシステムは `activity_logs` テーブルに履歴を記録し、買主詳細ページの「メール・SMS送信履歴」に表示する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 既存の履歴記録機能

_For any_ メール送信リクエストで、送信元が「値下げメール配信」以外（`/api/emails/send-distribution` エンドポイントを使用する「他社物件新着配信」「買主候補リスト」など）の場合、修正後のシステムは引き続き既存の履歴記録機能を使用し、同じ動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `backend/src/routes/propertyListings.ts`

**Function**: `POST /:propertyNumber/send-distribution-emails`

**Specific Changes**:
1. **ActivityLogServiceのインポート追加**:
   - ファイル冒頭に `import { ActivityLogService } from '../services/ActivityLogService';` を追加

2. **買主番号の受け取り**:
   - リクエストボディに `recipients` フィールドを追加（`{ email: string, buyerNumber?: string }[]` 形式）
   - 既存の `recipientEmails` フィールドは後方互換性のために維持

3. **物件住所の取得**:
   - 既に `property` オブジェクトを取得しているため、`property.property_address` を使用

4. **ActivityLogService.logEmail()の呼び出し追加**:
   - メール送信成功後、各受信者に対して `ActivityLogService.logEmail()` を呼び出す
   - `buyerId`: 買主番号（`recipient.buyerNumber` または `recipient.email`）
   - `propertyNumbers`: `[propertyNumber]`
   - `propertyAddresses`: `{ [propertyNumber]: property.property_address }`
   - `recipientEmail`: 受信者のメールアドレス
   - `subject`: メール件名
   - `templateName`: `'公開前・値下げメール'`
   - `senderEmail`: 送信者メールアドレス（`from`）
   - `source`: `'pre_public_price_reduction'`
   - `body`: メール本文（`content`）
   - `createdBy`: 従業員ID（`req.employee?.id || 'system'`）

5. **エラーハンドリング**:
   - `ActivityLogService.logEmail()` の失敗はログのみ（ユーザーには通知しない）
   - メール送信の成功・失敗とは独立して処理

**File**: `frontend/frontend/src/services/gmailDistributionService.ts`

**Function**: `sendEmailsDirectly`

**Specific Changes**:
1. **買主番号の送信**:
   - リクエストボディに `recipients` フィールドを追加
   - `buyers` パラメータから買主番号とメールアドレスのマッピングを作成
   - `recipients: recipientEmails.map(email => ({ email, buyerNumber: buyers.find(b => b.email === email)?.buyer_number }))`

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従います：まず、修正前のコードでバグを再現し、次に修正後のコードで履歴が正しく記録されることを確認します。また、既存の履歴記録機能が影響を受けていないことを確認します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証します。反証された場合は、再度仮説を立てます。

**Test Plan**: 物件リスト詳細ページの「値下げメール配信」からメールを送信し、`activity_logs` テーブルに履歴が記録されないことを確認します。修正前のコードで実行します。

**Test Cases**:
1. **単一買主への送信テスト**: 買主番号6752に対して物件AA9926の「値下げメール配信」からメールを送信 → `activity_logs` テーブルに履歴が記録されない（修正前のコードで失敗）
2. **複数買主への一斉送信テスト**: 複数の買主に対して「値下げメール配信」から一斉送信 → 誰の履歴にも記録されない（修正前のコードで失敗）
3. **他社物件新着配信テスト**: 「他社物件新着配信」から送信 → 正常に履歴が記録される（修正前のコードで成功）
4. **買主候補リストテスト**: 「買主候補リスト」から送信 → 正常に履歴が記録される（修正前のコードで成功）

**Expected Counterexamples**:
- 「値下げメール配信」から送信したメールが `activity_logs` テーブルに記録されない
- 可能性のある原因: `ActivityLogService.logEmail()` の呼び出しがない、買主番号が送信されていない、source識別子が送信されていない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全ての入力に対して、期待される動作が実現されることを確認します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := sendDistributionEmails_fixed(input)
  ASSERT activityLogRecorded(result)
  ASSERT buyerDetailPageShowsHistory(result)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全ての入力に対して、既存の動作が維持されることを確認します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT sendDistributionEmails_original(input) = sendDistributionEmails_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動生成
- 手動ユニットテストでは見逃す可能性のあるエッジケースをキャッチ
- バグ条件が成立しない全ての入力に対して、動作が変更されていないことを強力に保証

**Test Plan**: 修正前のコードで「他社物件新着配信」「買主候補リスト」からの送信動作を観察し、その動作をキャプチャするProperty-based testを作成します。

**Test Cases**:
1. **他社物件新着配信の保存**: 「他社物件新着配信」から送信したメールが引き続き正常に履歴に記録されることを確認
2. **買主候補リストの保存**: 「買主候補リスト」から送信したメールが引き続き正常に履歴に記録されることを確認
3. **買主詳細ページからの直接送信の保存**: 買主詳細ページから直接送信したメール・SMSが引き続き正常に履歴に記録されることを確認
4. **履歴表示順序の保存**: 既存の送信履歴が引き続き送信日時の降順（新しい順）で表示されることを確認

### Unit Tests

- 「値下げメール配信」エンドポイントが `ActivityLogService.logEmail()` を呼び出すことをテスト
- 買主番号が正しく `activity_logs.target_id` に保存されることをテスト
- source識別子が `pre_public_price_reduction` として保存されることをテスト
- メール送信失敗時に履歴記録がスキップされることをテスト
- 履歴記録失敗時にメール送信が成功することをテスト（独立性）

### Property-Based Tests

- ランダムな買主リストと物件番号を生成し、「値下げメール配信」から送信した履歴が正しく記録されることを確認
- ランダムな送信元（「他社物件新着配信」「買主候補リスト」など）を生成し、既存の履歴記録機能が影響を受けていないことを確認
- 多数のシナリオで履歴表示順序が正しいことを確認

### Integration Tests

- 物件リスト詳細ページから「値下げメール配信」を実行し、買主詳細ページの「メール・SMS送信履歴」に表示されることを確認
- 複数の配信機能（「値下げメール配信」「他社物件新着配信」「買主候補リスト」）を連続して実行し、全ての履歴が正しく記録されることを確認
- 履歴に表示される情報（送信種別、テンプレート名、送信者名、送信日時、物件番号、送信元識別子）が正しいことを確認
