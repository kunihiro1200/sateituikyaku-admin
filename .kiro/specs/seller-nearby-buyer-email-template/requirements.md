# 要件ドキュメント

## はじめに

売主リストの近隣買主機能において、「メール送信」ボタン押下後に表示されるメール本文テンプレートを変更する。
新テンプレートでは物件住所・土地面積・建物面積を本文中に直接埋め込む形式に変更し、面積フィールドは「当社調べ」値を優先するロジックを適用する。

## 用語集

- **NearbyBuyersList**: 売主リストの近隣買主候補を表示するコンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）
- **PropertyDetails**: 近隣買主APIレスポンスに含まれる物件詳細情報オブジェクト
- **土地面積（当社調べ）**: `land_area_verified`カラム（DBカラム名）/ `landAreaVerified`（フロントエンド）
- **土地面積**: `land_area`カラム（DBカラム名）/ `landArea`（フロントエンド）
- **建物面積（当社調べ）**: `building_area_verified`カラム（DBカラム名）/ `buildingAreaVerified`（フロントエンド）
- **建物面積**: `building_area`カラム（DBカラム名）/ `buildingArea`（フロントエンド）
- **Email_Template**: メール送信モーダルに初期表示されるメール本文テンプレート文字列
- **{氏名}プレースホルダー**: 複数宛先送信時に各買主の氏名に置換されるテンプレート変数

## 要件

### 要件1: メール本文テンプレートの変更

**ユーザーストーリー:** 担当者として、近隣買主へのメール送信時に物件情報（住所・土地面積・建物面積）が本文に含まれた状態でテンプレートが表示されることを望む。これにより、毎回手動で物件情報を入力する手間を省くことができる。

#### 受け入れ基準

1. WHEN 近隣買主リストで「メール送信」ボタンが押下される, THE Email_Template SHALL 以下の形式のメール本文を初期値として設定する:
   ```
   {氏名}様

   お世話になります。不動産会社の株式会社いふうです。

   下記を近々売りに出すことになりました！

   物件住所：{物件住所}
   土地面積：{土地面積}㎡
   建物面積：{建物面積}㎡

   ぜんりんを添付しておりますのでご参考ください。
   もしご興味がございましたら、このメールにご返信頂ければと思います。

   よろしくお願いいたします。

   ×××××××××××××××
   大分市舞鶴町1-3-30
   株式会社いふう
   TEL:097-533-2022
   ×××××××××××××××
   ```

2. WHEN メール本文テンプレートが生成される, THE Email_Template SHALL `{物件住所}` を実際の物件住所の値で置換する。

3. WHEN メール本文テンプレートが生成される, THE Email_Template SHALL `{土地面積}` を面積優先ロジック（要件2）で決定した土地面積の値で置換する。

4. WHEN メール本文テンプレートが生成される, THE Email_Template SHALL `{建物面積}` を面積優先ロジック（要件2）で決定した建物面積の値で置換する。

5. WHEN 宛先が1名の場合, THE Email_Template SHALL `{氏名}` を当該買主の氏名で置換した本文を初期値として設定する。

6. WHEN 宛先が複数名の場合, THE Email_Template SHALL `{氏名}` をプレースホルダーのまま（`{氏名}`）本文に含め、送信時に各買主の氏名に個別置換する。

7. IF 物件住所が取得できない場合, THEN THE Email_Template SHALL `{物件住所}` を空文字列で置換する。

8. IF 土地面積が取得できない場合（当社調べ・通常値ともにnullまたは未設定）, THEN THE Email_Template SHALL `{土地面積}` を空文字列で置換する。

9. IF 建物面積が取得できない場合（当社調べ・通常値ともにnullまたは未設定）, THEN THE Email_Template SHALL `{建物面積}` を空文字列で置換する。

---

### 要件2: 面積フィールドの優先ロジック

**ユーザーストーリー:** 担当者として、「当社調べ」の面積値がある場合はそちらを優先してメールに表示されることを望む。これにより、より正確な面積情報を買主に提供できる。

#### 受け入れ基準

1. WHEN 土地面積を決定する, THE Email_Template SHALL `landAreaVerified`（土地面積・当社調べ）に値が存在する場合、その値を優先して使用する。

2. WHEN 土地面積を決定する, IF `landAreaVerified` が null または未設定の場合, THEN THE Email_Template SHALL `landArea`（土地面積）の値を使用する。

3. WHEN 建物面積を決定する, THE Email_Template SHALL `buildingAreaVerified`（建物面積・当社調べ）に値が存在する場合、その値を優先して使用する。

4. WHEN 建物面積を決定する, IF `buildingAreaVerified` が null または未設定の場合, THEN THE Email_Template SHALL `buildingArea`（建物面積）の値を使用する。

---

### 要件3: バックエンドAPIの拡張

**ユーザーストーリー:** システムとして、近隣買主APIが面積優先ロジックに必要な4つの面積フィールドをすべてフロントエンドに返すことを望む。これにより、フロントエンドで正しい面積値を選択できる。

#### 受け入れ基準

1. WHEN `GET /api/sellers/:id/nearby-buyers` が呼び出される, THE API SHALL レスポンスの `propertyDetails` オブジェクトに `landAreaVerified` フィールドを含める。

2. WHEN `GET /api/sellers/:id/nearby-buyers` が呼び出される, THE API SHALL レスポンスの `propertyDetails` オブジェクトに `buildingAreaVerified` フィールドを含める。

3. WHEN `GET /api/sellers/:id/nearby-buyers` が呼び出される, THE API SHALL レスポンスの `propertyDetails` オブジェクトに `landArea` フィールドを含める。

4. WHEN `GET /api/sellers/:id/nearby-buyers` が呼び出される, THE API SHALL レスポンスの `propertyDetails` オブジェクトに `buildingArea` フィールドを含める。

5. WHEN `GET /api/sellers/:id/nearby-buyers` が呼び出される, THE API SHALL レスポンスの `propertyDetails` オブジェクトに `address`（物件住所）フィールドを含める。

---

### 要件4: フロントエンドのPropertyDetails型拡張

**ユーザーストーリー:** システムとして、フロントエンドの `PropertyDetails` インターフェースが `landAreaVerified` と `buildingAreaVerified` フィールドを保持できることを望む。

#### 受け入れ基準

1. THE NearbyBuyersList SHALL `PropertyDetails` インターフェースに `landAreaVerified: number | null` フィールドを定義する。

2. THE NearbyBuyersList SHALL `PropertyDetails` インターフェースに `buildingAreaVerified: number | null` フィールドを定義する。

3. WHEN APIレスポンスから `propertyDetails` を受け取る, THE NearbyBuyersList SHALL `landAreaVerified` および `buildingAreaVerified` の値を `propertyDetails` ステートに保存する。
