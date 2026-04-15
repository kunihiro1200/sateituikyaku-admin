# 要件ドキュメント

## はじめに

買主リストのGmail送信機能において、内覧実施後に送る「内覧後御礼メール」テンプレートが存在しない。
本機能では、Googleスプレッドシートのテンプレートシートに「内覧後御礼メール」を追加し、
業者問合せ以外の全買主に対して内覧後のフォローアップメールを送信できるようにする。

### 現状の仕組み

- メールテンプレートはGoogleスプレッドシート（テンプレートシート）のC〜F列から取得する
  - C列: 区分（「買主」「売主」「物件」など）
  - D列: 種別（テンプレート名）
  - E列: 件名
  - F列: 本文
- フロントエンドの `TemplateSelectionModal.tsx` にある `filterTemplatesByConditions` 関数に、
  テンプレート名が「内覧後御礼メール」の場合に内覧日（`latestViewingDate`）が今日以前のときのみ表示するロジックが実装されている場合は**削除する**
- スプレッドシートに「内覧後御礼メール」という名前のテンプレートが存在しないため、現在は表示されない

## 用語集

- **Template_Sheet**: Googleスプレッドシート上のテンプレートシート（シート名: テンプレート）
- **EmailTemplateService**: バックエンドのサービスクラス。スプレッドシートからテンプレートを取得する
- **TemplateSelectionModal**: フロントエンドのテンプレート選択モーダルコンポーネント
- **filterTemplatesByConditions**: テンプレートを業者問合せ・内覧日などの条件でフィルタリングする関数
- **latestViewingDate**: 買主の内覧日（最新）フィールド
- **Buyer**: 買主（不動産購入希望者）
- **After_Visit_Template**: 内覧後御礼メールテンプレート

---

## 要件

### 要件1: 内覧後御礼メールテンプレートの追加

**ユーザーストーリー:** 担当者として、内覧を実施した買主に対して御礼メールを送りたい。そのため、Gmail送信のテンプレート一覧に「内覧後御礼メール」を追加してほしい。

#### 受け入れ基準

1. WHEN スプレッドシートのテンプレートシートに区分「買主」・種別「内覧後御礼メール」の行が追加された場合、THE EmailTemplateService SHALL そのテンプレートをスプレッドシートから取得して返す

2. WHEN 業者問合せ（brokerInquiry !== '業者問合せ'）の買主がGmail送信モーダルを開いた場合、THE TemplateSelectionModal SHALL テンプレート一覧に「内覧後御礼メール」を表示する

3. WHEN 担当者が「内覧後御礼メール」テンプレートを選択した場合、THE BuyerGmailSendButton SHALL 選択された物件データとプレースホルダーをマージしてメール編集画面を開く

4. THE After_Visit_Template SHALL 件名と本文に買主名・物件番号・物件住所などのプレースホルダーを含む

### 要件2: テンプレート表示条件の正確性

**ユーザーストーリー:** 担当者として、業者問合せの買主には御礼メールテンプレートが表示されないようにしたい。そのため、業者問合せフラグによる表示制御が正しく機能してほしい。

#### 受け入れ基準

1. WHEN 業者問合せ（brokerInquiry === '業者問合せ'）の場合、THE TemplateSelectionModal SHALL 「内覧後御礼メール」を表示しない

2. WHEN 業者問合せ以外の買主（内覧日の有無・日付に関わらず）がGmail送信モーダルを開いた場合、THE TemplateSelectionModal SHALL テンプレート一覧に「内覧後御礼メール」を表示する

3. IF `filterTemplatesByConditions` 関数に内覧日（latestViewingDate）による「内覧後御礼メール」の表示制御ロジックが存在する場合、THEN THE TemplateSelectionModal SHALL そのロジックを削除して内覧日に関係なく表示する

### 要件3: テンプレート本文の品質

**ユーザーストーリー:** 担当者として、内覧後御礼メールの本文が適切な内容であってほしい。そのため、テンプレートには必要な情報が含まれていてほしい。

#### 受け入れ基準

1. THE After_Visit_Template SHALL 買主への感謝の言葉を含む本文を持つ

2. THE After_Visit_Template SHALL 物件番号・物件住所のプレースホルダー（`<<物件番号>>`・`<<物件住所>>`など）を含む

3. THE After_Visit_Template SHALL 担当者署名のプレースホルダーを含む

4. IF テンプレートの件名または本文が空の場合、THEN THE EmailTemplateService SHALL そのテンプレートをスキップして返さない
