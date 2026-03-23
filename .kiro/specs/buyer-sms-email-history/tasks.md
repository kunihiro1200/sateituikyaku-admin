# 実装計画: buyer-sms-email-history

## 概要

買主詳細画面（BuyerDetailPage）のSMS送信操作を `activity_logs` テーブルに記録し、「メール送信履歴」セクションにSMS送信履歴も表示する機能を実装する。

既存の `activity_logs` テーブルと `ActivityLogService` を再利用し、フロントエンド・バックエンドともに最小限の変更で実現する。

## タスク

- [x] 1. バックエンド: SMS履歴記録APIエンドポイントの実装
  - [x] 1.1 `POST /api/buyers/:buyerNumber/sms-history` エンドポイントを `backend/src/routes/buyers.ts` に追加する
    - リクエストボディのバリデーション（`templateId`・`templateName`・`phoneNumber` の必須チェック）
    - 買主番号の存在確認（存在しない場合は HTTP 404 を返す）
    - 認証ミドルウェアの適用（未認証の場合は HTTP 401 を返す）
    - 既存の `ActivityLogService.logActivity()` を呼び出して `activity_logs` テーブルに挿入
    - `action='sms'`、`target_type='buyer'`、`target_id=buyerNumber`、`metadata` に `templateId`・`templateName`・`phoneNumber`・`buyerNumber` を設定
    - 成功時は `{ success: true, logId: string }` を返す
    - _要件: 1.2, 1.3, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.2 バックエンドのユニットテストを作成する（`backend/src/routes/__tests__/buyers.sms-history.test.ts`）
    - 正常系: 有効なリクエストで 200 と `logId` が返ること
    - 異常系: 必須フィールド欠如で 400 が返ること
    - 異常系: 存在しない買主番号で 404 が返ること
    - 異常系: 認証なしで 401 が返ること
    - _要件: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.3 Property 2: SMS履歴レコードの挿入（プロパティテスト）
    - **Property 2: SMS履歴レコードの挿入**
    - **Validates: 要件 1.2, 1.5, 3.2**
    - `backend/src/routes/__tests__/buyers.sms-history.property.test.ts` に `fast-check` を使用して実装
    - 任意の有効なリクエストで `activity_logs` に `action='sms'`・`target_type='buyer'`・`target_id=buyerNumber` のレコードが1件挿入されることを検証

  - [ ]* 1.4 Property 3: メタデータの完全性（プロパティテスト）
    - **Property 3: メタデータの完全性**
    - **Validates: 要件 1.3**
    - 任意の有効なリクエストで挿入されたレコードの `metadata` に `templateId`・`templateName`・`phoneNumber`・`buyerNumber` の4フィールドが全て含まれることを検証

  - [ ]* 1.5 Property 8: 必須フィールド欠如時の400エラー（プロパティテスト）
    - **Property 8: 必須フィールド欠如時の400エラー**
    - **Validates: 要件 3.4**
    - 任意の必須フィールド（`templateId`・`templateName`・`phoneNumber` のいずれか）が欠けたリクエストで HTTP 400 が返ることを検証

- [x] 2. チェックポイント - バックエンドの動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. フロントエンド: SmsDropdownButton へのAPI呼び出し追加
  - [x] 3.1 `frontend/frontend/src/components/SmsDropdownButton.tsx` の `sendSms()` 関数を修正する
    - `sendSms` の引数に `templateName` を追加
    - 各 `MenuItem` の `onClick` に対応するテンプレート名を渡す
    - `api` サービスをインポート
    - `window.location.href` を設定する前に `api.post('/api/buyers/${buyerNumber}/sms-history', ...)` を fire-and-forget で呼び出す
    - API呼び出し失敗時は `console.warn` でログ出力のみ（SMSアプリを開く処理は中断しない）
    - _要件: 1.1, 1.4_

  - [ ]* 3.2 フロントエンドのユニットテストを作成する（`frontend/frontend/src/components/__tests__/SmsDropdownButton.test.tsx`）
    - `sendSms()` 呼び出し時に API が呼び出されること
    - API エラー時でも `window.location.href` が設定されること
    - 空メッセージの場合は API も SMS アプリも起動しないこと
    - _要件: 1.1, 1.4_

  - [ ]* 3.3 Property 1: SMS送信操作はAPIを呼び出す（プロパティテスト）
    - **Property 1: SMS送信操作はAPIを呼び出す**
    - **Validates: 要件 1.1**
    - `frontend/frontend/src/components/__tests__/SmsDropdownButton.property.test.tsx` に実装
    - 任意の有効なテンプレートIDと買主番号の組み合わせで `sendSms()` が呼び出されたとき、`api.post` が呼び出されることを検証

  - [ ]* 3.4 Property 4: APIエラー時のSMS送信継続（プロパティテスト）
    - **Property 4: APIエラー時のSMS送信継続**
    - **Validates: 要件 1.4**
    - 任意の API エラー（ネットワークエラー・500エラー等）が発生した場合でも `window.location.href` への代入が実行されることを検証

- [x] 4. フロントエンド: BuyerDetailPage のメール送信履歴セクション変更
  - [x] 4.1 `frontend/frontend/src/pages/BuyerDetailPage.tsx` のメール送信履歴セクションを修正する
    - フィルタ条件を `action === 'email'` から `action === 'email' || action === 'sms'` に変更
    - SMS履歴レコードの表示内容を追加（「SMS」ラベル、送信先電話番号 `metadata.phoneNumber`、テンプレート名 `metadata.templateName`）
    - メール送信履歴とSMS送信履歴を `created_at` の降順で統合して表示
    - SMS履歴が0件の場合は既存の「メール送信履歴はありません」メッセージを維持
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Property 5: 統合履歴の表示フィルタ（プロパティテスト）
    - **Property 5: 統合履歴の表示フィルタ**
    - **Validates: 要件 2.1**
    - `frontend/frontend/src/components/__tests__/SmsDropdownButton.property.test.tsx` に追加
    - 任意の `activities` リストに対して `action='email'` と `action='sms'` の両方が表示対象に含まれ、それ以外は含まれないことを検証

  - [ ]* 4.3 Property 6: SMS履歴レコードの表示内容（プロパティテスト）
    - **Property 6: SMS履歴レコードの表示内容**
    - **Validates: 要件 2.2, 2.3**
    - 任意の `action='sms'` のアクティビティレコードに対して、レンダリング結果に送信日時・テンプレート名・送信先電話番号・「SMS」ラベルが含まれることを検証

  - [ ]* 4.4 Property 7: 統合履歴の降順ソート（プロパティテスト）
    - **Property 7: 統合履歴の降順ソート**
    - **Validates: 要件 2.4**
    - 任意のメール・SMS混在の `activities` リストに対して、表示順が `created_at` の降順になっていることを検証

- [x] 5. 最終チェックポイント - 全テスト通過確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP実装では省略可能
- 各タスクは対応する要件番号を参照しているため、トレーサビリティを確保
- プロパティテストには `fast-check` ライブラリを使用（`npm install --save-dev fast-check`）
- fire-and-forget パターンにより、API失敗時もSMSアプリを開く処理は継続される
