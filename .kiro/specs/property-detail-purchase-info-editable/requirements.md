# 要件定義書

## はじめに

物件詳細画面（`PropertyListingDetailPage`）の「買付情報」セクションは、現在 `offer_date`・`offer_status`・`offer_amount`・`company_name`・`offer_comment` の5フィールドを表示専用で表示している。本機能では、これらのフィールドをすべて編集可能にし、他のセクション（価格情報・内覧情報など）と同様のインライン編集パターンを適用する。

バックエンドの PUT `/api/property-listings/:propertyNumber` エンドポイントおよびスプレッドシートへのカラムマッピングは既に実装済みであるため、フロントエンドの編集 UI 追加が主な実装範囲となる。

## 用語集

- **PropertyListingDetailPage**: 売主管理システムの物件詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **買付情報セクション**: 物件詳細画面内の「買付情報」を表示するセクション（`offer_date`・`offer_status`・`offer_amount`・`company_name`・`offer_comment` を含む）
- **EditableSection**: 各セクションに編集ボタン・保存ボタン・キャンセルボタンを提供する共通コンポーネント
- **isOfferEditMode**: 買付情報セクションの編集モードを管理する React state
- **offer_status**: 「買付」フィールドの値（例: 一般片手、専任両手など）
- **status**: 「状況」フィールドの値（例: 専任両手、売止めなど）
- **Property_Listing_API**: バックエンドの `PUT /api/property-listings/:propertyNumber` エンドポイント

## 要件

### 要件1: 買付情報セクションの編集モード切替

**ユーザーストーリー:** 担当者として、物件詳細画面の買付情報セクションを編集したい。そうすることで、買付状況をシステム上で直接更新できる。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL 買付情報セクションに「編集」ボタンを表示する
2. WHEN 「編集」ボタンがクリックされる, THE PropertyListingDetailPage SHALL isOfferEditMode を true に設定し、全フィールドを編集可能な入力コントロールに切り替える
3. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「保存」ボタンと「キャンセル」ボタンを表示する
4. WHEN 「キャンセル」ボタンがクリックされる, THE PropertyListingDetailPage SHALL editedData をリセットし isOfferEditMode を false に戻す
5. THE PropertyListingDetailPage SHALL 買付情報セクションを他のセクション（EditableSection コンポーネント）と同一のパターンで実装する

### 要件2: 「買付日」フィールドの編集

**ユーザーストーリー:** 担当者として、買付日を直接入力したい。そうすることで、買付が発生した日付を正確に記録できる。

#### 受け入れ基準

1. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「買付日」フィールドを `type="date"` の TextField として表示する
2. WHEN 「買付日」フィールドの値が変更される, THE PropertyListingDetailPage SHALL editedData.offer_date を更新する
3. WHILE isOfferEditMode が false である, THE PropertyListingDetailPage SHALL 「買付日」フィールドを読み取り専用テキストとして表示する

### 要件3: 「買付」フィールドの編集（ドロップダウン）

**ユーザーストーリー:** 担当者として、買付の種別をドロップダウンから選択したい。そうすることで、入力ミスなく正確な種別を記録できる。

#### 受け入れ基準

1. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「買付」フィールドを Select コンポーネントとして表示する
2. THE PropertyListingDetailPage SHALL 「買付」フィールドの選択肢として以下を提供する: 一般片手・専任片手・専任両手・一般両手・一般他決
3. WHEN 「買付」フィールドの値が変更される, THE PropertyListingDetailPage SHALL editedData.offer_status を更新する
4. WHILE isOfferEditMode が false である, THE PropertyListingDetailPage SHALL 「買付」フィールドを読み取り専用テキストとして表示する

### 要件4: 「状況」フィールドの編集（ドロップダウン）

**ユーザーストーリー:** 担当者として、物件の状況をドロップダウンから選択したい。そうすることで、物件の現在の取引状況を正確に管理できる。

#### 受け入れ基準

1. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「状況」フィールドを Select コンポーネントとして表示する
2. THE PropertyListingDetailPage SHALL 「状況」フィールドの選択肢として以下を提供する: 専任両手・専任片手・一般両手・一般片手・一般他決・他社物件片手・自社買取（リースバック）・非公開→公開・一般媒介解除・専任解除・売止め・国広収益・自社買取（転売）・買取紹介（片手）・買取紹介（両手）・契約書作成済み・自社売主（元リースバック）・自社売主（元転売目的）・専任→一般媒介
3. WHEN 「状況」フィールドの値が変更される, THE PropertyListingDetailPage SHALL editedData.status を更新する
4. WHILE isOfferEditMode が false である, THE PropertyListingDetailPage SHALL 「状況」フィールドを読み取り専用テキストとして表示する

### 要件5: 「金額」フィールドの編集

**ユーザーストーリー:** 担当者として、買付金額を直接入力したい。そうすることで、買付提示額を正確に記録できる。

#### 受け入れ基準

1. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「金額」フィールドを TextField として表示する
2. WHEN 「金額」フィールドの値が変更される, THE PropertyListingDetailPage SHALL editedData.offer_amount を更新する
3. WHILE isOfferEditMode が false である, THE PropertyListingDetailPage SHALL 「金額」フィールドを読み取り専用テキストとして表示する

### 要件6: 「会社名」フィールドの編集

**ユーザーストーリー:** 担当者として、買付を提出した会社名を直接入力したい。そうすることで、取引先情報を正確に記録できる。

#### 受け入れ基準

1. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「会社名」フィールドを TextField として表示する
2. WHEN 「会社名」フィールドの値が変更される, THE PropertyListingDetailPage SHALL editedData.company_name を更新する
3. WHILE isOfferEditMode が false である, THE PropertyListingDetailPage SHALL 「会社名」フィールドを読み取り専用テキストとして表示する

### 要件7: 「買付コメント」フィールドの編集

**ユーザーストーリー:** 担当者として、買付に関するコメントを直接入力したい。そうすることで、買付の詳細情報を記録できる。

#### 受け入れ基準

1. WHILE isOfferEditMode が true である, THE PropertyListingDetailPage SHALL 「買付コメント」フィールドを multiline TextField として表示する
2. WHEN 「買付コメント」フィールドの値が変更される, THE PropertyListingDetailPage SHALL editedData.offer_comment を更新する
3. WHILE isOfferEditMode が false である, THE PropertyListingDetailPage SHALL 「買付コメント」フィールドを読み取り専用テキストとして表示する

### 要件8: 買付情報の保存

**ユーザーストーリー:** 担当者として、編集した買付情報を保存したい。そうすることで、変更内容がデータベースとスプレッドシートに反映される。

#### 受け入れ基準

1. WHEN 「保存」ボタンがクリックされる, THE PropertyListingDetailPage SHALL `PUT /api/property-listings/:propertyNumber` に editedData を送信する
2. WHEN 保存が成功する, THE PropertyListingDetailPage SHALL 成功スナックバーを表示し、isOfferEditMode を false にし、画面データを再取得する
3. IF 保存が失敗する, THEN THE PropertyListingDetailPage SHALL エラースナックバーを表示し、編集モードを維持する
4. WHEN 「保存」ボタンがクリックされる, THE PropertyListingDetailPage SHALL editedData が空の場合は保存処理を実行しない

### 要件9: 買付情報セクションの常時表示

**ユーザーストーリー:** 担当者として、買付情報セクションを常に表示したい。そうすることで、データが未入力の場合でも編集できる。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL 買付情報セクションを `offer_date`・`offer_status`・`offer_amount` の値に関わらず常に表示する
2. WHILE isOfferEditMode が false であり、かつ全フィールドが空である, THE PropertyListingDetailPage SHALL 各フィールドに「-」を表示する
