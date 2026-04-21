# 要件ドキュメント

## はじめに

本機能は、売主リストの通話モードページ（CallModePage）内の「近隣買主」タブに表示される `NearbyBuyersList` コンポーネントのアクションボタン行に、業者向けフィルタリングボタンを追加するものです。

業者（両手）に該当する買主を素早く絞り込むことで、担当者が物件種別に応じた業者向け買主候補を効率的に確認できるようになります。

## 用語集

- **NearbyBuyersList**: 通話モードページの「近隣買主」セクションに表示される買主一覧コンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）
- **NearbyBuyer**: 近隣買主一覧の各買主データを表すインターフェース
- **業者フィルター**: 業者（両手）に該当する買主を絞り込むフィルタリング機能
- **業者_土地ボタン**: 土地希望の業者買主を絞り込むボタン（物件種別が「土地」または「戸建て」の場合のみ表示）
- **業者_戸建ボタン**: 戸建希望の業者買主を絞り込むボタン（物件種別が「土地」または「戸建て」の場合のみ表示）
- **業者_マンションボタン**: マンション希望の業者買主を絞り込むボタン（物件種別が「マンション」の場合のみ表示）
- **★希望種別**: 買主スプレッドシートのU列。買主が希望する物件種別（例: "土地"、"戸建"、"マンション"、"土地、戸建"）
- **業者問合せ**: 買主スプレッドシートのCV列。業者区分（例: "業者（両手）"）
- **配信種別**: 買主スプレッドシートのQ列。配信の要否（例: "要"、空欄）
- **propertyType**: 売主の物件種別（例: "戸建て"、"マンション"、"土地"）
- **アクティブフィルター**: 現在適用中の業者フィルターの種別（"土地" / "戸建" / "マンション" / null）

---

## 要件

### 要件1: NearbyBuyerインターフェースへのフィールド追加

**ユーザーストーリー:** 担当者として、業者向けフィルタリングに必要なデータが買主情報に含まれていることを望む。そうすることで、フロントエンドで正確なフィルタリングが実行できる。

#### 受け入れ基準

1. THE `NearbyBuyer` インターフェース SHALL `desired_type` フィールド（U列「★希望種別」、型: `string | null`）を含む
2. THE `NearbyBuyer` インターフェース SHALL `broker_inquiry` フィールド（CV列「業者問合せ」、型: `string | null`）を含む
3. THE `NearbyBuyer` インターフェース SHALL `distribution_type` フィールド（Q列「配信種別」、型: `string | null`）を含む
4. WHEN バックエンドAPIが `/api/sellers/:id/nearby-buyers` のレスポンスを返す場合、THE API SHALL 各買主オブジェクトに `desired_type`、`broker_inquiry`、`distribution_type` フィールドを含める

---

### 要件2: 業者フィルタリングロジックの実装

**ユーザーストーリー:** 担当者として、業者（両手）に該当する買主を物件種別に応じて素早く絞り込みたい。そうすることで、業者向けの営業活動を効率化できる。

#### 受け入れ基準

1. WHEN 「業者_土地」フィルターが適用される場合、THE `NearbyBuyersList` SHALL 以下の全条件を満たす買主のみを表示する:
   - `desired_type` が空欄（null / 空文字）または "土地" を含む文字列（例: "土地"、"土地、戸建"）
   - `broker_inquiry` が "業者（両手）" と完全一致する
   - `distribution_type` が "要" と完全一致する、または空欄（null / 空文字）である

2. WHEN 「業者_戸建」フィルターが適用される場合、THE `NearbyBuyersList` SHALL 以下の全条件を満たす買主のみを表示する:
   - `desired_type` が "戸建" と完全一致する（"土地、戸建" のような複合値は除外）
   - `broker_inquiry` が "業者（両手）" と完全一致する
   - `distribution_type` が "要" と完全一致する、または空欄（null / 空文字）である

3. WHEN 「業者_マンション」フィルターが適用される場合、THE `NearbyBuyersList` SHALL 以下の全条件を満たす買主のみを表示する:
   - `desired_type` が "マンション" と完全一致する
   - `broker_inquiry` が "業者（両手）" と完全一致する
   - `distribution_type` が "要" と完全一致する、または空欄（null / 空文字）である

4. WHEN 業者フィルターが適用されている場合、THE `NearbyBuyersList` SHALL 既存の価格帯フィルター（`selectedPriceRanges`）と組み合わせてフィルタリングを適用する（AND条件）

5. WHEN 業者フィルターが適用されていない場合（アクティブフィルターが null）、THE `NearbyBuyersList` SHALL 業者フィルタリングを行わず、既存の動作を維持する

---

### 要件3: 業者フィルタリングボタンの表示制御

**ユーザーストーリー:** 担当者として、物件種別に応じた適切な業者フィルターボタンのみが表示されることを望む。そうすることで、不要なボタンによる混乱を避けられる。

#### 受け入れ基準

1. WHEN `propertyType` が "土地" または "戸建て" と完全一致する場合、THE `NearbyBuyersList` SHALL 「業者_土地」ボタンを既存の「PDF」ボタンの右隣に表示する

2. WHEN `propertyType` が "マンション" の場合、THE `NearbyBuyersList` SHALL 「業者_土地」ボタンを表示しない

3. WHEN `propertyType` が "土地" または "戸建て" と完全一致する場合、THE `NearbyBuyersList` SHALL 「業者_戸建」ボタンを「業者_土地」ボタンの右隣に表示する

4. WHEN `propertyType` が "土地" でも "戸建て" でもない場合、THE `NearbyBuyersList` SHALL 「業者_戸建」ボタンを表示しない

5. WHEN `propertyType` が "マンション" と完全一致する場合、THE `NearbyBuyersList` SHALL 「業者_マンション」ボタンを既存の「PDF」ボタンの右隣に表示する

6. WHEN `propertyType` が "マンション" 以外の場合、THE `NearbyBuyersList` SHALL 「業者_マンション」ボタンを表示しない

---

### 要件4: 業者フィルタリングボタンのトグル動作

**ユーザーストーリー:** 担当者として、業者フィルターボタンを押すことでフィルターのオン/オフを切り替えたい。そうすることで、フィルタリング前後の買主リストを素早く比較できる。

#### 受け入れ基準

1. WHEN 業者フィルターボタンが押され、そのフィルターが現在非アクティブの場合、THE `NearbyBuyersList` SHALL そのフィルターをアクティブにし、対応する買主リストを表示する

2. WHEN 業者フィルターボタンが押され、そのフィルターが現在アクティブの場合、THE `NearbyBuyersList` SHALL そのフィルターを解除し（アクティブフィルターを null に設定）、フィルタリング前の買主リストを表示する

3. WHEN 「業者_土地」ボタンがアクティブな状態で「業者_戸建」または「業者_マンション」ボタンが押された場合、THE `NearbyBuyersList` SHALL 「業者_土地」フィルターを解除し、新たに押されたフィルターをアクティブにする（排他制御）

4. WHEN 業者フィルターがアクティブな場合、THE `NearbyBuyersList` SHALL アクティブなボタンを `variant="contained"` で表示し、非アクティブなボタンを `variant="outlined"` で表示する

5. WHEN 業者フィルターが適用されている場合、THE `NearbyBuyersList` SHALL 件数表示（「N件の買主が見つかりました」）をフィルタリング後の件数で更新する

---

### 要件5: バックエンドAPIの拡張

**ユーザーストーリー:** 担当者として、近隣買主APIが業者フィルタリングに必要なフィールドを返すことを望む。そうすることで、フロントエンドで正確なフィルタリングが実行できる。

#### 受け入れ基準

1. WHEN バックエンドが `/api/sellers/:id/nearby-buyers` エンドポイントを処理する場合、THE API SHALL 各買主オブジェクトに `desired_type`（U列「★希望種別」のデータベースカラム値）を含める

2. WHEN バックエンドが `/api/sellers/:id/nearby-buyers` エンドポイントを処理する場合、THE API SHALL 各買主オブジェクトに `broker_inquiry`（CV列「業者問合せ」のデータベースカラム値）を含める

3. WHEN バックエンドが `/api/sellers/:id/nearby-buyers` エンドポイントを処理する場合、THE API SHALL 各買主オブジェクトに `distribution_type`（Q列「配信種別」のデータベースカラム値）を含める

4. IF 対象フィールドがデータベースに存在しない場合、THEN THE API SHALL そのフィールドを `null` として返す
