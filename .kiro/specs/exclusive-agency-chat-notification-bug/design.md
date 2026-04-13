# 専任媒介チャット通知バグ デザインドキュメント

## Overview

CallModePage（通話モードページ）の「専任媒介通知」ボタンを押すと「送信されました」と表示されるが、Google Chatに実際には届いていないバグを修正する。

根本原因は2つある：
1. `backend/src/index.ts` でルートが `/chat-notifications` として登録されているが、フロントエンドは `/api/chat-notifications/...` を呼び出している（`/api/` プレフィックスの不一致）
2. `backend/.env` に `GOOGLE_CHAT_WEBHOOK_URL` が設定されておらず、`ChatNotificationService.sendToGoogleChat()` がエラーをスローせず `false` を返すだけなので、フロントエンドが成功と判断してしまう

修正方針：
- `backend/src/index.ts` のルート登録を `/chat-notifications` から `/api/chat-notifications` に変更する
- `ChatNotificationService.sendToGoogleChat()` で `webhookUrl` が未設定の場合はエラーをスローするよう変更する
- `backend/.env` および Vercel 環境変数に `GOOGLE_CHAT_WEBHOOK_URL` を設定する

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — フロントエンドが `/api/chat-notifications/exclusive-contract/:sellerId` を呼び出したとき、バックエンドのルートが `/chat-notifications` で登録されているためリクエストが到達しない、または `GOOGLE_CHAT_WEBHOOK_URL` が未設定のため通知が送信されない
- **Property (P)**: 期待される正しい動作 — 「専任媒介通知」ボタンを押したとき、指定された Google Chat Webhook URL に実際にメッセージが届く
- **Preservation**: 修正によって変更してはいけない既存の動作 — バリデーションエラー表示、DBへの保存処理、成功時のサクセスメッセージ表示
- **chatNotificationRoutes**: `backend/src/routes/chatNotifications.ts` で定義されたルートハンドラ群
- **ChatNotificationService**: `backend/src/services/ChatNotificationService.ts` で定義されたGoogle Chat通知送信サービス
- **sendToGoogleChat**: `ChatNotificationService` 内のプライベートメソッド。`GOOGLE_CHAT_WEBHOOK_URL` が未設定の場合に `false` を返すだけでエラーをスローしない（バグの原因）
- **webhookUrl**: `ChatNotificationService` のコンストラクタで `process.env.GOOGLE_CHAT_WEBHOOK_URL` から取得するプロパティ

## Bug Details

### Bug Condition

バグは以下の2つの条件のいずれかが成立するときに発生する：

**条件1: APIパス不一致**
フロントエンドが `/api/chat-notifications/exclusive-contract/:sellerId` を呼び出すが、バックエンドは `/chat-notifications` でルートを登録しているため、リクエストが正しいルートハンドラに到達しない。

**条件2: 環境変数未設定によるサイレント失敗**
`GOOGLE_CHAT_WEBHOOK_URL` が未設定の場合、`sendToGoogleChat()` は `false` を返すだけでエラーをスローしない。ルートハンドラは `{ success: false }` を返すが、フロントエンドは `success` フィールドを確認せずサクセスメッセージを表示してしまう可能性がある。

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean

  RETURN (
    request.path STARTS_WITH '/api/chat-notifications'
    AND backendRoute REGISTERED_AS '/chat-notifications'  -- パス不一致
  )
  OR (
    request.path MATCHES backendRoute  -- パスは一致
    AND process.env.GOOGLE_CHAT_WEBHOOK_URL IS EMPTY
    AND sendToGoogleChat RETURNS false WITHOUT THROWING
  )
END FUNCTION
```

### Examples

- **例1（パス不一致）**: フロントエンドが `POST /api/chat-notifications/exclusive-contract/uuid-xxx` を呼び出す → バックエンドは `/chat-notifications/exclusive-contract/uuid-xxx` でしか受け付けないため 404 または別のルートにマッチしてしまう
- **例2（環境変数未設定）**: `GOOGLE_CHAT_WEBHOOK_URL` が空の状態で通知ボタンを押す → `sendToGoogleChat()` が `false` を返す → ルートは `{ success: false }` を返す → フロントエンドが成功と誤判断してサクセスメッセージを表示する
- **例3（正常ケース）**: `GOOGLE_CHAT_WEBHOOK_URL` が設定済みで `/api/chat-notifications` でルートが登録されている → Google Chat に実際にメッセージが届く
- **エッジケース**: `GOOGLE_CHAT_WEBHOOK_URL` が設定されているが無効なURL → `axios.post()` がエラーをスローし、`sendToGoogleChat()` が `false` を返す（現状はエラーをキャッチして `false` を返すだけ）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 必須フィールド（専任（他決）決定日、競合、専任・他決要因）が未入力の場合のバリデーションエラー表示は引き続き動作すること
- 「専任媒介通知」ボタンを押したときの4つのフィールド（status、exclusiveDecisionDate、competitors、exclusiveOtherDecisionFactors）のDB保存処理は引き続き動作すること
- Google Chat通知が正常に送信された場合のサクセスメッセージ表示は引き続き動作すること
- 一般媒介、訪問後他決、未訪問他決の各通知ボタンも同様に修正後も正しく動作すること

**スコープ:**
バグ条件（パス不一致・環境変数未設定）に該当しない入力は、この修正によって一切影響を受けてはならない。具体的には：
- バリデーションエラーが発生するケース（必須フィールド未入力）
- DB保存処理（chatNotificationsルートとは独立したロジック）
- 他の通知エンドポイント（一般媒介、訪問後他決、未訪問他決）

## Hypothesized Root Cause

調査の結果、以下の2つの問題が確認された：

1. **ルート登録パスの不一致**: `backend/src/index.ts` の555行目で `app.use('/chat-notifications', chatNotificationRoutes)` と登録されているが、他のルートは `/api/` プレフィックスを使用している（例: `/api/employees`、`/api/sellers`）。フロントエンドは `/api/chat-notifications/...` を呼び出しているため、リクエストが正しいルートハンドラに到達しない。

2. **環境変数未設定によるサイレント失敗**: `ChatNotificationService.sendToGoogleChat()` は `webhookUrl` が空の場合に `console.warn` を出力して `false` を返すだけでエラーをスローしない。ルートハンドラは `{ success: false }` を返すが、フロントエンドが `success: false` を適切にエラーとして扱っていない可能性がある。`backend/.env` に `GOOGLE_CHAT_WEBHOOK_URL` が設定されていないことが確認済み。

3. **Vercel環境変数の未設定**: ローカルの `.env` だけでなく、Vercel の環境変数にも `GOOGLE_CHAT_WEBHOOK_URL` が設定されていない可能性がある。

## Correctness Properties

Property 1: Bug Condition - 専任媒介通知がGoogle Chatに実際に届く

_For any_ リクエストで `GOOGLE_CHAT_WEBHOOK_URL` が設定されており、かつ `/api/chat-notifications/exclusive-contract/:sellerId` へのリクエストが送信された場合、修正後の `chatNotificationRoutes` および `ChatNotificationService` は指定された Google Chat Webhook URL に HTTP POST リクエストを送信し、Google Chat にメッセージが届く。

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation - 環境変数未設定時のエラー通知

_For any_ リクエストで `GOOGLE_CHAT_WEBHOOK_URL` が未設定（空文字列）の場合、修正後の `ChatNotificationService.sendToGoogleChat()` は `false` を返すのではなくエラーをスローし、フロントエンドにエラーレスポンスが返される（サクセスメッセージを表示しない）。

**Validates: Requirements 2.2, 2.4**

Property 3: Preservation - 既存の動作が変更されない

_For any_ バグ条件に該当しない入力（バリデーションエラーケース、DB保存処理、他の通知エンドポイント）に対して、修正後のコードは修正前のコードと同じ動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を行う：

**変更1: ルート登録パスの修正**

**ファイル**: `backend/src/index.ts`

**変更内容**:
```
// 変更前
app.use('/chat-notifications', chatNotificationRoutes);

// 変更後
app.use('/api/chat-notifications', chatNotificationRoutes);
```

**変更2: 環境変数未設定時のエラースロー**

**ファイル**: `backend/src/services/ChatNotificationService.ts`

**関数**: `sendToGoogleChat()`

**変更内容**:
```
// 変更前
if (!this.webhookUrl) {
  console.warn('Google Chat webhook URL not configured');
  return false;
}

// 変更後
if (!this.webhookUrl) {
  throw new Error('Google Chat webhook URL is not configured (GOOGLE_CHAT_WEBHOOK_URL)');
}
```

**変更3: 環境変数の設定**

**ファイル**: `backend/.env`（ローカル開発用）

**追加内容**:
```
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8
```

**変更4: Vercel環境変数の設定**

Vercel の `sateituikyaku-admin-backend` プロジェクトに以下の環境変数を追加する：
- 変数名: `GOOGLE_CHAT_WEBHOOK_URL`
- 値: `https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8`

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで行う：まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しく動作することと既存の動作が維持されることを検証する。

### Exploratory Bug Condition Checking

**目標**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。

**テスト計画**: 未修正コードに対して以下のテストを実行し、失敗を観察して根本原因を理解する。

**テストケース**:
1. **パス不一致テスト**: `/api/chat-notifications/exclusive-contract/:sellerId` へのリクエストが 404 または誤ったルートにマッチすることを確認（未修正コードで失敗するはず）
2. **環境変数未設定テスト**: `GOOGLE_CHAT_WEBHOOK_URL` が空の状態で通知を送信し、`{ success: false }` が返ることを確認（未修正コードで失敗するはず）
3. **サイレント失敗テスト**: `sendToGoogleChat()` が `false` を返してもルートが `200 OK` を返すことを確認（未修正コードで失敗するはず）

**期待されるカウンターサンプル**:
- `/api/chat-notifications/...` へのリクエストが正しいルートハンドラに到達しない
- `GOOGLE_CHAT_WEBHOOK_URL` 未設定時にエラーがスローされず `{ success: false }` が返る

### Fix Checking

**目標**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  result := fixedChatNotificationRoute(request)
  ASSERT result.status === 200
  ASSERT result.body.success === true
  ASSERT googleChatWebhookWasCalled === true
END FOR
```

### Preservation Checking

**目標**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT originalHandler(request) = fixedHandler(request)
END FOR
```

**テスト方針**: プロパティベーステストを推奨する理由：
- 多数のテストケースを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 非バグ入力に対して動作が変わらないことを強く保証できる

**テストケース**:
1. **バリデーションエラー保持テスト**: 必須フィールド未入力時のバリデーションエラーが修正後も同じように動作することを確認
2. **DB保存処理保持テスト**: 4つのフィールドのDB保存処理が修正後も正しく動作することを確認
3. **他エンドポイント保持テスト**: 一般媒介、訪問後他決、未訪問他決の各エンドポイントが修正後も正しく動作することを確認

### Unit Tests

- `ChatNotificationService.sendToGoogleChat()` が `webhookUrl` 未設定時にエラーをスローすることをテスト
- `ChatNotificationService.sendToGoogleChat()` が `webhookUrl` 設定済み時に axios.post を呼び出すことをテスト
- ルートハンドラが `/api/chat-notifications/exclusive-contract/:sellerId` で正しく登録されていることをテスト
- バリデーションエラー（必須フィールド未入力）が引き続き正しく返されることをテスト

### Property-Based Tests

- ランダムな `sellerId`（UUID形式）に対して、`GOOGLE_CHAT_WEBHOOK_URL` 設定済みの場合は常に `{ success: true }` が返ることを検証
- ランダムな入力に対して、`GOOGLE_CHAT_WEBHOOK_URL` 未設定の場合は常にエラーレスポンスが返ることを検証
- バリデーションエラーケース（必須フィールド未入力）に対して、修正前後で同じエラーレスポンスが返ることを検証

### Integration Tests

- 修正後のバックエンドに対して実際に `/api/chat-notifications/exclusive-contract/:sellerId` を呼び出し、Google Chat にメッセージが届くことを確認
- 一般媒介、訪問後他決、未訪問他決の各エンドポイントも同様に動作することを確認
- フロントエンドの「専任媒介通知」ボタンを押して、Google Chat にメッセージが届き、サクセスメッセージが表示されることを確認
