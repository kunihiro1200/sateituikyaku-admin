# 売主通話モード 選任媒介通知Chat URL バグ 設計ドキュメント

## Overview

売主管理システムの通話モードページ（CallModePage）において、「専任媒介通知」ボタンを押したときに送信されるGoogle Chat通知が、誤って他決Chat SpaceのWebhook URLに送信されているバグを修正する。

`ChatNotificationService` はコンストラクタで単一の `GOOGLE_CHAT_WEBHOOK_URL` 環境変数を `this.webhookUrl` に設定し、全ての通知メソッドが `sendToGoogleChat(message)` を呼び出す際にこの共通URLを使用している。そのため、選任媒介通知（`sendExclusiveContractNotification`）も他決通知も同じURLに送信されてしまう。

修正方針は最小限の変更で対応する：選任媒介通知専用の環境変数 `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` を追加し、`sendExclusiveContractNotification()` のみが専用URLを使うよう `sendToGoogleChat()` にオプション引数を追加する。

## Glossary

- **Bug_Condition (C)**: `sendExclusiveContractNotification()` が呼び出されたとき、`GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` ではなく `GOOGLE_CHAT_WEBHOOK_URL` を使用してしまう状態
- **Property (P)**: 選任媒介通知が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` のChat Space（`AAAAEz1pOnw`）に正しく届くこと
- **Preservation**: 他決通知・一般媒介通知・物件紹介通知が引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して正しく動作すること
- **ChatNotificationService**: `backend/src/services/ChatNotificationService.ts` に定義されたGoogle Chat通知送信サービス
- **sendExclusiveContractNotification**: 専任媒介契約取得時に通知を送信するメソッド
- **sendToGoogleChat**: 実際にHTTP POSTでWebhookにメッセージを送信するプライベートメソッド
- **webhookUrl**: コンストラクタで `GOOGLE_CHAT_WEBHOOK_URL` から設定される共通Webhook URL

## Bug Details

### Bug Condition

バグは `sendExclusiveContractNotification()` が呼び出されたとき、専用URLではなく共通URLを使用することで発生する。`ChatNotificationService` のコンストラクタは `GOOGLE_CHAT_WEBHOOK_URL` のみを読み込み、全メソッドが同じ `this.webhookUrl` を参照するため、選任媒介通知専用のURLを使い分ける仕組みが存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition(call)
  INPUT: call - メソッド呼び出しの種別
  OUTPUT: boolean

  RETURN call.methodName = 'sendExclusiveContractNotification'
         AND process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL が存在する
         AND sendToGoogleChat が this.webhookUrl (= GOOGLE_CHAT_WEBHOOK_URL) を使用している
END FUNCTION
```

### Examples

- **例1（バグあり）**: ユーザーが通話モードで「専任媒介通知」を押す → `sendExclusiveContractNotification()` が呼ばれる → `GOOGLE_CHAT_WEBHOOK_URL`（他決ChatのURL）に送信 → 他決Chat Spaceに誤って届く
- **例2（バグあり）**: `GOOGLE_CHAT_WEBHOOK_URL` に他決ChatのURLが設定されている状態で専任媒介通知を送信 → 選任媒介Chat Spaceには何も届かない
- **例3（正常）**: 「訪問後他決通知」を押す → `sendPostVisitOtherDecisionNotification()` が呼ばれる → `GOOGLE_CHAT_WEBHOOK_URL` に送信 → 他決Chat Spaceに正しく届く（バグなし）
- **エッジケース**: `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` が未設定の場合 → フォールバックとして `GOOGLE_CHAT_WEBHOOK_URL` を使用するか、エラーを返すか（修正実装で定義）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `sendGeneralContractNotification()` は引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して通知を送信する
- `sendPostVisitOtherDecisionNotification()` は引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して通知を送信する
- `sendPreVisitOtherDecisionNotification()` は引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して通知を送信する
- `sendPropertyIntroductionNotification()` は引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用して通知を送信する
- 専任媒介通知の送信成功時のサクセスメッセージ表示は変わらない
- 専任媒介通知の送信失敗時のエラーメッセージ表示は変わらない
- バリデーションエラー（必須フィールド未入力）の動作は変わらない

**スコープ:**
`sendExclusiveContractNotification()` 以外の全メソッドは、この修正によって一切影響を受けない。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通り：

1. **単一Webhook URLの設計**: `ChatNotificationService` のコンストラクタが `GOOGLE_CHAT_WEBHOOK_URL` のみを読み込み、`this.webhookUrl` として保持している。全メソッドが `sendToGoogleChat(message)` を呼び出し、この共通URLを使用する設計になっている。

2. **専用URL環境変数の欠如**: `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` という環境変数が存在しない。選任媒介通知専用のURLを設定する手段がない。

3. **sendToGoogleChat の固定URL参照**: `sendToGoogleChat(message: string)` は常に `this.webhookUrl` を使用する。URLを引数で渡す仕組みがない。

4. **環境変数の設定ミス（運用上の問題）**: `GOOGLE_CHAT_WEBHOOK_URL` に他決ChatのURLが設定されているため、選任媒介通知が他決Chat Spaceに届いてしまっている。

## Correctness Properties

Property 1: Bug Condition - 選任媒介通知が専用Chat Spaceに届く

_For any_ `sendExclusiveContractNotification()` の呼び出しにおいて、`GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` が設定されている場合、修正後の関数は `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` のエンドポイントにHTTP POSTを送信し、選任媒介Chat Space（`AAAAEz1pOnw`）にメッセージが届くこと。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他決・一般媒介通知の動作が変わらない

_For any_ `sendExclusiveContractNotification()` 以外のメソッド呼び出し（`sendGeneralContractNotification`、`sendPostVisitOtherDecisionNotification`、`sendPreVisitOtherDecisionNotification`、`sendPropertyIntroductionNotification`）において、修正後のコードは修正前と同じ `GOOGLE_CHAT_WEBHOOK_URL` を使用し、同じChat Spaceに同じメッセージを送信すること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/ChatNotificationService.ts`

**Specific Changes**:

1. **専用Webhook URLフィールドの追加**: `private exclusiveWebhookUrl: string` フィールドを追加し、コンストラクタで `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` 環境変数から読み込む。

2. **sendToGoogleChat にオプション引数を追加**: `sendToGoogleChat(message: string, webhookUrl?: string)` とし、引数が渡された場合はそのURLを、渡されない場合は `this.webhookUrl` を使用する。

3. **sendExclusiveContractNotification の修正**: `sendToGoogleChat(message)` の呼び出しを `sendToGoogleChat(message, this.exclusiveWebhookUrl)` に変更する。

4. **isConfigured メソッドの更新**: 必要に応じて `exclusiveWebhookUrl` の設定状態も確認できるようにする（任意）。

**変更イメージ（疑似コード）:**
```
// Before
constructor() {
  this.webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || '';
}

private async sendToGoogleChat(message: string): Promise<boolean> {
  // this.webhookUrl を使用
}

async sendExclusiveContractNotification(...) {
  return await this.sendToGoogleChat(message);  // 共通URLを使用
}

// After
constructor() {
  this.webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || '';
  this.exclusiveWebhookUrl = process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL || '';
}

private async sendToGoogleChat(message: string, webhookUrl?: string): Promise<boolean> {
  const url = webhookUrl || this.webhookUrl;
  // url を使用
}

async sendExclusiveContractNotification(...) {
  return await this.sendToGoogleChat(message, this.exclusiveWebhookUrl);  // 専用URLを使用
}
```

**File**: Vercel環境変数（`sateituikyaku-admin-backend` プロジェクト）

5. **環境変数の追加**: Vercelの `sateituikyaku-admin-backend` プロジェクトに `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` を追加し、値を以下に設定する：
   ```
   https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードで正しいURLが使われることと既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `sendExclusiveContractNotification()` が `GOOGLE_CHAT_WEBHOOK_URL` を使用していることを確認し、バグを再現する。

**Test Plan**: `ChatNotificationService` をインスタンス化し、`sendExclusiveContractNotification()` を呼び出したときに `axios.post` が `GOOGLE_CHAT_WEBHOOK_URL` のURLで呼ばれることをモックで検証する。未修正コードではこのテストが「専用URLで呼ばれること」を期待すると失敗する。

**Test Cases**:
1. **専任媒介通知URLテスト**: `sendExclusiveContractNotification()` を呼び出し、`axios.post` が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` で呼ばれることを検証（未修正コードでは失敗）
2. **共通URL使用確認テスト**: 未修正コードで `axios.post` が `GOOGLE_CHAT_WEBHOOK_URL` で呼ばれることを確認（バグの存在を証明）

**Expected Counterexamples**:
- `axios.post` の呼び出しURLが `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` ではなく `GOOGLE_CHAT_WEBHOOK_URL` になっている
- 原因: `sendToGoogleChat` が常に `this.webhookUrl`（= `GOOGLE_CHAT_WEBHOOK_URL`）を使用している

### Fix Checking

**Goal**: 修正後、`sendExclusiveContractNotification()` が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` を使用することを検証する。

**Pseudocode:**
```
FOR ALL call WHERE isBugCondition(call) DO
  result := sendExclusiveContractNotification_fixed(sellerId, data)
  ASSERT axios.post が GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL で呼ばれた
END FOR
```

### Preservation Checking

**Goal**: `sendExclusiveContractNotification()` 以外の全メソッドが引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用することを検証する。

**Pseudocode:**
```
FOR ALL call WHERE NOT isBugCondition(call) DO
  ASSERT sendMethod_original(call) と sendMethod_fixed(call) が同じURLを使用する
END FOR
```

**Testing Approach**: 各通知メソッドに対してモックテストを実施し、`axios.post` の呼び出しURLが `GOOGLE_CHAT_WEBHOOK_URL` であることを確認する。

**Test Cases**:
1. **一般媒介通知の保持**: `sendGeneralContractNotification()` が `GOOGLE_CHAT_WEBHOOK_URL` を使用することを確認
2. **訪問後他決通知の保持**: `sendPostVisitOtherDecisionNotification()` が `GOOGLE_CHAT_WEBHOOK_URL` を使用することを確認
3. **未訪問他決通知の保持**: `sendPreVisitOtherDecisionNotification()` が `GOOGLE_CHAT_WEBHOOK_URL` を使用することを確認
4. **物件紹介通知の保持**: `sendPropertyIntroductionNotification()` が `GOOGLE_CHAT_WEBHOOK_URL` を使用することを確認

### Unit Tests

- `sendExclusiveContractNotification()` が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` を使用することを検証
- `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` が未設定の場合のフォールバック動作を検証
- 他の全通知メソッドが `GOOGLE_CHAT_WEBHOOK_URL` を使用することを検証
- `sendToGoogleChat` にURLが渡された場合と渡されない場合の動作を検証

### Property-Based Tests

- ランダムな売主IDとデータで `sendExclusiveContractNotification()` を呼び出し、常に `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` が使われることを検証
- ランダムな入力で他の通知メソッドを呼び出し、常に `GOOGLE_CHAT_WEBHOOK_URL` が使われることを検証（保持確認）

### Integration Tests

- 通話モードページで「専任媒介通知」ボタンを押したとき、選任媒介Chat Space（`AAAAEz1pOnw`）にメッセージが届くことを確認
- 「訪問後他決通知」ボタンを押したとき、他決Chat Spaceに正しくメッセージが届くことを確認
- Vercel環境変数 `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` が正しく設定されていることを確認
