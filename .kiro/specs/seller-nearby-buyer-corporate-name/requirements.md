# 要件ドキュメント

## はじめに

本機能は、売主リストの近隣買主候補ページ（`NearbyBuyersList` コンポーネント）で「業者_土地」「業者_戸建」「業者_マンション」ボタンを押した際に表示される買主テーブル一覧に、買主名の隣に「法人名」を追加表示するものです。

法人名のデータソースは買主スプレッドシートのEE列（カラム名「法人名」）です。現状、テーブルには買主名のみが表示されており、法人名が確認できないため、担当者が業者買主の所属法人を素早く把握できるよう改善します。

本機能はバックエンドAPIの拡張（`corporate_name` フィールドの追加）とフロントエンドのテーブル表示変更の両方が必要です。

## 用語集

- **NearbyBuyersList**: 売主リストの近隣買主候補ページおよび通話モードページの「近隣買主」セクションに表示される買主一覧コンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）
- **NearbyBuyer**: 近隣買主一覧の各買主データを表すインターフェース
- **法人名**: 買主スプレッドシートのEE列に格納されている買主の所属法人名（データベースカラム名: `corporate_name`）
- **業者フィルターボタン**: 「業者_土地」「業者_戸建」「業者_マンション」の3種類のフィルタリングボタン
- **近隣買主API**: `GET /api/sellers/:id/nearby-buyers` エンドポイント（`backend/src/routes/sellers.ts`）
- **getBuyersByAreas**: 配信エリアに該当する買主を取得するメソッド（`backend/src/services/BuyerService.ts`）

---

## 要件

### 要件1: NearbyBuyerインターフェースへの法人名フィールド追加

**ユーザーストーリー:** 担当者として、近隣買主一覧に法人名が含まれていることを望む。そうすることで、業者買主の所属法人を確認しながら営業活動を進められる。

#### 受け入れ基準

1. THE `NearbyBuyer` インターフェース SHALL `corporate_name` フィールド（EE列「法人名」、型: `string | null`）を含む

2. WHEN バックエンドAPIが `/api/sellers/:id/nearby-buyers` のレスポンスを返す場合、THE API SHALL 各買主オブジェクトに `corporate_name` フィールドを含める

3. IF `corporate_name` がデータベースに存在しない（null または未設定）場合、THEN THE API SHALL `corporate_name` を `null` として返す

---

### 要件2: バックエンドAPIの拡張

**ユーザーストーリー:** システムとして、近隣買主APIが法人名フィールドをフロントエンドに返すことを望む。そうすることで、フロントエンドで法人名を表示できる。

#### 受け入れ基準

1. WHEN `getBuyersByAreas` メソッドが買主データを取得する場合、THE `BuyerService` SHALL Supabaseクエリの `.select()` に `corporate_name` フィールドを含める

2. WHEN `getBuyersByAreas` メソッドが買主データを返す場合、THE `BuyerService` SHALL 各買主オブジェクトに `corporate_name`（EE列「法人名」のデータベースカラム値）を含める

3. IF `corporate_name` カラムがデータベースに存在しない場合、THEN THE `BuyerService` SHALL `corporate_name` を `null` として返す

---

### 要件3: フロントエンドテーブルへの法人名列追加

**ユーザーストーリー:** 担当者として、近隣買主テーブルで買主名の隣に法人名が表示されることを望む。そうすることで、業者買主の所属法人を一目で確認できる。

#### 受け入れ基準

1. WHEN 近隣買主テーブルが表示される場合、THE `NearbyBuyersList` SHALL 買主名列の隣（右側）に「法人名」列を追加表示する

2. WHEN 買主の `corporate_name` に値が存在する場合、THE `NearbyBuyersList` SHALL その値を「法人名」列に表示する

3. WHEN 買主の `corporate_name` が null または空文字の場合、THE `NearbyBuyersList` SHALL 「法人名」列に「-」を表示する

4. THE 「法人名」列 SHALL 既存の他の列（名前・ステータス・内覧日等）と同様のスタイルで表示する

---

### 要件4: 既存の業者フィルター機能との整合性維持

**ユーザーストーリー:** 担当者として、法人名列の追加後も業者フィルターボタンの動作が変わらないことを望む。そうすることで、既存の操作感を維持したまま法人名表示の恩恵を受けられる。

#### 受け入れ基準

1. WHEN 法人名列が追加された後も、THE 業者フィルターボタン SHALL 既存のトグル動作（同じボタンで解除、別ボタンで排他切り替え）を維持する

2. WHEN 法人名列が追加された後も、THE `NearbyBuyersList` SHALL 業者フィルターと価格帯フィルターのAND結合によるフィルタリング動作を維持する

3. WHEN 法人名列が追加された後も、THE `NearbyBuyersList` SHALL 既存の全列（名前・ステータス・内覧日・希望種別・問い合わせ価格・物件住所・ヒアリング・フォローアップ等）を維持する
