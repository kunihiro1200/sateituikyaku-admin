# 要件ドキュメント

## はじめに

物件リストの物件詳細画面（`PropertyListingDetailPage`）に、Email送信機能を追加する。
売主リストの通話モードページ（`CallModePage`）に実装済みの仕組みを流用し、物件詳細画面でも同様のEmail送信ができるようにする。

テンプレートはGoogle Spreadsheet（ID: `1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE`）のシート「テンプレート」から取得する。
フィルタ条件は以下の通り：
- C列「区分」が「物件」であるもの
- D列「種別」に「報告」という言葉が含まれないもの

---

## 用語集

- **PropertyListingDetailPage**: 物件リストの物件詳細画面（`/property-listings/:propertyNumber`）
- **EmailTemplateService**: バックエンドのEmailテンプレート取得・マージサービス（`backend/src/services/EmailTemplateService.ts`）
- **Email送信ボタン**: 物件詳細画面に追加するドロップダウン形式のボタン
- **テンプレートスプレッドシート**: ID `1sIBMhrarUSMcVWlTVVyaNNKaDxmfrxyHJLWv6U-MZxE` のシート「テンプレート」
- **物件テンプレート**: C列「区分」が「物件」のテンプレート行
- **非報告テンプレート**: D列「種別」に「報告」を含まないテンプレート
- **RichTextEmailEditor**: リッチテキスト形式でメール本文を編集するコンポーネント
- **SenderAddressSelector**: 送信元アドレスを選択するコンポーネント
- **seller_email**: `property_listings` テーブルの売主メールアドレスフィールド

---

## 要件

### 要件1：テンプレート取得APIの拡張

**ユーザーストーリー：** 開発者として、物件詳細画面向けに「報告」を除いた物件テンプレートを取得したい。そうすることで、物件詳細画面に適切なテンプレートのみを表示できる。

#### 受け入れ基準

1. THE `EmailTemplateService` SHALL テンプレートスプレッドシートのシート「テンプレート」からC列「区分」が「物件」の行を取得する
2. WHEN テンプレートを取得する際、THE `EmailTemplateService` SHALL D列「種別」に「報告」という文字列を含む行を除外する
3. THE バックエンド SHALL `GET /api/email-templates/property-non-report` エンドポイントを提供し、非報告の物件テンプレート一覧をJSON形式で返す
4. IF Google Sheets APIへの接続が失敗した場合、THEN THE バックエンド SHALL HTTPステータス500とエラーメッセージを返す

---

### 要件2：物件詳細画面へのEmail送信ボタン追加

**ユーザーストーリー：** 担当者として、物件詳細画面からEmail送信ボタンを操作したい。そうすることで、物件に関するメールを売主に送信できる。

#### 受け入れ基準

1. THE `PropertyListingDetailPage` SHALL 物件詳細画面の上部アクションエリアに「Email送信」ドロップダウンボタンを表示する
2. WHEN `seller_email` が空または未設定の場合、THE Email送信ボタン SHALL 非活性（disabled）状態で表示される
3. WHEN ユーザーがEmail送信ドロップダウンを開いた際、THE `PropertyListingDetailPage` SHALL `GET /api/email-templates/property-non-report` から取得したテンプレート一覧をメニュー項目として表示する
4. WHEN テンプレートの取得中、THE Email送信ドロップダウン SHALL ローディング状態（disabled）で表示される
5. WHEN ユーザーがテンプレートを選択した際、THE `PropertyListingDetailPage` SHALL `POST /api/email-templates/property/merge` を呼び出してプレースホルダーを置換した件名・本文を取得する
6. WHEN プレースホルダー置換が完了した際、THE `PropertyListingDetailPage` SHALL 確認ダイアログを表示し、送信先・件名・本文を編集可能な状態で表示する

---

### 要件3：Email送信確認ダイアログ

**ユーザーストーリー：** 担当者として、送信前にメール内容を確認・編集したい。そうすることで、誤送信を防ぎ、必要に応じて内容を調整できる。

#### 受け入れ基準

1. THE 確認ダイアログ SHALL 送信先メールアドレス（`seller_email`）を編集可能なテキストフィールドとして表示する
2. THE 確認ダイアログ SHALL 件名を編集可能なテキストフィールドとして表示する
3. THE 確認ダイアログ SHALL 本文を `RichTextEmailEditor` コンポーネントで編集可能な状態で表示する
4. THE 確認ダイアログ SHALL `SenderAddressSelector` コンポーネントで送信元アドレスを選択できるようにする
5. WHEN ユーザーが「送信」ボタンを押した際、THE `PropertyListingDetailPage` SHALL `POST /api/emails/by-seller-number/:propertyNumber/send-template-email` を呼び出してメールを送信する
6. WHEN メール送信が成功した際、THE `PropertyListingDetailPage` SHALL 成功スナックバーを表示し、ダイアログを閉じる
7. IF メール送信が失敗した場合、THEN THE `PropertyListingDetailPage` SHALL エラーメッセージをスナックバーで表示する
8. WHEN ユーザーが「キャンセル」ボタンを押した際、THE 確認ダイアログ SHALL 閉じる

---

### 要件4：送信元アドレスの永続化

**ユーザーストーリー：** 担当者として、前回使用した送信元アドレスを記憶してほしい。そうすることで、毎回アドレスを選択し直す手間を省ける。

#### 受け入れ基準

1. THE `PropertyListingDetailPage` SHALL `getSenderAddress()` ユーティリティを使用して、前回保存された送信元アドレスを初期値として設定する
2. WHEN ユーザーが送信元アドレスを変更した際、THE `PropertyListingDetailPage` SHALL `saveSenderAddress()` ユーティリティを使用してアドレスをローカルストレージに保存する

---

### 要件5：テンプレートのページロード時取得

**ユーザーストーリー：** 担当者として、物件詳細画面を開いた際にテンプレートが事前に読み込まれていてほしい。そうすることで、Email送信ボタンを押した際にすぐにテンプレート一覧が表示される。

#### 受け入れ基準

1. WHEN `PropertyListingDetailPage` がマウントされた際、THE `PropertyListingDetailPage` SHALL `GET /api/email-templates/property-non-report` を呼び出してテンプレートを事前取得する
2. IF テンプレートの取得が失敗した場合、THEN THE `PropertyListingDetailPage` SHALL エラーをコンソールに記録し、Email送信ボタンを非活性状態のまま維持する
