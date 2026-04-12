# 実装計画: 物件詳細画面SMS送信テンプレート追加

## 概要

`smsTemplates.ts` を新規作成してSMS本文生成ロジックを実装し、`PropertyListingDetailPage.tsx` の既存「SMS」ボタンをドロップダウン形式の「SMS送信」ボタンに置き換える。

## タスク

- [x] 1. SMSテンプレートユーティリティの作成
  - `frontend/frontend/src/utils/smsTemplates.ts` を新規作成する
  - `SmsTemplateId` 型（`'viewing_inquiry' | 'empty'`）と `SmsTemplate` インターフェースを定義する
  - `smsTemplates` 配列（「内覧問合せ」「空」の2件）を定義する
  - `generateSmsBody(templateId, params)` 純粋関数を実装する
    - 「内覧問合せ」: `{sellerName}様\n\nお世話になっております。\n{address}の内覧についてご連絡させていただきました。\nご都合のよい日時をお知らせいただけますでしょうか。\n\n株式会社いふう`
    - 「空」: `株式会社いふう`
    - `sellerName` が null/undefined の場合は「オーナー」で代替する（要件4.5）
    - `address` が null/undefined の場合は空文字で代替する
  - _要件: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 1.1 プロパティテスト: 全テンプレートに署名が付与される
    - `// Feature: property-sms-template-addition, Property 1: 全テンプレートに署名が付与される`
    - fast-check で `fc.constantFrom('viewing_inquiry', 'empty')` と任意の params を生成し、`generateSmsBody` の戻り値が `'株式会社いふう'` を含むことを検証する（100イテレーション）
    - **Property 1: 全テンプレートに署名が付与される**
    - **Validates: Requirements 2.3, 4.3**

  - [ ]* 1.2 プロパティテスト: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる
    - `// Feature: property-sms-template-addition, Property 2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる`
    - fast-check で `fc.string({ minLength: 1 })` を2つ生成し、`generateSmsBody('viewing_inquiry', { address, sellerName })` の戻り値が両方を含むことを検証する（100イテレーション）
    - **Property 2: 内覧問合せテンプレートに物件所在地と売主氏名が含まれる**
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [ ]* 1.3 プロパティテスト: SMS URIが正しい形式で生成される
    - `// Feature: property-sms-template-addition, Property 3: SMS URIが正しい形式で生成される`
    - fast-check で任意の電話番号文字列と本文文字列を生成し、`sms:{phone}?body=${encodeURIComponent(body)}` の形式に従うことを検証する（100イテレーション）
    - **Property 3: SMS URIが正しい形式で生成される**
    - **Validates: Requirements 3.1**

  - [ ]* 1.4 プロパティテスト: 送信履歴にテンプレート名と送信者名が記録される
    - `// Feature: property-sms-template-addition, Property 4: 送信履歴にテンプレート名と送信者名が記録される`
    - fast-check で任意のテンプレートIDと `{ name, initials }` を生成し、`subject` がテンプレート名と一致し `sender_name` が `employee.name || employee.initials || '不明'` と一致することを検証する（100イテレーション）
    - **Property 4: 送信履歴にテンプレート名と送信者名が記録される**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 1.5 ユニットテスト: `generateSmsBody` のエッジケース
    - `sellerName` が null の場合に「オーナー」で代替されることを確認する
    - `address` が null の場合に空文字で代替されることを確認する
    - 「空」テンプレートが署名のみを返すことを確認する
    - _要件: 4.5_

- [x] 2. チェックポイント — テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 3. PropertyListingDetailPage.tsx の状態・ハンドラ追加
  - **注意: 日本語を含むファイルのため、Pythonスクリプトで変更を適用すること（エンコーディング保護ルール）**
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` に以下の状態を追加する
    - `smsTemplateMenuAnchor: null | HTMLElement`
    - `smsDialog: { open: boolean; body: string; templateName: string }`
  - `handleSelectSmsTemplate(templateId: SmsTemplateId)` ハンドラを追加する
    - `generateSmsBody` を呼び出してSMS本文を生成する
    - `smsDialog` を開く
    - `smsTemplateMenuAnchor` を閉じる
  - `handleSendSms()` 非同期ハンドラを追加する
    - `window.location.href = sms:{seller_contact}?body={encodeURIComponent(body)}` でSMSアプリを起動する（要件3.1）
    - `saveSellerSendHistory` を `chat_type: 'seller_sms'` で呼び出す（要件3.2）
    - 履歴保存失敗時は `console.error` でログ記録し、SMS送信自体は成功として扱う（要件3.3）
    - `sellerSendHistoryRefreshTrigger` を更新する（要件3.4）
    - `smsDialog` を閉じる
  - _要件: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2_

- [x] 4. PropertyListingDetailPage.tsx のUI置き換え
  - **注意: 日本語を含むファイルのため、Pythonスクリプトで変更を適用すること（エンコーディング保護ルール）**
  - 既存の「SMS」ボタン（直接SMSアプリ起動）を削除する（要件1.4）
  - `seller_contact` が存在する場合のみ「SMS送信」ドロップダウンボタンを表示する（要件1.1, 1.3）
  - ドロップダウンメニューに「内覧問合せ」「空」の2つの選択肢を表示する（要件1.2）
  - SMS確認ダイアログを追加する（要件2.4）
    - 生成されたSMS本文を表示・編集できる `TextField` を配置する
    - 「送信」ボタンで `handleSendSms` を呼び出す
    - 「キャンセル」ボタンでダイアログを閉じる
  - _要件: 1.1, 1.2, 1.3, 1.4, 2.4_

- [x] 5. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- 各タスクは要件との対応を明示している
- 日本語を含むファイル（`PropertyListingDetailPage.tsx`）の編集はPythonスクリプトを使用すること
- プロパティテストは `fast-check` を使用し、各テストに `// Feature: property-sms-template-addition, Property N: ...` タグコメントを付与すること
