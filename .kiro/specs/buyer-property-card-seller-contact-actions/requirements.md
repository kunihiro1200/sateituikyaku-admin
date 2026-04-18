# 要件定義書

## はじめに

買主詳細画面（BuyerDetailPage）内の「物件詳細カード」（PropertyInfoCard）に表示される売主情報セクションに対して、以下の3つのアクション機能を追加する。

1. **連絡先クリックで電話発信**：売主の連絡先をクリックすると `tel:` リンクで電話発信できる
2. **メールアドレス横のメール送信ボタン**：物件リスト詳細画面（PropertyListingDetailPage）のヘッダーにある「Email送信」ボタンと同じテンプレート選択モーダルを表示してメールを送信できる
3. **送信履歴への記録**：電話発信・メール送信いずれも、対象物件の物件詳細画面（PropertyListingDetailPage）左列の「売主・物件の送信履歴」（SellerSendHistory）に記録を残す

## 用語集

- **PropertyInfoCard**: 買主詳細画面内に表示される物件詳細カードコンポーネント（`frontend/frontend/src/components/PropertyInfoCard.tsx`）
- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **PropertyListingDetailPage**: 物件リストの物件詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **SellerSendHistory**: 物件詳細画面左列に表示される「売主・物件の送信履歴」コンポーネント（`frontend/frontend/src/components/SellerSendHistory.tsx`）
- **seller_contact**: 売主の連絡先（電話番号）フィールド（`property_listings` テーブル）
- **seller_email**: 売主のメールアドレスフィールド（`property_listings` テーブル）
- **seller_send_history API**: 送信履歴を保存するAPIエンドポイント（`POST /api/property-listings/:propertyNumber/seller-send-history`）
- **property_chat_history**: 送信履歴を格納するDBテーブル（`chat_type` が `seller_email` / `seller_sms` / `seller_gmail` のレコードが対象）
- **Email送信ダイアログ**: PropertyListingDetailPage のヘッダーにある「Email送信」ボタンをクリックすると表示されるメール送信モーダル（テンプレート選択 → 件名・本文編集 → 送信）
- **propertyEmailTemplates**: 物件テンプレート（非報告）一覧（`GET /api/email-templates/property-non-report` で取得）

---

## 要件

### 要件1: 連絡先クリックで電話発信

**ユーザーストーリー:** 担当者として、買主詳細画面の物件詳細カード内の売主連絡先をクリックして電話発信したい。そうすることで、物件リストを別タブで開かずに素早く売主に電話できる。

#### 受け入れ基準

1. WHEN `seller_contact` が存在する場合、THE PropertyInfoCard SHALL 連絡先テキストを `tel:` リンクとしてレンダリングする
2. WHEN ユーザーが連絡先リンクをクリックした場合、THE PropertyInfoCard SHALL デバイスの電話発信機能を起動する（`window.location.href = 'tel:{seller_contact}'`）
3. WHEN 電話発信が実行された場合、THE PropertyInfoCard SHALL `seller_send_history API` を呼び出して `chat_type: 'seller_sms'`、`subject: '電話発信'`、`message: seller_contact の値`、`sender_name: ログインユーザー名` で送信履歴を記録する
4. IF `seller_contact` が存在しない場合、THEN THE PropertyInfoCard SHALL 連絡先フィールドを通常のテキストとして表示する（リンク化しない）
5. WHEN 送信履歴の記録に失敗した場合、THE PropertyInfoCard SHALL コンソールにエラーを記録し、電話発信自体は成功として扱う（ユーザーへのエラー表示は行わない）

---

### 要件2: メールアドレス横のメール送信ボタン

**ユーザーストーリー:** 担当者として、買主詳細画面の物件詳細カード内のメールアドレス横にあるメール送信ボタンをクリックして、物件リスト詳細画面と同じテンプレートでメールを送信したい。そうすることで、物件リストを別タブで開かずに素早く売主にメールを送れる。

#### 受け入れ基準

1. WHEN `seller_email` が存在する場合、THE PropertyInfoCard SHALL メールアドレスの隣にメール送信ボタン（EmailIcon）を表示する
2. WHEN ユーザーがメール送信ボタンをクリックした場合、THE PropertyInfoCard SHALL `GET /api/email-templates/property-non-report` を呼び出して物件テンプレート一覧を取得する
3. WHEN 物件テンプレート一覧の取得が完了した場合、THE PropertyInfoCard SHALL テンプレート選択メニューを表示する
4. WHEN ユーザーがテンプレートを選択した場合、THE PropertyInfoCard SHALL `POST /api/email-templates/property/merge` を呼び出してプレースホルダーを置換した件名・本文を取得し、メール送信ダイアログを開く
5. THE メール送信ダイアログ SHALL 送信元アドレス選択、返信先（Reply-To）選択、送信先（seller_email）、件名、本文（RichTextEmailEditor）、画像添付の各フィールドを含む
6. WHEN ユーザーが「送信」ボタンをクリックした場合、THE PropertyInfoCard SHALL `POST /api/emails/by-seller-number/{propertyNumber}/send-template-email` を呼び出してメールを送信する
7. WHEN メール送信が成功した場合、THE PropertyInfoCard SHALL `seller_send_history API` を呼び出して `chat_type: 'seller_email'`、`subject: 選択したテンプレート名または件名`、`message: メール本文`、`sender_name: ログインユーザー名` で送信履歴を記録する
8. IF `seller_email` が存在しない場合、THEN THE PropertyInfoCard SHALL メール送信ボタンを表示しない
9. WHEN メール送信が失敗した場合、THE PropertyInfoCard SHALL エラーメッセージをスナックバーで表示する
10. WHEN 送信履歴の記録に失敗した場合、THE PropertyInfoCard SHALL コンソールにエラーを記録し、メール送信自体は成功として扱う

---

### 要件3: 送信履歴への記録

**ユーザーストーリー:** 担当者として、買主詳細画面から電話発信・メール送信した記録を物件詳細画面の「売主・物件の送信履歴」で確認したい。そうすることで、売主とのコミュニケーション履歴を一元管理できる。

#### 受け入れ基準

1. WHEN 電話発信が実行された場合、THE PropertyInfoCard SHALL `POST /api/property-listings/{propertyNumber}/seller-send-history` に `chat_type: 'seller_sms'`、`subject: '電話発信'`、`message: seller_contact の値`、`sender_name: ログインユーザー名` を送信する
2. WHEN メール送信が成功した場合、THE PropertyInfoCard SHALL `POST /api/property-listings/{propertyNumber}/seller-send-history` に `chat_type: 'seller_email'`、`subject: 選択したテンプレート名または件名`、`message: メール本文`、`sender_name: ログインユーザー名` を送信する
3. THE seller_send_history API SHALL 受け取ったデータを `property_chat_history` テーブルに挿入する（既存APIを再利用）
4. WHEN 送信履歴が記録された場合、THE SellerSendHistory SHALL 物件詳細画面（PropertyListingDetailPage）の左列で最新の履歴を表示する（既存の `refreshTrigger` 機構は PropertyInfoCard 側では不要。物件詳細画面を次回開いた際に自動的に反映される）
5. THE PropertyInfoCard SHALL 送信履歴の記録に使用する `propertyNumber` を、表示中の物件の `property_number` フィールドから取得する

---

### 要件4: PropertyInfoCard へのログインユーザー情報の受け渡し

**ユーザーストーリー:** 担当者として、送信履歴に正確な送信者名が記録されるようにしたい。そうすることで、誰が電話・メールを行ったか追跡できる。

#### 受け入れ基準

1. THE PropertyInfoCard SHALL `useAuthStore` フックを使用してログインユーザー情報（`employee`）を取得する
2. WHEN 送信履歴を記録する場合、THE PropertyInfoCard SHALL `employee?.name || employee?.initials || '不明'` を `sender_name` として使用する
3. THE PropertyInfoCard SHALL 既存の `PropertyInfoCardProps` インターフェースを変更せずに、コンポーネント内部で `useAuthStore` を呼び出す

---

### 要件5: メール送信ダイアログの状態管理

**ユーザーストーリー:** 担当者として、メール送信ダイアログを正しく開閉・操作できるようにしたい。そうすることで、誤送信を防ぎながら効率的にメールを送れる。

#### 受け入れ基準

1. THE PropertyInfoCard SHALL メール送信ダイアログの開閉状態（`emailDialogOpen`）、件名（`emailSubject`）、本文（`emailBody`）、送信先（`emailRecipient`）、選択テンプレート名（`selectedTemplateName`）、送信中フラグ（`sendingEmail`）を内部 state として管理する
2. WHEN ユーザーが「キャンセル」ボタンをクリックした場合、THE PropertyInfoCard SHALL ダイアログを閉じてすべての入力値をリセットする
3. WHEN ダイアログが開いている間、THE PropertyInfoCard SHALL 送信先フィールドを `seller_email` の値で初期化する
4. THE PropertyInfoCard SHALL 送信元アドレスを `localStorage` から取得・保存する（`getSenderAddress` / `saveSenderAddress` ユーティリティを使用）
5. WHERE 事務ありスタッフ一覧（jimuStaff）が必要な場合、THE PropertyInfoCard SHALL `GET /api/employees/jimu-staff` を呼び出して返信先（Reply-To）の選択肢を取得する
