# 要件定義書

## はじめに

物件リストの買主候補リスト機能において、現在は配信エリア番号（例：㊵）によるマッチングのみを行っている。本機能では、売主の物件住所（`property_address`）から半径3km以内で問い合わせてきた買主も候補に含めるよう拡張する。

対象システム：社内管理システム（`backend/src/`、`frontend/frontend/src/`）

## 用語集

- **BuyerCandidateService**: 物件に対する買主候補を抽出するバックエンドサービス（`backend/src/services/BuyerCandidateService.ts`）
- **配信エリアマッチング**: 物件の配信エリア番号（㊵など）と買主の希望エリアを照合する既存ロジック
- **半径3km検索**: 売主の物件住所（`property_address`）を中心とした半径3km以内に、買主が問い合わせた物件が存在するかを判定する新ロジック
- **GeocodingService**: 住所文字列から緯度・経度座標を取得するサービス（`backend/src/services/GeocodingService.ts`）
- **GeolocationService**: 2点間の距離計算（Haversine公式）を行うサービス（`backend/src/services/GeolocationService.ts`）
- **property_address**: 売主テーブル（`sellers`）の物件住所カラム
- **property_listings**: 物件リストテーブル。`address`カラムに物件住所を持つ
- **buyers**: 買主テーブル。`property_number`カラムに問い合わせ物件番号を持つ

## 要件

### 要件1：半径3km以内の買主を候補に追加

**ユーザーストーリー：** 担当者として、物件住所から半径3km以内で問い合わせてきた買主も候補リストに表示してほしい。そうすることで、配信エリアに関係なく近隣エリアの潜在的な買主を見逃さずに済む。

#### 受け入れ基準

1. WHEN 物件の買主候補リストを取得するとき、THE BuyerCandidateService SHALL 配信エリアマッチングに加えて、半径3km以内の距離マッチングも実行する
2. WHEN 買主の問い合わせ物件（`property_number`）の住所が、対象物件の`property_address`から半径3km以内である場合、THE BuyerCandidateService SHALL その買主を候補リストに含める
3. WHEN 配信エリアマッチングまたは半径3km距離マッチングのいずれかが条件を満たす場合、THE BuyerCandidateService SHALL その買主を候補として返す（OR条件）
4. THE BuyerCandidateService SHALL 価格帯・種別・ステータス・配信種別などの既存フィルタ条件を変更しない
5. WHEN 対象物件の`property_address`が空欄または取得できない場合、THE BuyerCandidateService SHALL 距離マッチングをスキップし、配信エリアマッチングのみで候補を返す

---

### 要件2：物件住所のジオコーディング

**ユーザーストーリー：** システムとして、物件住所から座標を取得し、距離計算に使用できるようにしたい。

#### 受け入れ基準

1. WHEN 物件の`property_address`が存在する場合、THE BuyerCandidateService SHALL GeocodingServiceを使用して住所から緯度・経度を取得する
2. WHEN GeocodingServiceがAPIキー未設定またはAPIエラーを返す場合、THE BuyerCandidateService SHALL 距離マッチングをスキップし、配信エリアマッチングのみで処理を継続する
3. WHEN ジオコーディングが成功した場合、THE BuyerCandidateService SHALL 取得した座標をGeolocationServiceの`calculateDistance`メソッドに渡して距離を計算する

---

### 要件3：買主の問い合わせ物件住所の座標取得

**ユーザーストーリー：** システムとして、買主が問い合わせた物件の住所から座標を取得し、対象物件との距離を計算できるようにしたい。

#### 受け入れ基準

1. WHEN 距離マッチングを実行するとき、THE BuyerCandidateService SHALL 買主の`property_number`から`property_listings`テーブルの`address`カラムを取得する
2. WHEN 買主の`property_number`が空欄または`property_listings`に存在しない場合、THE BuyerCandidateService SHALL その買主の距離マッチングをfalseとして扱う
3. WHEN 買主の`property_number`がカンマ区切りで複数存在する場合、THE BuyerCandidateService SHALL 最初の物件番号のみを使用して距離を計算する
4. WHEN 買主の問い合わせ物件住所のジオコーディングが失敗した場合、THE BuyerCandidateService SHALL その買主の距離マッチングをfalseとして扱う

---

### 要件4：パフォーマンス考慮

**ユーザーストーリー：** 担当者として、買主候補リストの表示が遅くならないようにしてほしい。

#### 受け入れ基準

1. WHEN 距離マッチングを実行するとき、THE BuyerCandidateService SHALL 配信エリアマッチングで既に候補に含まれている買主に対して重複して距離計算を行わない
2. WHEN 複数の買主の問い合わせ物件住所をジオコーディングするとき、THE BuyerCandidateService SHALL 同一の物件番号に対するジオコーディング結果をキャッシュして重複APIコールを避ける
3. THE BuyerCandidateService SHALL 距離マッチングの対象となる買主数を合理的な範囲（配信エリアマッチングで除外された買主のみ）に限定する

---

### 要件5：既存フィルタとの整合性

**ユーザーストーリー：** 担当者として、半径3km検索で追加された買主も、既存の除外条件（業者問合せ・買付済み・D確度など）が適用されることを確認したい。

#### 受け入れ基準

1. WHEN 半径3km距離マッチングで候補に追加される買主に対しても、THE BuyerCandidateService SHALL `shouldExcludeBuyer`（業者問合せ・配信種別チェック）を適用する
2. WHEN 半径3km距離マッチングで候補に追加される買主に対しても、THE BuyerCandidateService SHALL `matchesStatus`（買付済み・D確度除外）を適用する
3. WHEN 半径3km距離マッチングで候補に追加される買主に対しても、THE BuyerCandidateService SHALL `matchesPropertyTypeCriteria`（種別マッチング）を適用する
4. WHEN 半径3km距離マッチングで候補に追加される買主に対しても、THE BuyerCandidateService SHALL `matchesPriceCriteria`（価格帯マッチング）を適用する
