# 要件定義書

## はじめに

内覧詳細画面（BuyerDetailPage）のGmail送信ボタンから開くテンプレート選択モーダル（TemplateSelectionModal）において、問合せ物件の種別（property_type）に応じてテンプレートを表示・非表示にするフィルタリング機能を追加する。

現在、TemplateSelectionModalは `/api/email-templates` から取得した全テンプレートを表示しているが、物件種別に関係のないテンプレートが表示されることで、担当者が誤ったテンプレートを選択するリスクがある。本機能により、物件種別に適したテンプレートのみを表示し、業務効率と送信品質を向上させる。

## 用語集

- **TemplateSelectionModal**: テンプレート選択モーダルコンポーネント（`frontend/frontend/src/components/TemplateSelectionModal.tsx`）
- **BuyerGmailSendButton**: Gmail送信ボタンコンポーネント（`frontend/frontend/src/components/BuyerGmailSendButton.tsx`）
- **BuyerDetailPage**: 内覧詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **Template_Filter**: テンプレートフィルタリングロジック（TemplateSelectionModal内に実装）
- **property_type**: 紐づき物件の種別フィールド（`linkedProperties[0]?.property_type`）
- **テンプレート種別タグ**: テンプレート名の括弧（）内に記載された文字列（例：「内覧案内（戸建て）」の「戸建て」部分）
- **戸建て物件**: property_type が「戸」または「戸建て」の物件
- **土地物件**: property_type が「土」の物件
- **マンション物件**: property_type が「マ」または「マンション」の物件

---

## 要件

### 要件1：BuyerGmailSendButtonへの物件種別プロパティ追加

**ユーザーストーリー：** 担当者として、物件種別に応じたテンプレートのみを表示してほしい。そのために、BuyerDetailPageからBuyerGmailSendButtonへ物件種別情報を渡せるようにしたい。

#### 受け入れ基準

1. THE BuyerGmailSendButton SHALL `linkedPropertyType?: string` プロパティを受け取れるようにする
2. WHEN BuyerDetailPage が BuyerGmailSendButton をレンダリングするとき、THE BuyerDetailPage SHALL `linkedProperties[0]?.property_type` の値を `linkedPropertyType` プロパティとして渡す
3. WHEN `linkedProperties` が空配列または未定義のとき、THE BuyerDetailPage SHALL `linkedPropertyType` に `undefined` を渡す
4. THE BuyerGmailSendButton SHALL 受け取った `linkedPropertyType` を TemplateSelectionModal の `propertyType` プロパティに渡す

---

### 要件2：TemplateSelectionModalへの物件種別プロパティ追加

**ユーザーストーリー：** 担当者として、テンプレート選択モーダルが物件種別を認識し、適切なテンプレートのみを表示してほしい。

#### 受け入れ基準

1. THE TemplateSelectionModal SHALL `propertyType?: string` プロパティを受け取れるようにする
2. WHEN `propertyType` が未定義または空文字のとき、THE Template_Filter SHALL 全テンプレートを表示する（フィルタリングなし）
3. WHEN `propertyType` が定義されているとき、THE Template_Filter SHALL フィルタリングロジックを適用してテンプレートを絞り込む

---

### 要件3：戸建て物件のテンプレートフィルタリング

**ユーザーストーリー：** 担当者として、戸建て物件の内覧案内メールを送る際に、土地向けテンプレートが表示されないようにしたい。

#### 受け入れ基準

1. WHEN `propertyType` が「戸」または「戸建て」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「土」を含むテンプレートを非表示にする
2. WHEN `propertyType` が「戸」または「戸建て」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「土」を含まないテンプレートを表示する
3. WHEN `propertyType` が「戸」または「戸建て」のとき、THE Template_Filter SHALL テンプレート名に括弧（）が存在しないテンプレートを表示する

---

### 要件4：土地物件のテンプレートフィルタリング

**ユーザーストーリー：** 担当者として、土地物件の内覧案内メールを送る際に、戸建てやマンション向けテンプレートが表示されないようにしたい。

#### 受け入れ基準

1. WHEN `propertyType` が「土」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「戸」を含むテンプレートを非表示にする
2. WHEN `propertyType` が「土」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「マ」を含むテンプレートを非表示にする
3. WHEN `propertyType` が「土」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「戸」も「マ」も含まないテンプレートを表示する
4. WHEN `propertyType` が「土」のとき、THE Template_Filter SHALL テンプレート名に括弧（）が存在しないテンプレートを表示する

---

### 要件5：マンション物件のテンプレートフィルタリング

**ユーザーストーリー：** 担当者として、マンション物件の内覧案内メールを送る際に、土地向けテンプレートが表示されないようにしたい。

#### 受け入れ基準

1. WHEN `propertyType` が「マ」または「マンション」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「土」を含むテンプレートを非表示にする
2. WHEN `propertyType` が「マ」または「マンション」のとき、THE Template_Filter SHALL テンプレート名の括弧（）内に「土」を含まないテンプレートを表示する
3. WHEN `propertyType` が「マ」または「マンション」のとき、THE Template_Filter SHALL テンプレート名に括弧（）が存在しないテンプレートを表示する

---

### 要件6：テンプレート種別タグの抽出ロジック

**ユーザーストーリー：** 担当者として、テンプレート名の括弧内の文字を正確に判定してフィルタリングしてほしい。

#### 受け入れ基準

1. THE Template_Filter SHALL テンプレート名から全角括弧（）内の文字列を抽出する
2. THE Template_Filter SHALL テンプレート名から半角括弧()内の文字列を抽出する
3. WHEN テンプレート名に括弧が複数存在するとき、THE Template_Filter SHALL 全ての括弧内の文字列を対象として判定する
4. WHEN テンプレート名に括弧が存在しないとき、THE Template_Filter SHALL そのテンプレートを「種別タグなし」として扱い、常に表示する

---

### 要件7：フィルタリング結果の表示

**ユーザーストーリー：** 担当者として、フィルタリング後に表示可能なテンプレートがない場合に適切なメッセージを確認したい。

#### 受け入れ基準

1. WHEN フィルタリング後に表示可能なテンプレートが0件のとき、THE TemplateSelectionModal SHALL 「利用可能なテンプレートがありません」というメッセージを表示する
2. WHEN フィルタリングが適用されているとき、THE TemplateSelectionModal SHALL フィルタリング後のテンプレート一覧のみを表示する
3. THE TemplateSelectionModal SHALL フィルタリングロジックをクライアントサイドで実行する（APIへの追加リクエストは不要）
