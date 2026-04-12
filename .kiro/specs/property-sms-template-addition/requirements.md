# 要件ドキュメント

## はじめに

物件リストの物件詳細画面において、既存のEmail送信テンプレート（「内覧問合せ」「空」）と同等の内容を、SMS送信でも利用できるようにする機能追加。SMS送信の署名欄は「株式会社いふう」のみとする。

現状、物件詳細画面のヘッダー部には「SMS」ボタンが存在するが、テンプレートなしで直接SMSアプリを起動するのみである。本機能追加により、Email送信と同様にテンプレートを選択してSMS本文を事前に生成・確認してから送信できるようにする。

## 用語集

- **PropertyListingDetailPage**: 物件リストの物件詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **SMS送信テンプレート**: SMS本文の雛形。物件情報・売主情報のプレースホルダーを含む
- **内覧問合せテンプレート**: 内覧の問い合わせを行う際のSMS本文テンプレート
- **空テンプレート**: 本文が空の状態で送信ダイアログを開くテンプレート
- **署名**: SMS本文末尾に付与する会社名。「株式会社いふう」固定
- **seller_contact**: 売主の電話番号（`property_listings`テーブルのカラム）
- **SellerSendHistory**: 売主への送信履歴コンポーネント（`SellerSendHistory`）
- **propertyListingApi**: 物件詳細画面で使用するAPIクライアント

---

## 要件

### 要件1: SMS送信テンプレート選択UI

**ユーザーストーリー:** 担当者として、物件詳細画面からSMS送信テンプレートを選択したい。そうすることで、定型文を素早く送信できる。

#### 受け入れ基準

1. WHEN 売主の電話番号（`seller_contact`）が存在する場合、THE PropertyListingDetailPage SHALL 「SMS送信」ボタンをドロップダウン形式で表示する
2. WHEN 「SMS送信」ドロップダウンを開いた場合、THE PropertyListingDetailPage SHALL 「内覧問合せ」と「空」の2つのテンプレート選択肢を表示する
3. WHEN 売主の電話番号（`seller_contact`）が存在しない場合、THE PropertyListingDetailPage SHALL 「SMS送信」ボタンを非表示または非活性にする
4. THE PropertyListingDetailPage SHALL 既存の「SMS」ボタン（直接SMSアプリ起動）を「SMS送信」ドロップダウンボタンに置き換える

### 要件2: SMS本文の生成

**ユーザーストーリー:** 担当者として、テンプレートを選択したときにSMS本文が自動生成されることを期待する。そうすることで、手入力の手間を省ける。

#### 受け入れ基準

1. WHEN 「内覧問合せ」テンプレートを選択した場合、THE PropertyListingDetailPage SHALL 内覧問い合わせ用の定型文（物件情報・署名「株式会社いふう」を含む）をSMS本文として生成する
2. WHEN 「空」テンプレートを選択した場合、THE PropertyListingDetailPage SHALL 署名「株式会社いふう」のみを含む空のSMS本文を生成する
3. THE PropertyListingDetailPage SHALL SMS本文の末尾に署名「株式会社いふう」を付与する
4. WHEN SMS本文が生成された場合、THE PropertyListingDetailPage SHALL 送信前に本文を確認・編集できるダイアログを表示する

### 要件3: SMS送信の実行

**ユーザーストーリー:** 担当者として、生成されたSMS本文を確認してから送信したい。そうすることで、誤送信を防げる。

#### 受け入れ基準

1. WHEN SMS送信確認ダイアログで「送信」を実行した場合、THE PropertyListingDetailPage SHALL `sms:{seller_contact}?body={encodedBody}` 形式でSMSアプリを起動する
2. WHEN SMS送信を実行した場合、THE PropertyListingDetailPage SHALL 売主への送信履歴（`seller_sms`タイプ）を保存する
3. WHEN 送信履歴の保存に失敗した場合、THE PropertyListingDetailPage SHALL SMS送信自体は成功として扱い、エラーをコンソールに記録する
4. WHEN SMS送信を実行した場合、THE PropertyListingDetailPage SHALL `sellerSendHistoryRefreshTrigger`を更新して送信履歴表示を最新化する

### 要件4: SMS送信テンプレートの定義

**ユーザーストーリー:** 担当者として、Email送信テンプレートと同等の内容をSMSでも利用したい。そうすることで、チャネルに関わらず一貫したコミュニケーションができる。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL 「内覧問合せ」テンプレートの本文に、物件所在地（`address`または`display_address`）を含める
2. THE PropertyListingDetailPage SHALL 「内覧問合せ」テンプレートの本文に、売主氏名（`seller_name`）への呼びかけを含める
3. THE PropertyListingDetailPage SHALL 全SMSテンプレートの署名を「株式会社いふう」のみとする（Emailテンプレートの署名とは独立して管理する）
4. WHERE 売主氏名（`seller_name`）が存在する場合、THE PropertyListingDetailPage SHALL SMS本文に売主氏名を差し込む
5. IF 売主氏名（`seller_name`）が存在しない場合、THEN THE PropertyListingDetailPage SHALL 売主氏名部分を空文字または「オーナー」として代替する

### 要件5: 送信履歴の記録

**ユーザーストーリー:** 担当者として、SMS送信の履歴を確認したい。そうすることで、過去の連絡状況を把握できる。

#### 受け入れ基準

1. WHEN SMS送信テンプレートを使用して送信した場合、THE PropertyListingDetailPage SHALL 送信履歴に使用したテンプレート名（「内覧問合せ」または「空」）を記録する
2. WHEN SMS送信テンプレートを使用して送信した場合、THE PropertyListingDetailPage SHALL 送信履歴に送信者名（`employee.name`または`employee.initials`）を記録する
3. THE PropertyListingDetailPage SHALL SMS送信履歴を`SellerSendHistory`コンポーネントに表示する
