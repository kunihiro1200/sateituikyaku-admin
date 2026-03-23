# 買主詳細画面 Gmail送信・内覧結果重複 バグ修正デザイン

## Overview

買主詳細画面（`BuyerDetailPage`）に関する2つのバグを修正します。

**バグ1**: Gmail送信ボタン押下後、バックエンドでOAuth2トークン取得とGmail API呼び出しが直列実行されるため、ユーザーが長時間のローディング状態を体験する。

**バグ2**: `BUYER_FIELD_SECTIONS` に `isViewingResultGroup: true` の「内覧結果」セクションが定義されており、詳細画面内に表示されている。ヘッダーの「内覧」ボタンで専用ページ（`/buyers/:buyer_number/viewing-result`）に遷移するため、内容が重複している。

修正方針：
- バグ1: `mergeMultiple` API完了後すぐにメール作成モーダルを表示し、実際のGmail送信（OAuth2トークン取得 + Gmail API呼び出し）はモーダル内の「送信」ボタン押下時に非同期で実行する。ユーザーへの待機時間を最小化する。
- バグ2: `BUYER_FIELD_SECTIONS` から `isViewingResultGroup: true` のセクションを削除する。

---

## Glossary

- **Bug_Condition (C)**: バグが発現する条件
  - C1: ユーザーがGmail送信ボタンを押してテンプレートを選択する（Gmail待機バグ）
  - C2: ユーザーが買主詳細画面を開く（内覧結果重複バグ）
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作
- **Preservation**: 修正によって変更してはならない既存の動作
- **BuyerGmailSendButton**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx` のコンポーネント。Gmail送信フローを制御する。
- **handleTemplateSelect**: `BuyerGmailSendButton` 内の関数。テンプレート選択後に `mergeMultiple` APIを呼び出し、メール作成モーダルを開く。
- **handleSendEmail**: `BuyerGmailSendButton` 内の関数。メール作成モーダルの「送信」ボタン押下時に `POST /api/gmail/send` を呼び出す。
- **EmailService.sendBuyerEmail**: `backend/src/services/EmailService.ts` のメソッド。`getAuthenticatedClient()`（OAuth2トークン取得）とGmail API呼び出しを実行する。
- **BUYER_FIELD_SECTIONS**: `BuyerDetailPage.tsx` で定義されたフィールドセクション配列。詳細画面に表示するセクションを定義する。
- **isViewingResultGroup**: `BUYER_FIELD_SECTIONS` のセクションに付与されるフラグ。`true` の場合、内覧結果セクションとして識別される。

---

## Bug Details

### バグ1: Gmail送信の待機時間

#### Bug Condition

テンプレート選択後、`handleTemplateSelect` が `mergeMultiple` APIを呼び出し、その後 `compositionModalOpen` を `true` にする。しかし現在の実装では、`handleSendEmail` が呼ばれた時点で `POST /api/gmail/send` → `EmailService.sendBuyerEmail()` → `getAuthenticatedClient()` → `getAccessToken()`（DBアクセス + OAuth2トークン更新）→ Gmail API呼び出しが直列で実行される。

`getAccessToken()` はDBアクセス（`google_calendar_tokens` テーブル）とOAuth2トークン更新を含むため、ネットワーク遅延が重なると数十秒かかる場合がある。

**Formal Specification:**
```
FUNCTION isBugCondition_Gmail(input)
  INPUT: input of type UserAction
  OUTPUT: boolean

  RETURN input.action = 'clickGmailSend'
         AND input.templateSelected = true
         AND waitTimeForModalDisplay(input) > ACCEPTABLE_WAIT_THRESHOLD
END FUNCTION
```

#### Examples

- ユーザーがGmail送信ボタンを押してテンプレートを選択 → `mergeMultiple` API呼び出し（高速）→ メール作成モーダル表示まで数十秒待機（バグ）
- OAuth2トークンの有効期限切れ時 → `getAccessToken()` でトークン更新が発生 → さらに遅延
- Gmail APIのレスポンスが遅い場合 → タイムアウトエラーまたは無応答状態

### バグ2: 内覧結果セクションの重複表示

#### Bug Condition

`BUYER_FIELD_SECTIONS` に `isViewingResultGroup: true` のセクションが定義されており、詳細画面内に「内覧結果」セクション（最新状況・内覧日（最新）・内覧結果・後続対応）が表示される。一方、ヘッダーの「内覧」ボタンで `/buyers/:buyer_number/viewing-result` 専用ページに遷移でき、同じ内容が別ページにも存在する。

**Formal Specification:**
```
FUNCTION isBugCondition_ViewingDuplicate(input)
  INPUT: input of type PageRenderEvent
  OUTPUT: boolean

  RETURN input.page = 'BuyerDetailPage'
         AND BUYER_FIELD_SECTIONS.some(s => s.isViewingResultGroup = true)
         AND viewingResultPageExists('/buyers/:buyer_number/viewing-result')
END FUNCTION
```

#### Examples

- 買主詳細画面を開く → 「内覧結果」セクションが詳細画面内に表示される（バグ）
- ヘッダーの「内覧」ボタンを押す → 専用ページに遷移 → 同じ内容が表示される（重複）

---

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- Gmail送信ボタンを押すとテンプレート選択モーダルが表示される（要件 3.1）
- メール作成モーダルで「送信」ボタンを押すと買主のメールアドレスにGmailが送信される（要件 3.2）
- 送信後に `email_history` と `activity_logs` が記録される（要件 3.2）
- 買主詳細画面の「問合せ内容」「基本情報」「その他」セクションのインライン編集・保存・スプレッドシート同期が正常に動作する（要件 3.3）
- ヘッダーの「内覧」ボタンで `/buyers/:buyer_number/viewing-result` に遷移する（要件 3.4）
- 詳細画面に「問合せ内容」「基本情報」「その他」の3セクションが正常に表示される（要件 3.5）

**スコープ:**
- Gmail送信フローの変更は `BuyerGmailSendButton.tsx` のみに影響する
- 内覧結果セクション削除は `BUYER_FIELD_SECTIONS` の定義変更のみに影響する
- 他の買主関連ページ（新規登録画面、内覧結果専用ページ）には影響しない

---

## Hypothesized Root Cause

### バグ1: Gmail送信の待機時間

1. **OAuth2トークン取得の直列実行**: `handleSendEmail` → `POST /api/gmail/send` → `EmailService.sendBuyerEmail()` → `getAuthenticatedClient()` → `getAccessToken()` の呼び出しチェーンが全て同期的に実行される。`getAccessToken()` はDBアクセス（`google_calendar_tokens` テーブル）とOAuth2トークン更新を含む。

2. **Gmail API呼び出しの直列実行**: `getAuthenticatedClient()` 完了後に `gmail.users.messages.send()` が実行される。Gmail APIのレスポンスを待つ間、フロントエンドはローディング状態のまま。

3. **エラーハンドリングの不足**: `sendBuyerEmail()` がエラーを返した場合、フロントエンドに明確なエラーメッセージが表示されない可能性がある。

### バグ2: 内覧結果セクションの重複表示

1. **BUYER_FIELD_SECTIONSの定義**: `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` 配列に `isViewingResultGroup: true` のセクションが含まれており、詳細画面のレンダリング時に表示される。

2. **専用ページとの重複**: `/buyers/:buyer_number/viewing-result` 専用ページが存在するにもかかわらず、詳細画面にも同じ内容が表示されている。

---

## Correctness Properties

Property 1: Bug Condition - Gmail送信モーダル表示の即時性

_For any_ ユーザーアクションでGmail送信ボタンを押してテンプレートを選択した場合、修正後の `handleTemplateSelect` 関数は `mergeMultiple` API呼び出し完了後すぐにメール作成モーダルを表示し、OAuth2トークン取得とGmail API呼び出しはモーダル表示後の「送信」ボタン押下時に実行される。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - 内覧結果セクションの非表示

_For any_ 買主詳細画面のレンダリングイベントにおいて、修正後の `BUYER_FIELD_SECTIONS` は `isViewingResultGroup: true` のセクションを含まず、詳細画面内に「内覧結果」セクションが表示されない。

**Validates: Requirements 2.3**

Property 3: Preservation - Gmail送信フローの保持

_For any_ ユーザーアクションでGmail送信ボタンを押した場合（バグ条件が成立しない入力を含む）、修正後のコードは元のコードと同じ動作を保持する。具体的には、テンプレート選択モーダルの表示、メール送信の実行、`email_history` と `activity_logs` の記録が変わらず動作する。

**Validates: Requirements 3.1, 3.2**

Property 4: Preservation - 詳細画面セクション表示の保持

_For any_ 買主詳細画面のレンダリングイベントにおいて、修正後のコードは「問合せ内容」「基本情報」「その他」の3セクションを正常に表示し、内覧ボタンの遷移動作も変わらず動作する。

**Validates: Requirements 3.3, 3.4, 3.5**

---

## Fix Implementation

### 変更1: BuyerGmailSendButton.tsx（バグ1修正）

**ファイル**: `frontend/frontend/src/components/BuyerGmailSendButton.tsx`

**関数**: `handleTemplateSelect`、`handleSendEmail`

**具体的な変更:**

1. **handleTemplateSelect の変更**: `mergeMultiple` API呼び出し完了後すぐに `setCompositionModalOpen(true)` を呼び出す。OAuth2トークン取得とGmail API呼び出しはこの時点では実行しない。現在の実装はすでにこの構造になっているため、`mergeMultiple` API自体の遅延が問題でないことを確認する。

2. **handleSendEmail のローディング状態改善**: `POST /api/gmail/send` 呼び出し中のローディング状態をモーダル内で適切に表示し、ユーザーに進捗を伝える。

3. **エラーハンドリングの強化**: `sendBuyerEmail()` がエラーを返した場合、明確なエラーメッセージをモーダル内に表示する。タイムアウトエラーの場合は再試行オプションを提供する。

**注意**: コード調査の結果、`mergeMultiple` APIはSupabaseクエリのみで構成されており高速である。実際の遅延は `POST /api/gmail/send` 呼び出し時（`sendBuyerEmail()` 内のOAuth2トークン取得）で発生する。現在の実装では `handleTemplateSelect` でモーダルを開き、`handleSendEmail` でGmail送信を行う構造になっているため、**バグの根本原因はバックエンドの `getAuthenticatedClient()` の遅延**である可能性が高い。

### 変更2: BuyerDetailPage.tsx（バグ2修正）

**ファイル**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**対象**: `BUYER_FIELD_SECTIONS` 配列

**具体的な変更:**

```typescript
// 削除するセクション（isViewingResultGroup: true）
{
  title: '内覧結果',
  isViewingResultGroup: true,
  fields: [
    { key: 'latest_status', label: '★最新状況', inlineEditable: true },
    { key: 'latest_viewing_date', label: '内覧日（最新）', type: 'date', inlineEditable: true },
    { key: 'viewing_result_follow_up', label: '内覧結果・後続対応', multiline: true, inlineEditable: true },
  ],
},
```

このセクションを `BUYER_FIELD_SECTIONS` から削除する。残りの3セクション（問合せ内容・基本情報・その他）はそのまま維持する。

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず未修正コードでバグを再現するテストを実行し、根本原因を確認する。次に修正後のコードでバグが解消され、既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: 
- バグ1: Gmail送信フローをシミュレートし、`handleTemplateSelect` から `compositionModalOpen` が `true` になるまでの時間を計測する。`POST /api/gmail/send` の応答時間を計測する。
- バグ2: `BUYER_FIELD_SECTIONS` に `isViewingResultGroup: true` のセクションが存在することを確認する。

**Test Cases**:
1. **Gmail送信フロー時間計測**: テンプレート選択からモーダル表示までの時間を計測（未修正コードで実行）
2. **Gmail送信API応答時間計測**: `POST /api/gmail/send` の応答時間を計測（OAuth2トークン取得の遅延を確認）
3. **内覧結果セクション存在確認**: `BUYER_FIELD_SECTIONS` に `isViewingResultGroup: true` のセクションが存在することを確認（未修正コードで実行）
4. **専用ページとの重複確認**: 詳細画面と `/buyers/:buyer_number/viewing-result` の両方に同じフィールドが表示されることを確認

**Expected Counterexamples**:
- Gmail送信ボタン押下からモーダル表示まで数十秒かかる
- `POST /api/gmail/send` の応答に数十秒かかる（OAuth2トークン取得の遅延）
- 詳細画面に「内覧結果」セクションが表示される

### Fix Checking

**Goal**: 修正後のコードでバグが解消されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_Gmail(input) DO
  result := handleTemplateSelect_fixed(input)
  ASSERT compositionModalOpen = true WITHIN acceptable_time
  ASSERT oauth2TokenFetch NOT IN handleTemplateSelect_fixed
END FOR

FOR ALL input WHERE isBugCondition_ViewingDuplicate(input) DO
  result := renderBuyerDetailPage_fixed(input)
  ASSERT NOT viewingResultSectionVisible(result)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで既存動作が保持されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) = fixedBehavior(input)
END FOR
```

**Testing Approach**: 既存動作の保持確認には、以下の手動テストと自動テストを組み合わせる。

**Test Cases**:
1. **テンプレート選択モーダル表示の保持**: Gmail送信ボタン押下でテンプレート選択モーダルが表示されることを確認
2. **Gmail送信の保持**: メール作成モーダルで「送信」ボタンを押すとGmailが送信されることを確認
3. **履歴記録の保持**: 送信後に `email_history` と `activity_logs` が記録されることを確認
4. **3セクション表示の保持**: 詳細画面に「問合せ内容」「基本情報」「その他」の3セクションが表示されることを確認
5. **内覧ボタン遷移の保持**: ヘッダーの「内覧」ボタンで専用ページに遷移することを確認

### Unit Tests

- `BUYER_FIELD_SECTIONS` に `isViewingResultGroup: true` のセクションが含まれないことを確認
- `handleTemplateSelect` が `mergeMultiple` API完了後すぐにモーダルを開くことを確認
- `handleSendEmail` が `POST /api/gmail/send` を正しく呼び出すことを確認
- エラー時に適切なエラーメッセージが表示されることを確認

### Property-Based Tests

- 任意の買主データで詳細画面をレンダリングした場合、`isViewingResultGroup: true` のセクションが表示されないことを確認（Property 2）
- 任意のテンプレート選択で `handleTemplateSelect` が呼ばれた場合、OAuth2トークン取得が実行されないことを確認（Property 1）
- 任意の買主データで詳細画面をレンダリングした場合、「問合せ内容」「基本情報」「その他」の3セクションが常に表示されることを確認（Property 4）

### Integration Tests

- Gmail送信フロー全体（ボタン押下 → テンプレート選択 → モーダル表示 → 送信 → 履歴記録）が正常に動作することを確認
- 買主詳細画面の全セクション（問合せ内容・基本情報・その他）のインライン編集が正常に動作することを確認
- 内覧ボタンで専用ページに遷移し、内覧情報を確認・編集できることを確認
