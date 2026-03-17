# 要件定義書

## はじめに

物件リスト詳細画面（PropertyListingDetailPage）において、売買価格を変更して保存した際に、値下げ履歴フィールドへ自動的に履歴を追記する機能。

スタッフが価格変更を保存するたびに、「誰が・いつ・いくらからいくらに変更したか」を値下げ履歴フィールドの先頭に自動追記することで、手動入力の手間を省き、履歴の記録漏れを防ぐ。

---

## 用語集

- **PriceSection**: 物件詳細画面の価格情報セクションを担当するReactコンポーネント（`frontend/frontend/src/components/PriceSection.tsx`）
- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **price_reduction_history**: 値下げ履歴フィールド（`property_listings`テーブルのカラム）
- **sales_price**: 売買価格フィールド（`property_listings`テーブルのカラム、円単位）
- **Employee**: ログイン中のスタッフ情報（`useAuthStore`から取得、`initials`フィールドを含む）
- **イニシャル**: スタッフの識別子（例: `K`、`Y`）。`Employee.initials`から取得
- **履歴エントリ**: 値下げ履歴の1行分のテキスト（例: `K3/17　1850万→1350万`）
- **PropertyListingService**: 物件リストのCRUD操作を担当するバックエンドサービス（`backend/src/services/PropertyListingService.ts`）

---

## 要件

### 要件1: 価格変更時の値下げ履歴自動生成

**ユーザーストーリー:** スタッフとして、売買価格を変更して保存した際に、値下げ履歴が自動的に追記されることを望む。手動で履歴を入力する手間を省き、記録漏れを防ぐため。

#### 受け入れ基準

1. WHEN 価格情報セクションの編集モードで売買価格（`sales_price`）が変更され、保存ボタンが押された場合、THE System SHALL 変更前の価格と変更後の価格を比較し、価格が異なる場合に限り履歴エントリを生成する

2. THE System SHALL 履歴エントリを以下のフォーマットで生成する: `{イニシャル}{月}/{日}　{変更前価格}万→{変更後価格}万`
   - `{イニシャル}`: ログイン中のスタッフの`Employee.initials`（例: `K`）
   - `{月}/{日}`: 変更を保存した日付（例: `3/17`）
   - `{変更前価格}万`: 変更前の`sales_price`を万円単位に変換した整数値（例: `1850万`）
   - `{変更後価格}万`: 変更後の`sales_price`を万円単位に変換した整数値（例: `1350万`）
   - 区切り文字は全角スペース（`　`）1つ

3. THE System SHALL 生成した履歴エントリを`price_reduction_history`フィールドの**先頭行**に追加し、既存の履歴は改行で区切って後続に保持する（最新の履歴が常に先頭に表示される）

4. WHEN `Employee.initials`が空または未設定の場合、THE System SHALL イニシャル部分を空文字として履歴エントリを生成する（例: `3/17　1850万→1350万`）

5. WHEN 売買価格が変更されていない（変更前と変更後が同じ値）場合、THE System SHALL 値下げ履歴への自動追記を行わない

6. WHEN 売買価格が`null`または未設定から有価格に変更された場合、THE System SHALL 変更前価格を`0万`として履歴エントリを生成する

7. WHEN 売買価格が有価格から`null`または未設定に変更された場合、THE System SHALL 値下げ履歴への自動追記を行わない

---

### 要件2: 価格変更の検出

**ユーザーストーリー:** スタッフとして、価格を変更した場合のみ履歴が追記されることを望む。価格以外のフィールドを変更した場合に不要な履歴が追記されないようにするため。

#### 受け入れ基準

1. THE System SHALL 価格情報セクションの保存処理（`handleSavePrice`）において、`editedData.sales_price`と保存前の`data.sales_price`を比較することで価格変更を検出する

2. WHEN 価格情報セクションで値下げ履歴（`price_reduction_history`）や値下げ予約日（`price_reduction_scheduled_date`）のみが変更され、売買価格が変更されていない場合、THE System SHALL 値下げ履歴への自動追記を行わない

3. THE System SHALL 自動生成した履歴エントリを`editedData`に含めた上で保存APIを呼び出す（手動編集した`price_reduction_history`と自動生成エントリを統合して保存する）

---

### 要件3: 万円単位への変換

**ユーザーストーリー:** スタッフとして、履歴が読みやすい万円単位で表示されることを望む。データベースは円単位で保存されているが、表示は万円単位が業務上の慣習であるため。

#### 受け入れ基準

1. THE System SHALL データベースの`sales_price`（円単位）を万円単位に変換する際、10,000で除算し小数点以下を切り捨てた整数値を使用する（例: `18,500,000円` → `1850万`）

2. WHEN 変換後の万円単位の値が0の場合（例: `sales_price`が9,999円以下）、THE System SHALL `0万`として表示する

3. THE System SHALL 万円単位への変換において、四捨五入ではなく切り捨てを使用する

---

### 要件4: スタッフのイニシャル取得

**ユーザーストーリー:** スタッフとして、自分のイニシャルが自動的に履歴に記録されることを望む。誰が価格変更を行ったかを追跡できるようにするため。

#### 受け入れ基準

1. THE System SHALL ログイン中のスタッフのイニシャルを`useAuthStore`の`employee.initials`から取得する

2. WHEN `employee`が`null`の場合（未ログイン状態）、THE System SHALL イニシャル部分を空文字として処理する

3. THE System SHALL イニシャルの取得にAPIリクエストを追加しない（既存の`useAuthStore`から同期的に取得する）

---

### 要件5: 既存の手動編集との共存

**ユーザーストーリー:** スタッフとして、自動追記と手動編集が競合しないことを望む。自動追記後も手動で履歴を編集できる柔軟性を保つため。

#### 受け入れ基準

1. WHEN 編集モードで値下げ履歴フィールドが手動編集され、かつ売買価格も変更された場合、THE System SHALL 手動編集済みの`price_reduction_history`の先頭に自動生成エントリを追加する

2. THE System SHALL 自動追記処理を`handleSavePrice`の保存API呼び出し前に実行し、`editedData`を更新する形で実装する

3. THE System SHALL 自動追記によって既存の値下げ履歴データが削除・上書きされないことを保証する
