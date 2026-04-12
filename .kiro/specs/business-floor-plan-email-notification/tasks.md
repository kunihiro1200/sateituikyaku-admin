# 実装計画：業務リスト自動メール送信機能

## 概要

`WorkTaskEmailNotificationService` を新規作成し、`workTasks.ts` の PUT エンドポイントに非同期メール通知を組み込む。
設計の Email_Rule 配列による一元管理パターンに従い、既存の `EmailService.supabase.ts` を活用して実装する。

## タスク

- [x] 1. `WorkTaskEmailNotificationService` の基盤実装
  - `backend/src/services/WorkTaskEmailNotificationService.ts` を新規作成する
  - `EmailRule` インターフェースと `TemplateVariableMapping` インターフェースを定義する
  - 全6ルールの `EMAIL_RULES` 配列を定義する（triggerField・to・cc・subjectTemplate・bodyTemplate）
  - テンプレート変数マッピング定数 `TEMPLATE_VARIABLE_MAP` を定義する
  - _Requirements: 5.1, 5.2, 5.3_

- [-] 2. 純粋関数の実装とプロパティテスト
  - [x] 2.1 `resolveTemplate` 関数を実装する
    - `{変数名}` 形式のプレースホルダーを DBカラム値に置換する
    - null・空文字の場合は空文字に置換する（エラーにしない）
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 2.2 `resolveTemplate` のプロパティテストを書く
    - **Property 2: テンプレート変数解決の完全性**
    - **Validates: Requirements 4.1, 4.4, 2.4, 8.4, 9.4, 10.4, 11.4**
    - fast-check で任意の WorkTaskData に対して未解決変数 `{...}` が残らないことを検証する

  - [ ]* 2.3 `resolveTemplate` の null 安全性プロパティテストを書く
    - **Property 3: null フィールドの安全な置換**
    - **Validates: Requirements 4.4, 2.4**
    - fast-check で null・空文字フィールドに対してエラーなく空文字置換されることを検証する

  - [x] 2.4 `formatDateToJST` 関数を実装する
    - ISO 8601 文字列を `YYYY-MM-DD HH:mm` 形式（JST UTC+9）に変換する
    - null・undefined の場合は空文字を返す
    - _Requirements: 4.3_

  - [ ]* 2.5 `formatDateToJST` のプロパティテストを書く
    - **Property 4: 日付フォーマット変換の正確性**
    - **Validates: Requirements 4.3**
    - fast-check の `fc.date()` で任意の日時に対して `YYYY-MM-DD HH:mm` 形式になることを検証する

- [x] 3. `processEmailNotifications` の実装とプロパティテスト
  - [x] 3.1 `processEmailNotifications` メソッドを実装する
    - `EMAIL_RULES` 配列をループしてトリガーフィールドの変更を検知する（`beforeValue !== afterValue`）
    - 変更があった場合のみ `sendEmailWithCcAndAttachments` を呼び出す
    - 各メール送信を `try/catch` で囲み、1件失敗しても他の処理を継続する
    - 成功・失敗ログを設計のフォーマットで記録する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 7.1, 7.2_

  - [ ]* 3.2 変更検知ロジックのプロパティテストを書く
    - **Property 1: 変更検知の正確性**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**
    - fast-check で任意のトリガーフィールドと before/after 値に対して、`before !== after` の場合のみ送信が呼び出されることを検証する（EmailService をモック化）

  - [ ]* 3.3 `processEmailNotifications` のユニットテストを書く
    - メール送信失敗時に他のフィールドの処理が継続されることをテストする
    - 成功・失敗ログが正しいフォーマットで記録されることをテストする
    - _Requirements: 1.9, 7.1, 7.2, 7.3_

- [x] 4. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 5. `workTasks.ts` の PUT エンドポイントを修正する
  - [x] 5.1 保存前の値取得ロジックを追加する
    - `updateByPropertyNumber` 呼び出し前に `getByPropertyNumber` で現在値を取得する
    - _Requirements: 1.1_

  - [x] 5.2 非同期メール通知呼び出しを追加する
    - レスポンス返却後に `processEmailNotifications` を fire-and-forget で呼び出す
    - `.catch()` でエラーをキャッチしてログに記録する（保存レスポンスに影響させない）
    - _Requirements: 1.9, 7.3_

  - [ ]* 5.3 PUT エンドポイントの統合テストを書く
    - メール送信失敗時でも 200 OK が返ることをテストする
    - _Requirements: 1.9, 7.3_

- [x] 6. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションで、MVP では省略可能
- テストファイルの配置: `backend/src/services/__tests__/WorkTaskEmailNotificationService.test.ts`
- プロパティテストには `fast-check` を使用し、最低 100 回のイテレーションで実行する
- 各タスクは前のタスクの成果物を前提として積み上げる構造になっている
