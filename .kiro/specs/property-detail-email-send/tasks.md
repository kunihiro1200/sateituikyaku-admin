# 実装計画：物件詳細画面 Email送信機能

## 概要

既存の `CallModePage` のEmail送信実装を流用し、`PropertyListingDetailPage` にEmail送信機能を追加する。
バックエンドに新エンドポイントを追加し、フロントエンドにEmail送信ボタン・確認ダイアログを実装する。

## タスク

- [x] 1. バックエンド：EmailTemplateService に `getPropertyNonReportTemplates()` を追加
  - `backend/src/services/EmailTemplateService.ts` に新メソッドを追加する
  - 既存の `getPropertyTemplates()` を参考に、C列「区分」が「物件」かつD列「種別」に「報告」を含まない行のみ返すフィルタロジックを実装する
  - _Requirements: 1.1, 1.2_

  - [ ]* 1.1 `getPropertyNonReportTemplates` のプロパティテストを作成する
    - **Property 1: 非報告テンプレートのフィルタリング**
    - **Validates: Requirements 1.1, 1.2**
    - fast-check を使用し、任意のテンプレート行配列に対して、返却結果が全て `category === '物件'` かつ `!type.includes('報告')` であることを検証する（numRuns: 100）

- [x] 2. バックエンド：`GET /api/email-templates/property-non-report` エンドポイントを追加
  - `backend/src/routes/emailTemplates.ts` に新ルートを追加する
  - 既存の `GET /api/email-templates/property` エンドポイントを参考に実装する
  - Google Sheets API 接続失敗時は HTTP 500 とエラーメッセージを返す
  - _Requirements: 1.3, 1.4_

  - [ ]* 2.1 エンドポイントのユニットテストを作成する
    - 正常系：テンプレート一覧を返すこと
    - 異常系：Google Sheets API 失敗時に 500 を返すこと
    - _Requirements: 1.3, 1.4_

- [x] 3. チェックポイント — バックエンドの動作確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 4. フロントエンド：`PropertyListingDetailPage` に状態・テンプレート取得処理を追加
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` に以下の状態を追加する
    - `propertyEmailTemplates`（テンプレート一覧）
    - `propertyEmailTemplatesLoading`（ローディング状態）
    - `propertyEmailConfirmDialog`（確認ダイアログの開閉・選択テンプレートID）
  - `fetchPropertyEmailTemplates()` 関数を実装し、`useEffect` でページマウント時に `GET /api/email-templates/property-non-report` を呼び出す
  - テンプレート取得失敗時はコンソールにエラーを記録し、ボタンを非活性のまま維持する
  - _Requirements: 5.1, 5.2_

  - [ ]* 4.1 `seller_email` が空の場合のボタン無効化プロパティテストを作成する
    - **Property 2: seller_email が空の場合のボタン無効化**
    - **Validates: Requirements 2.2**
    - fast-check を使用し、`seller_email` が空文字列・undefined・null の場合に Email送信ボタンが disabled であることを検証する（numRuns: 100）

- [x] 5. フロントエンド：Email送信ドロップダウンボタンを追加
  - `PropertyListingDetailPage` の上部アクションエリアに「Email送信」ドロップダウンボタンを追加する
  - `CallModePage` の既存実装を参考にする
  - `seller_email` が空または未設定の場合は `disabled` にする
  - テンプレート取得中（`propertyEmailTemplatesLoading`）は `disabled` にする
  - ドロップダウンメニューに `propertyEmailTemplates` の一覧を表示する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. フロントエンド：テンプレート選択時のプレースホルダー置換処理を追加
  - `handleSelectPropertyEmailTemplate(templateId: string)` 関数を実装する
  - `POST /api/email-templates/property/merge` を呼び出し、`propertyNumber` と `templateId` を送信する
  - 置換結果（`subject`, `body`, `sellerName`, `sellerEmail`）を既存の `editableEmailRecipient`, `editableEmailSubject`, `editableEmailBody` 状態にセットする
  - 置換完了後に `propertyEmailConfirmDialog` を開く
  - 置換失敗時はスナックバーでエラーメッセージを表示する
  - _Requirements: 2.5, 2.6_

- [x] 7. フロントエンド：Email送信確認ダイアログを追加
  - `propertyEmailConfirmDialog.open` が true の場合にダイアログを表示する
  - 送信先メールアドレス（`editableEmailRecipient`）を編集可能なテキストフィールドとして表示する
  - 件名（`editableEmailSubject`）を編集可能なテキストフィールドとして表示する
  - 本文を既存の `RichTextEmailEditor` コンポーネントで表示・編集可能にする
  - 送信元アドレスを既存の `SenderAddressSelector` コンポーネントで選択できるようにする
  - 「送信」ボタン押下時に既存の `handleSendEmail` を呼び出す
  - 「キャンセル」ボタン押下時にダイアログを閉じる
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8_

- [x] 8. フロントエンド：メール送信結果のフィードバック処理を確認・接続
  - 既存の `handleSendEmail` が `POST /api/emails/by-seller-number/:propertyNumber/send-template-email` を呼び出すことを確認する
  - 送信成功時に成功スナックバーを表示し、ダイアログを閉じることを確認する
  - 送信失敗時にエラースナックバーを表示することを確認する
  - _Requirements: 3.6, 3.7_

- [x] 9. フロントエンド：送信元アドレスの永続化を確認・接続
  - `getSenderAddress()` を使用して前回保存された送信元アドレスを初期値として設定していることを確認する
  - `SenderAddressSelector` でアドレス変更時に `saveSenderAddress()` が呼び出されることを確認する
  - _Requirements: 4.1, 4.2_

  - [ ]* 9.1 送信元アドレスのラウンドトリップ プロパティテストを作成する
    - **Property 4: 送信元アドレスのラウンドトリップ**
    - **Validates: Requirements 4.1, 4.2**
    - fast-check を使用し、任意の有効なメールアドレスに対して `saveSenderAddress(addr)` → `getSenderAddress()` が同じアドレスを返すことを検証する（numRuns: 100）

- [x] 10. 最終チェックポイント — 全テストが通ることを確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## Notes

- `*` が付いたサブタスクはオプションであり、MVP優先の場合はスキップ可能
- 各タスクは対応する要件番号を参照している
- バックエンドの既存エンドポイント（`POST /api/email-templates/property/merge`、`POST /api/emails/by-seller-number/:propertyNumber/send-template-email`）は変更不要
- 既存コンポーネント（`RichTextEmailEditor`、`SenderAddressSelector`）は `PropertyListingDetailPage` に既にインポート済みのため、再インポート不要
