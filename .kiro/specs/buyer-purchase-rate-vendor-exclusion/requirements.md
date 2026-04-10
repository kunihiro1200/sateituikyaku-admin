# 要件定義書：買付率計算における業者問合せ買主の除外

## はじめに

買主リスト詳細画面（BuyerDetailPage）から遷移する買付率統計ページ（BuyerPurchaseRateStatisticsPage）において、買付率の計算に使用する内覧件数・買付件数の集計から、「業者問合せ」（DBカラム: `broker_inquiry`）に値が入っている買主を除外する。

### 背景と具体例

現在の実装では、2026年4月の「久」担当者の内覧件数が11件と集計されているが、そのうち買主番号7260は `broker_inquiry` に値が入っている業者問合せ買主であるため、除外すべきである。除外後の内覧件数は10件になるべきである。

## 用語集

- **System**: 買主リスト管理システム（社内管理システム、バックエンドポート3000）
- **User**: システムを使用する営業担当者
- **Buyer**: 買主（購入希望者）
- **Vendor_Buyer**: 業者問合せ買主（`broker_inquiry` カラムに値が入っている買主）
- **Broker_Inquiry**: 業者問合せフラグ（DBカラム: `broker_inquiry`、スプレッドシートカラム: `業者問合せ`）
- **Purchase_Rate_Statistics**: 買付率統計（内覧件数に対する買付件数の割合）
- **Viewing_Count**: 内覧件数（重複排除済み）
- **Purchase_Count**: 買付件数（`latest_status` に「買（」を含む件数）
- **Statistics_Page**: 買付率統計ページ（BuyerPurchaseRateStatisticsPage）
- **BuyerService**: バックエンドの買主サービス（`backend/src/services/BuyerService.ts`）

## 要件

### 要件1: 業者問合せ買主の集計除外

**ユーザーストーリー**: 営業担当者として、買付率統計から業者問合せ買主を除外したい。そうすることで、実際の個人顧客に対する買付率を正確に把握できる。

#### 受入基準

1. WHEN THE System が買付率統計を集計する、THE System SHALL `broker_inquiry` カラムに値が入っている買主を内覧件数の集計対象から除外する
2. WHEN THE System が買付率統計を集計する、THE System SHALL `broker_inquiry` カラムに値が入っている買主を買付件数の集計対象から除外する
3. WHEN `broker_inquiry` カラムが `null`、空文字列、または `'0'` の場合、THE System SHALL その買主を集計対象に含める
4. WHEN `broker_inquiry` カラムに `null`・空文字列・`'0'` 以外の値が入っている場合、THE System SHALL その買主を集計対象から除外する
5. THE System SHALL 除外処理を月ごと・担当者ごとの集計グループ化の前に適用する

### 要件2: 集計結果の正確性

**ユーザーストーリー**: 営業担当者として、除外後の正確な件数で買付率が表示されることを期待する。そうすることで、業者問合せを除いた純粋な営業成果を確認できる。

#### 受入基準

1. WHEN 業者問合せ買主が除外された後、THE System SHALL 残りの買主のみで内覧件数（重複排除済み）を再集計する
2. WHEN 業者問合せ買主が除外された後、THE System SHALL 残りの買主のみで買付件数を再集計する
3. THE System SHALL 除外後の内覧件数と買付件数を使って買付率を計算する
4. WHEN 除外後の内覧件数が0件の場合、THE System SHALL 買付率を `null`（表示上は「-」）として返す

### 要件3: バックエンドAPIの変更

**ユーザーストーリー**: 営業担当者として、APIが正確なデータを返すことを期待する。そうすることで、フロントエンドに正しい統計が表示される。

#### 受入基準

1. THE BuyerService SHALL `getPurchaseRateStatistics` メソッドのSupabaseクエリに `broker_inquiry` カラムを追加する
2. WHEN THE BuyerService が `groupByMonthAndAssignee` メソッドを実行する、THE System SHALL グループ化の前に `broker_inquiry` に値が入っている買主を除外する
3. THE System SHALL 既存の `GYOSHA` 担当者除外処理と同じ段階で業者問合せ除外処理を適用する
4. THE System SHALL `/api/buyers/purchase-rate-statistics` エンドポイントのレスポンス形式を変更しない

### 要件4: キャッシュの整合性

**ユーザーストーリー**: 営業担当者として、常に最新の正確なデータが表示されることを期待する。そうすることで、古いキャッシュによる誤った統計を見ることがない。

#### 受入基準

1. WHEN THE System が買付率統計のキャッシュを更新する、THE System SHALL 業者問合せ除外後のデータをキャッシュに保存する
2. THE System SHALL 既存のキャッシュ無効化タイミングを変更しない

### 要件5: 既存機能への影響なし

**ユーザーストーリー**: 営業担当者として、他の機能が引き続き正常に動作することを期待する。そうすることで、業務に支障が出ない。

#### 受入基準

1. THE System SHALL 買付率統計ページ（BuyerPurchaseRateStatisticsPage）の表示形式を変更しない
2. THE System SHALL 買主リスト一覧（BuyersPage）の表示・フィルター機能に影響を与えない
3. THE System SHALL 他社物件新着配信ページ（OtherCompanyDistributionPage）の買主検索機能に影響を与えない
4. THE System SHALL 買主詳細ページ（BuyerDetailPage）の表示内容に影響を与えない
