# 要件定義書

## はじめに

本機能は、物件の「買付状況」を関連する画面の目立つ位置に赤字で表示するものです。買付が入っている物件を担当者が一目で把握できるようにすることで、対応漏れや誤った案内を防ぎます。

表示条件は2種類あります：
- **条件1（買主側）**: 買主リストの `latest_status`（最新状況）フィールドに「買」という文字が含まれている場合
- **条件2（物件側）**: 物件リストの `offer_status`（買付フィールド）に何らかの値が入っている場合

## 用語集

- **System**: 本フロントエンドアプリケーション全体
- **PropertyListingDetailPage**: 物件リストの物件詳細ページ（`PropertyListingDetailPage.tsx`）
- **PropertyInfoCard**: 買主詳細・新規登録画面で物件情報を表示するカードコンポーネント（`PropertyInfoCard.tsx`）
- **BuyerDetailPage**: 買主リストの買主詳細ページ（`BuyerDetailPage.tsx`）
- **NewBuyerPage**: 買主新規登録ページ（`NewBuyerPage.tsx`）
- **PurchaseStatusBadge**: 買付状況を赤字で目立つように表示するUIコンポーネント（本機能で新規作成）
- **latest_status**: 買主テーブルの「最新状況」フィールド（`buyers.latest_status`）
- **offer_status**: 物件リストテーブルの「買付」フィールド（`property_listings.offer_status`）
- **買付状況テキスト**: 表示する文字列。条件1の場合は `latest_status` の値、条件2の場合は `offer_status` の値

---

## 要件

### 要件1: 買付状況の判定ロジック

**ユーザーストーリー:** 担当者として、物件に買付が入っているかどうかを正確に判定したい。そうすることで、誤った案内や対応漏れを防げる。

#### 受け入れ基準

1. WHEN `buyers.latest_status` の値に「買」という文字が含まれる場合、THE System SHALL その `latest_status` の値を買付状況テキストとして使用する
2. WHEN `property_listings.offer_status` に空でない値が存在する場合、THE System SHALL その `offer_status` の値を買付状況テキストとして使用する
3. WHEN 条件1と条件2の両方が成立する場合、THE System SHALL 条件1（`latest_status`）の値を優先して買付状況テキストとして使用する
4. WHEN `buyers.latest_status` が null、空文字、または「買」を含まない場合、THE System SHALL 条件1を不成立と判定する
5. WHEN `property_listings.offer_status` が null または空文字の場合、THE System SHALL 条件2を不成立と判定する

---

### 要件2: 物件詳細ページのヘッダーへの買付状況表示

**ユーザーストーリー:** 担当者として、物件詳細ページを開いた際にヘッダー付近で買付状況を即座に確認したい。そうすることで、物件の状況を見落とさずに対応できる。

#### 受け入れ基準

1. WHEN `PropertyListingDetailPage` を表示し、かつ条件1または条件2が成立する場合、THE System SHALL ページヘッダーの中央付近に買付状況テキストを赤字で目立つように表示する
2. WHEN 条件1も条件2も成立しない場合、THE System SHALL `PropertyListingDetailPage` のヘッダーに買付状況表示を表示しない
3. THE System SHALL 買付状況テキストを `color: 'error'`（赤）かつ `fontWeight: 'bold'` で表示する
4. WHEN 物件データの取得が完了していない場合、THE System SHALL 買付状況表示を表示しない

---

### 要件3: 買主詳細ページの物件情報カードへの買付状況表示

**ユーザーストーリー:** 担当者として、買主詳細ページで物件情報カードを確認する際に買付状況を一番上で確認したい。そうすることで、買主対応中に物件の買付状況を見落とさない。

#### 受け入れ基準

1. WHEN `BuyerDetailPage` の `PropertyInfoCard` を表示し、かつ条件1が成立する場合、THE System SHALL `PropertyInfoCard` の最上部に買付状況テキストを赤字で目立つように表示する
2. WHEN 条件1が成立しない場合、THE System SHALL `BuyerDetailPage` の `PropertyInfoCard` に買付状況表示を表示しない
3. THE System SHALL `PropertyInfoCard` の他のコンテンツより上（最上部）に買付状況表示を配置する
4. WHERE `BuyerDetailPage` から `PropertyInfoCard` に `buyer` オブジェクトが渡される場合、THE System SHALL `buyer.latest_status` を使用して条件1を判定する

---

### 要件4: 買主新規登録ページの物件情報エリアへの買付状況表示

**ユーザーストーリー:** 担当者として、買主を新規登録する際に物件情報エリアで買付状況を一番上で確認したい。そうすることで、買付済み物件への誤った新規登録を防げる。

#### 受け入れ基準

1. WHEN `NewBuyerPage` の物件情報エリアを表示し、かつ条件1または条件2が成立する場合、THE System SHALL 物件情報エリアの最上部に買付状況テキストを赤字で目立つように表示する
2. WHEN 条件1も条件2も成立しない場合、THE System SHALL `NewBuyerPage` の物件情報エリアに買付状況表示を表示しない
3. THE System SHALL 物件情報エリアの他のコンテンツより上（最上部）に買付状況表示を配置する
4. WHEN `NewBuyerPage` で物件番号が入力されていない場合、THE System SHALL 買付状況表示を表示しない
5. WHERE `NewBuyerPage` で `latest_status` フィールドに値が入力されている場合、THE System SHALL その値を使用して条件1を判定する
6. WHERE `NewBuyerPage` で物件情報（`propertyInfo`）が取得済みの場合、THE System SHALL `propertyInfo.offer_status` を使用して条件2を判定する

---

### 要件5: 買付状況表示の視覚的デザイン

**ユーザーストーリー:** 担当者として、買付状況が他の情報と明確に区別できるデザインで表示されてほしい。そうすることで、重要な情報を見落とさない。

#### 受け入れ基準

1. THE System SHALL 買付状況テキストを赤色（MUI `error` カラー相当、`#d32f2f` または `color: 'error.main'`）で表示する
2. THE System SHALL 買付状況テキストを太字（`fontWeight: 'bold'`）で表示する
3. THE System SHALL 買付状況テキストの前後に視覚的な強調（例: 背景色、ボーダー、またはアイコン）を付与する
4. THE System SHALL 買付状況表示のフォントサイズを周囲のテキストより大きく（`fontSize: '1.1rem'` 以上）表示する
