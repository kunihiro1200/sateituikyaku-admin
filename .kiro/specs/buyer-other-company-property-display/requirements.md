# 要件定義書：買主リスト詳細画面の他社物件表示機能

## はじめに

買主リストの詳細画面において、スプレッドシートDJ列（「他社物件」）に値が入っている場合、物件詳細カードにその情報を表示する機能を実装します。これにより、買主が興味を持っている他社物件の情報を一目で確認できるようになります。

## 用語集

- **Buyer_Detail_Page**: 買主リスト詳細画面（`/buyers/:buyer_number`）
- **Property_Info_Card**: 物件詳細カード（`PropertyInfoCard`コンポーネント）
- **Other_Company_Property_Field**: スプレッドシートDJ列「他社物件」フィールド（データベースカラム名: `other_company_property`）
- **Building_Name_Price_Field**: スプレッドシートH列「建物名/価格 内覧物件は赤表示（★は他社物件）」フィールド（データベースカラム名: `building_name_price`）
- **Buyer_Table**: 買主テーブル（`buyers`）
- **Spreadsheet**: 買主リストスプレッドシート

## 要件

### 要件1: 他社物件情報の表示

**ユーザーストーリー**: 従業員として、買主詳細画面で買主が興味を持っている他社物件の情報を確認したい。

#### 受入基準

1. WHEN Other_Company_Property_Field に値が入っている、THE Property_Info_Card SHALL 「他社物件」セクションを表示する
2. THE 「他社物件」セクション SHALL 黄色の背景色（`#fff9e6`）で表示する
3. THE 「他社物件」セクション SHALL 「他社物件」というラベルを表示する
4. THE 「他社物件」セクション SHALL Building_Name_Price_Field の値を表示する
5. WHEN Other_Company_Property_Field が空である、THE Property_Info_Card SHALL 「他社物件」セクションを表示しない

### 要件2: データの同期

**ユーザーストーリー**: 従業員として、スプレッドシートで他社物件情報を更新したら、買主詳細画面にも即座に反映されてほしい。

#### 受入基準

1. WHEN Spreadsheet の DJ列（「他社物件」）に値を入力する、THE System SHALL Buyer_Table の `other_company_property` カラムに同期する
2. WHEN Spreadsheet の H列（「建物名/価格」）に値を入力する、THE System SHALL Buyer_Table の `building_name_price` カラムに同期する
3. THE System SHALL 既存のGAS同期処理（10分ごと）で同期を実行する
4. THE Buyer_Detail_Page SHALL 30秒ごとに買主データを再取得して最新情報を表示する

### 要件3: 表示位置

**ユーザーストーリー**: 従業員として、他社物件情報を物件詳細カードの目立つ位置で確認したい。

#### 受入基準

1. THE 「他社物件」セクション SHALL 物件詳細カードの「内覧前伝達事項」の直後に表示する
2. THE 「他社物件」セクション SHALL 物件の基本情報（種別、担当名など）の前に表示する
3. THE 「他社物件」セクション SHALL 全幅（`xs={12}`）で表示する

### 要件4: スタイリング

**ユーザーストーリー**: 従業員として、他社物件情報を視覚的に区別しやすい形で表示してほしい。

#### 受入基準

1. THE 「他社物件」セクション SHALL 黄色の背景色（`#fff9e6`）を使用する
2. THE 「他社物件」セクション SHALL ベージュの枠線（`1px solid #f0e5c0`）を使用する
3. THE 「他社物件」セクション SHALL 角丸（`borderRadius: 1`）を使用する
4. THE 「他社物件」セクション SHALL 内側の余白（`p: 2`）を持つ
5. THE ラベル「他社物件」 SHALL 太字（`fontWeight: bold`）で表示する
6. THE Building_Name_Price_Field の値 SHALL 改行を保持して表示する（`whiteSpace: 'pre-wrap'`）

### 要件5: データベーススキーマ

**ユーザーストーリー**: システムとして、他社物件情報を正しく保存・取得できる必要がある。

#### 受入基準

1. THE Buyer_Table SHALL `other_company_property` カラムを持つ（型: TEXT）
2. THE Buyer_Table SHALL `building_name_price` カラムを持つ（型: TEXT）
3. THE `other_company_property` カラム SHALL NULL を許可する
4. THE `building_name_price` カラム SHALL NULL を許可する

## 制約事項

- 既存のGAS同期処理を変更しない（10分ごとの同期を維持）
- 既存の物件詳細カードのレイアウトを大きく変更しない
- 既存のスプレッドシートのカラムマッピングを変更しない（DJ列とH列は既にマッピング済み）

## 非機能要件

- 他社物件情報の表示は1秒以内に完了すること
- 買主データの再取得は30秒ごとに実行すること
- 他社物件情報が長文の場合でも、レイアウトが崩れないこと

