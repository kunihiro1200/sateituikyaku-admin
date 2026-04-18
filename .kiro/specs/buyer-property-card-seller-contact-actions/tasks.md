# 実装計画: 買主詳細画面 物件カード 売主連絡アクション

## 概要

`PropertyInfoCard.tsx` のみを変更し、売主情報セクションに電話発信リンクとメール送信ボタンを追加する。
バックエンドAPIはすべて既存のものを再利用する。

## タスク

- [x] 1. PropertyInfoCard.tsx に必要な state・import・型定義を追加する
  - `PropertyFullDetails` インターフェースに `seller_email` と `seller_name` フィールドを追加する
  - `useAuthStore` を import してコンポーネント内で `employee` を取得する
  - メール送信ダイアログ関連の state を追加する（`emailDialogOpen`, `emailSubject`, `emailBody`, `emailRecipient`, `selectedTemplateName`, `sendingEmail`）
  - テンプレートメニュー関連の state を追加する（`propertyEmailTemplates`, `templateMenuAnchor`）
  - 送信元・返信先関連の state を追加する（`senderAddress`, `replyTo`, `jimuStaff`）
  - 画像添付関連の state を追加する（`selectedImages`, `showImageSelector`）
  - MUI コンポーネント（`Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`, `FormControl`, `InputLabel`, `Select`, `MenuItem`, `Menu`, `Chip`）を import に追加する
  - アイコン（`EmailIcon`, `PhoneIcon`）を import に追加する
  - `getSenderAddress`, `saveSenderAddress`, `RichTextEmailEditor`, `SenderAddressSelector`, `ImageSelectorModal` を import に追加する
  - `propertyListingApi` を api import に追加する
  - _要件: 4.1, 4.3, 5.1, 5.4_

- [x] 2. 電話発信機能を実装する
  - [x] 2.1 `handlePhoneCall` ハンドラーを実装する
    - `window.location.href = 'tel:{phoneNumber}'` で電話発信する
    - `POST /api/property-listings/{propertyNumber}/seller-send-history` を呼び出して送信履歴を記録する（`chat_type: 'seller_sms'`, `subject: '電話発信'`, `message: seller_contact の値`, `sender_name: employee?.name || employee?.initials || '不明'`）
    - 送信履歴の保存失敗時は `console.error` に記録するのみ（ユーザーへのエラー表示なし）
    - _要件: 1.2, 1.3, 1.5, 3.1, 3.5_
  - [x] 2.2 売主情報セクションの `seller_contact` 表示を `tel:` リンクに変更する
    - `seller_contact` が存在する場合は `<Link href={'tel:' + property.seller_contact}>` でレンダリングする
    - `seller_contact` が存在しない場合は通常テキストのまま表示する
    - リンクの `onClick` に `handlePhoneCall` を呼び出す処理を追加する
    - _要件: 1.1, 1.4_

- [x] 3. メール送信機能を実装する
  - [x] 3.1 `fetchJimuStaff` 関数を実装して `useEffect` で呼び出す
    - `GET /api/employees/jimu-staff` を呼び出して `jimuStaff` state にセットする
    - _要件: 5.5_
  - [x] 3.2 `handleEmailButtonClick` ハンドラーを実装する
    - `GET /api/email-templates/property-non-report` を呼び出してテンプレート一覧を取得する
    - 取得成功時はテンプレート選択メニューを表示する（`templateMenuAnchor` をセット）
    - 取得失敗時はスナックバーでエラーを表示する
    - _要件: 2.2, 2.3_
  - [x] 3.3 `handleSelectTemplate` ハンドラーを実装する
    - `POST /api/email-templates/property/merge` を呼び出してプレースホルダーを置換した件名・本文を取得する
    - 取得成功時はメール送信ダイアログを開く（`emailDialogOpen: true`, `emailSubject`, `emailBody`, `emailRecipient` を `seller_email` でセット）
    - 取得失敗時はスナックバーでエラーを表示する
    - _要件: 2.4, 5.3_
  - [x] 3.4 `handleSendEmail` ハンドラーを実装する
    - `POST /api/emails/by-seller-number/{propertyNumber}/send-template-email` を呼び出してメールを送信する
    - 送信成功時は `POST /api/property-listings/{propertyNumber}/seller-send-history` を呼び出して送信履歴を記録する（`chat_type: 'seller_email'`, `subject: selectedTemplateName または件名`, `message: メール本文`, `sender_name: employee?.name || employee?.initials || '不明'`）
    - 送信失敗時はスナックバーでエラーを表示する（`error.response?.data?.error?.message` を優先）
    - 送信履歴の保存失敗時は `console.error` に記録するのみ
    - _要件: 2.6, 2.7, 2.9, 2.10, 3.2_
  - [x] 3.5 `handleEmailDialogClose` ハンドラーを実装する
    - ダイアログを閉じてすべての入力値をリセットする（`emailDialogOpen: false`, `emailSubject: ''`, `emailBody: ''`, `emailRecipient: ''`, `selectedTemplateName: ''`, `selectedImages: []`）
    - _要件: 5.2_
  - [x] 3.6 売主情報セクションの `seller_email` 横にメール送信ボタンを追加する
    - `seller_email` が存在する場合のみ `EmailIcon` ボタンを表示する
    - ボタンの `onClick` に `handleEmailButtonClick` を設定する
    - `seller_email` が存在しない場合はボタンを表示しない
    - _要件: 2.1, 2.8_

- [x] 4. メール送信ダイアログ・テンプレートメニューのJSXを追加する
  - テンプレート選択 `Menu` コンポーネントを追加する（`templateMenuAnchor` で開閉制御）
  - メール送信 `Dialog` コンポーネントを追加する（送信元アドレス選択 `SenderAddressSelector`、返信先選択、送信先フィールド、件名フィールド、本文 `RichTextEmailEditor`、画像添付 `ImageSelectorModal` を含む）
  - `ImageSelectorModal` を条件付きでレンダリングする（`showImageSelector` で制御）
  - _要件: 2.5, 5.1, 5.4_

- [x] 5. チェックポイント - 全テストが通ることを確認する
  - `getDiagnostics` で TypeScript エラーがないことを確認する
  - 電話発信リンクが正しくレンダリングされることを確認する
  - メール送信ボタンが `seller_email` の有無に応じて表示・非表示になることを確認する
  - ユーザーに動作確認を依頼する（疑問点があれば質問する）

## 備考

- `*` 付きのサブタスクはオプションのため、今回は存在しない（設計ドキュメントにCorrectness Propertiesセクションがないため、PBTは適用しない）
- 変更対象ファイルは `frontend/frontend/src/components/PropertyInfoCard.tsx` のみ
- バックエンド変更は不要（既存APIを再利用）
- `propertyNumber` は `property.property_number` から取得する（要件 3.5）
- 送信元アドレスは `localStorage` から取得・保存する（`getSenderAddress` / `saveSenderAddress`）
