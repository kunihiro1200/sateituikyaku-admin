# 要件定義書

## はじめに

物件詳細画面（PropertyListingDetailPage）のヘッダーに「レインズ登録、サイト入力」ボタンを追加し、専用の入力ページへ遷移する機能を実装する。

このページでは、レインズ登録に関連する4つのフィールドをボタン形式で操作できる。各フィールドの値はデータベース（`property_listings`テーブル）に保存され、スプレッドシートへ即時同期される。

---

## 用語集

- **ReinsRegistrationPage**: レインズ登録・サイト入力専用ページ
- **PropertyListingDetailPage**: 物件詳細画面（社内管理システム）
- **property_listings**: 物件情報を管理するデータベーステーブル
- **reins_certificate_email**: レインズ証明書メール済みフィールド（DBカラム名）
- **cc_assignee**: 担当をCCにいれるフィールド（DBカラム名）
- **report_date_setting**: 報告日設定フィールド（DBカラム名）
- **SyncQueue**: DB更新後にスプレッドシートへ即時同期するキューサービス

---

## 要件

### 要件1: ヘッダーへのボタン追加

**ユーザーストーリー:** 担当者として、物件詳細画面からレインズ登録・サイト入力ページへ素早くアクセスしたい。そうすることで、レインズ登録作業を効率的に行える。

#### 受け入れ基準

1. THE PropertyListingDetailPage SHALL ヘッダー領域に「レインズ登録、サイト入力」ボタンを表示する
2. WHEN ユーザーが「レインズ登録、サイト入力」ボタンをクリックしたとき、THE System SHALL `/properties/:id/reins-registration` へ遷移する
3. THE System SHALL 遷移先ページに対象物件の物件番号（`property_number`）を引き渡す

---

### 要件2: レインズ登録ページの表示

**ユーザーストーリー:** 担当者として、レインズ登録に必要な4つのフィールドを1つの画面で確認・操作したい。そうすることで、登録作業の抜け漏れを防げる。

#### 受け入れ基準

1. THE ReinsRegistrationPage SHALL 対象物件の物件番号をページタイトルまたはヘッダーに表示する
2. THE ReinsRegistrationPage SHALL 以下の4つのフィールドを表示する：
   - レインズ証明書メール済み（`reins_certificate_email`）
   - レインズURL
   - 担当をCCにいれる（`cc_assignee`）
   - 報告日設定（`report_date_setting`）
3. THE ReinsRegistrationPage SHALL ページ読み込み時に現在のDBの値を各フィールドに反映する
4. THE ReinsRegistrationPage SHALL 物件詳細画面へ戻るボタンを表示する
5. WHEN ユーザーが戻るボタンをクリックしたとき、THE System SHALL `/properties/:id` へ遷移する

---

### 要件3: レインズ証明書メール済みフィールド

**ユーザーストーリー:** 担当者として、レインズ証明書メールの送信状況をボタン1つで切り替えたい。そうすることで、状況を素早く更新できる。

#### 受け入れ基準

1. THE ReinsRegistrationPage SHALL 「連絡済み」と「未」の2つのボタンを表示する
2. WHEN ユーザーが「連絡済み」ボタンをクリックしたとき、THE System SHALL `reins_certificate_email` を `"連絡済み"` に更新する
3. WHEN ユーザーが「未」ボタンをクリックしたとき、THE System SHALL `reins_certificate_email` を `"未"` に更新する
4. THE ReinsRegistrationPage SHALL 現在選択されている値のボタンを視覚的に強調表示する
5. WHEN `reins_certificate_email` が更新されたとき、THE System SHALL SyncQueue を通じてスプレッドシートへ即時同期する

---

### 要件4: レインズURLボタン

**ユーザーストーリー:** 担当者として、レインズシステムへのリンクボタンをクリックして素早くアクセスしたい。そうすることで、ブラウザでURLを入力する手間を省ける。

#### 受け入れ基準

1. THE ReinsRegistrationPage SHALL 「レインズURL」ボタンを表示する
2. WHEN ユーザーが「レインズURL」ボタンをクリックしたとき、THE System SHALL `https://system.reins.jp/` を新しいタブで開く

---

### 要件5: 担当をCCにいれるフィールド

**ユーザーストーリー:** 担当者として、CCへの追加状況をボタン1つで切り替えたい。そうすることで、メール送信時の設定漏れを防げる。

#### 受け入れ基準

1. THE ReinsRegistrationPage SHALL 「済」と「未」の2つのボタンを表示する
2. WHEN ユーザーが「済」ボタンをクリックしたとき、THE System SHALL `cc_assignee` を `"済"` に更新する
3. WHEN ユーザーが「未」ボタンをクリックしたとき、THE System SHALL `cc_assignee` を `"未"` に更新する
4. THE ReinsRegistrationPage SHALL 現在選択されている値のボタンを視覚的に強調表示する
5. WHEN `cc_assignee` が更新されたとき、THE System SHALL SyncQueue を通じてスプレッドシートへ即時同期する

---

### 要件6: 報告日設定フィールド

**ユーザーストーリー:** 担当者として、報告日の設定状況をボタン1つで切り替えたい。そうすることで、報告スケジュールの管理を効率化できる。

#### 受け入れ基準

1. THE ReinsRegistrationPage SHALL 「する」と「しない」の2つのボタンを表示する
2. WHEN ユーザーが「する」ボタンをクリックしたとき、THE System SHALL `report_date_setting` を `"する"` に更新する
3. WHEN ユーザーが「しない」ボタンをクリックしたとき、THE System SHALL `report_date_setting` を `"しない"` に更新する
4. THE ReinsRegistrationPage SHALL 現在選択されている値のボタンを視覚的に強調表示する
5. WHEN `report_date_setting` が更新されたとき、THE System SHALL SyncQueue を通じてスプレッドシートへ即時同期する

---

### 要件7: データ保存とスプレッドシート同期

**ユーザーストーリー:** 担当者として、ボタンをクリックした直後にデータが保存・同期されることを確認したい。そうすることで、スプレッドシートとの整合性を保てる。

#### 受け入れ基準

1. WHEN ユーザーがいずれかのフィールドのボタンをクリックしたとき、THE System SHALL `property_listings` テーブルの該当カラムを即座に更新する
2. WHEN DBの更新が成功したとき、THE System SHALL SyncQueue を通じてスプレッドシートへの同期をキューに追加する
3. IF DBの更新が失敗したとき、THEN THE System SHALL エラーメッセージをユーザーに表示する
4. THE System SHALL ボタンクリック後に更新中であることを視覚的に示す（ローディング状態）
5. WHEN 更新が完了したとき、THE System SHALL 成功を示すフィードバックをユーザーに表示する
