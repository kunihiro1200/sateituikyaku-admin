# 要件ドキュメント

## はじめに

物件詳細モーダル（`WorkTaskDetailModal`）の「契約決済」タブのレイアウトを変更する機能です。
現在、「契約決済」タブは全フィールドが縦一列に並んでいますが、「サイト登録」タブと同様に左右2ペイン構成に変更します。

左側ペインには「契約書・重説作成」関連フィールド（売買契約締め日〜製本完了）を、右側ペインには「決済詳細」関連フィールド（決済日〜経理確認済み）を配置します。背景色のセクション分けも「サイト登録」タブと同様のスタイルで実装します。

## 用語集

- **WorkTaskDetailModal**: 物件詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **ContractSettlementSection**: 「契約決済」タブのセクションコンポーネント
- **SiteRegistrationSection**: 「サイト登録」タブのセクションコンポーネント（参照レイアウト）
- **左ペイン**: 左右分割レイアウトの左側エリア
- **右ペイン**: 左右分割レイアウトの右側エリア
- **SectionHeader**: セクション見出しを表示するコンポーネント

## 要件

### 要件1：左右2ペイン構成への変更

**ユーザーストーリー：** 担当者として、「契約決済」タブを左右に分割して表示したい。そうすることで、契約書作成関連と決済関連の情報を一目で把握できる。

#### 受け入れ基準

1. THE ContractSettlementSection SHALL 「サイト登録」タブと同じ `display: 'flex'` による左右2ペイン構成で表示する
2. THE ContractSettlementSection SHALL 左ペインと右ペインを `flex: 1` で均等幅に分割する
3. THE ContractSettlementSection SHALL 左ペインと右ペインの間に境界線（`borderRight: '2px solid'`）を表示する
4. THE ContractSettlementSection SHALL 各ペインに独立したスクロール（`overflowY: 'auto'`）を持たせる

### 要件2：左ペイン「契約書、重説作成」セクション

**ユーザーストーリー：** 担当者として、契約書・重説作成に関するフィールドを左側にまとめて表示したい。そうすることで、契約書作成の進捗を効率的に確認できる。

#### 受け入れ基準

1. THE 左ペイン SHALL ヘッダーとして `【契約書、重説作成】` を表示する
2. THE 左ペイン SHALL 以下のフィールドをこの順序で表示する：
   - 売買契約締め日（`sales_contract_deadline`）
   - 売買契約備考（`sales_contract_notes`）
   - 契約形態（`contract_type`）
   - CW（浅沼様）全エリア・種別依頼OK（表示のみ）
   - 重説・契約書入力納期（`contract_input_deadline`）
   - 依頼前に確認（`PreRequestCheckButton`）
   - 社員が契約書作成（`employee_contract_creation`）
   - 製本予定日（`binding_scheduled_date`）
   - 製本完了（`binding_completed`）
3. THE 左ペイン SHALL 「サイト登録」タブの左ペインと同様に青系の背景色（`#1565c0`）のヘッダーテキストを表示する

### 要件3：右ペイン「決済詳細」セクション

**ユーザーストーリー：** 担当者として、決済に関するフィールドを右側にまとめて表示したい。そうすることで、決済情報の確認・入力を効率的に行える。

#### 受け入れ基準

1. THE 右ペイン SHALL ヘッダーとして `【決済詳細】` を表示する
2. THE 右ペイン SHALL 以下のフィールドをこの順序で表示する：
   - 決済日（`settlement_date`）
   - 決済予定月（`settlement_scheduled_month`）
   - 売買価格（`sales_price`）
   - 仲介手数料（売）（`brokerage_fee_seller`）
   - 通常仲介手数料（売）（`standard_brokerage_fee_seller`）
   - キャンペーン（`campaign`）
   - 減額理由（`discount_reason`）
   - 減額理由他（`discount_reason_other`）
   - 売・支払方法（`seller_payment_method`）
   - 入金確認（売）（`payment_confirmed_seller`）
   - 仲介手数料（買）（`brokerage_fee_buyer`）
   - 通常仲介手数料（買）（`standard_brokerage_fee_buyer`）
   - 買・支払方法（`buyer_payment_method`）
   - 入金確認（買）（`payment_confirmed_buyer`）
   - 経理確認済み（`accounting_confirmed`）
3. THE 右ペイン SHALL 「サイト登録」タブの右ペインと同様に緑系の背景色（`#2e7d32`）のヘッダーテキストを表示する

### 要件4：背景色によるセクション区分

**ユーザーストーリー：** 担当者として、「サイト登録」タブと同様に背景色でセクションを視覚的に区別したい。そうすることで、関連フィールドのグループを直感的に把握できる。

#### 受け入れ基準

1. THE 左ペイン SHALL 「サイト登録」タブの `#e3f2fd`（薄い青）に相当する背景色でフィールドグループを囲む `Box` を使用する
2. THE 右ペイン SHALL 「サイト登録」タブの `#f3e5f5`（薄い紫）または類似の背景色でフィールドグループを囲む `Box` を使用する
3. THE ContractSettlementSection SHALL 各 `Box` に `borderRadius: 1`、`p: 1`、`mb: 1` のスタイルを適用する

### 要件5：保存ボタンの配置

**ユーザーストーリー：** 担当者として、左右どちらのペインからでも保存操作を行いたい。そうすることで、入力後すぐに保存できる。

#### 受け入れ基準

1. THE 左ペイン SHALL ヘッダー行の右端に保存ボタンを表示する
2. THE 右ペイン SHALL ヘッダー行の右端に保存ボタンを表示する
3. THE 保存ボタン SHALL 「サイト登録」タブと同様に、未保存の変更がある場合にパルスアニメーションを表示する
4. THE 保存ボタン SHALL 左ペインは `color="primary"`（青）、右ペインは `color="success"`（緑）で表示する
