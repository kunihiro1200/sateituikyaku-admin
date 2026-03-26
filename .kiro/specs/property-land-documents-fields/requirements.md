# 要件定義書

## はじめに

業務詳細画面（WorkTaskDetailModal）のサイト登録タブにおいて、種別（property_type）が「土」の場合のみ表示する3つのフィールドを追加する機能の要件定義です。

現状の調査により、以下が判明しています：
- `work-task-column-mapping.json` に `cadastral_map_url`、`cadastral_map_sales_input`、`cadastral_map_field` の3カラムが既に定義済み
- `WorkTaskDetailModal.tsx` の `SiteRegistrationSection` に `cadastral_map_sales_input` と `cadastral_map_field` の条件分岐が既に実装済み
- ただし `cadastral_map_url` フィールドは現在ボタン選択UIとして実装されており、要件（URLテキスト入力）と異なる
- `work_tasks` テーブルに対応カラムが存在するかどうかはマイグレーション確認が必要
- スプレッドシートとの双方向同期はGASの10分トリガーで行われる

---

## 用語集

- **WorkTask**: 業務依頼データ。`work_tasks` テーブルに格納される
- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **SiteRegistrationSection**: WorkTaskDetailModal内のサイト登録タブのセクション
- **property_type**: 物件種別。「土」「戸」「マ」等の値を持つ
- **cadastral_map_url**: 字図・地積測量図のURLを格納するDBカラム
- **cadastral_map_sales_input**: 地積測量図・字図（営業入力）を格納するDBカラム
- **cadastral_map_field**: 地積測量図・字図の選択状態を格納するDBカラム
- **GAS**: Google Apps Script。スプレッドシート→DB同期を10分ごとに実行
- **SyncQueue**: DB→スプレッドシートの即時同期を担うサービス

---

## 要件

### 要件1: 字図・地積測量図URLフィールドの表示制御

**ユーザーストーリー:** 担当者として、種別が「土」の物件の業務詳細画面でのみ字図・地積測量図URLを入力したい。そうすることで、土地物件に特有の書類URLを管理できる。

#### 受け入れ基準

1. WHEN WorkTaskDetailModalのサイト登録タブを表示する時、THE System SHALL `property_type` フィールドの値を取得する
2. WHEN `property_type` の値が「土」である時、THE System SHALL 「字図、地積測量図URL」ラベルのテキスト入力フィールドを表示する
3. WHEN `property_type` の値が「土」以外（「戸」「マ」等）である時、THE System SHALL 「字図、地積測量図URL」フィールドを非表示にする
4. THE System SHALL 「字図、地積測量図URL」フィールドをURLタイプのテキスト入力として実装し、入力値を `cadastral_map_url` カラムに保存する
5. WHEN `cadastral_map_url` に値が入力されている時、THE System SHALL フィールドの横に「開く」リンクを表示し、URLを新しいタブで開けるようにする

---

### 要件2: 地積測量図・字図（営業入力）フィールドの表示制御

**ユーザーストーリー:** 担当者として、種別が「土」の物件の業務詳細画面でのみ地積測量図・字図の営業入力欄を表示したい。そうすることで、土地物件に特有の情報を入力できる。

#### 受け入れ基準

1. WHEN `property_type` の値が「土」である時、THE System SHALL 「地積測量図・字図（営業入力）」ラベルのテキスト入力フィールドを表示する
2. WHEN `property_type` の値が「土」以外である時、THE System SHALL 「地積測量図・字図（営業入力）」フィールドを非表示にする
3. THE System SHALL 入力値を `cadastral_map_sales_input` カラムに保存する

---

### 要件3: 地積測量図・字図ボタン選択フィールドの表示制御

**ユーザーストーリー:** 担当者として、種別が「土」の物件の業務詳細画面でのみ地積測量図・字図の状態をボタンで選択したい。そうすることで、書類の準備状況を素早く記録できる。

#### 受け入れ基準

1. WHEN `property_type` の値が「土」である時、THE System SHALL 「地積測量図、字図」ラベルのボタン選択UIを表示する
2. WHEN `property_type` の値が「土」以外である時、THE System SHALL 「地積測量図、字図」ボタン選択UIを非表示にする
3. THE System SHALL ボタン選択UIに「格納済み＆スプシに「有、無」を入力済み」「未」「不要」の3つの選択肢を提供する
4. THE System SHALL ボタン選択UIをbutton-select-layout-rule.mdのレイアウトルールに従い実装する（ラベルとボタンを横並び、各ボタンに `flex: 1` を付与して均等幅）
5. THE System SHALL 選択値を `cadastral_map_field` カラムに保存する

---

### 要件4: フィールドの表示順序

**ユーザーストーリー:** 担当者として、種別=土の場合のフィールドが適切な順序で表示されることを期待する。そうすることで、業務フローに沿った入力ができる。

#### 受け入れ基準

1. WHEN `property_type` が「土」である時、THE System SHALL サイト登録タブの「サイト備考」フィールドの直後に以下の順序でフィールドを表示する：
   - 「字図、地積測量図URL」（URLテキスト入力、アスタリスク付きラベル）
   - 「地積測量図・字図（営業入力）」（テキスト入力）
   - 「地積測量図、字図」（ボタン選択UI）

---

### 要件5: データ保存

**ユーザーストーリー:** 担当者として、入力した値が正しくデータベースに保存されることを期待する。そうすることで、データの永続化が保証される。

#### 受け入れ基準

1. WHEN 保存ボタンをクリックする時、THE System SHALL `cadastral_map_url`、`cadastral_map_sales_input`、`cadastral_map_field` の変更値を `work_tasks` テーブルに保存する
2. THE System SHALL `work_tasks` テーブルに `cadastral_map_url` カラム（TEXT型）が存在することを保証する
3. THE System SHALL `work_tasks` テーブルに `cadastral_map_sales_input` カラム（TEXT型）が存在することを保証する
4. THE System SHALL `work_tasks` テーブルに `cadastral_map_field` カラム（TEXT型）が存在することを保証する

---

### 要件6: スプレッドシート双方向同期

**ユーザーストーリー:** 担当者として、業務詳細画面で入力した値がスプレッドシートに反映され、またスプレッドシートの変更がDBに反映されることを期待する。そうすることで、スプレッドシートとDBのデータ整合性が保たれる。

#### 受け入れ基準

1. WHEN `work_tasks` テーブルの `cadastral_map_url`、`cadastral_map_sales_input`、`cadastral_map_field` が更新される時、THE System SHALL スプレッドシートの対応カラム（「字図、地積測量図URL」「地積測量図・字図（営業入力）」「地積測量図、字図」）に即時同期する
2. WHEN GASの10分トリガーが実行される時、THE System SHALL スプレッドシートの「字図、地積測量図URL」「地積測量図・字図（営業入力）」「地積測量図、字図」カラムの値を `work_tasks` テーブルに同期する
3. THE System SHALL `work-task-column-mapping.json` に3カラムのマッピングが定義されていることを保証する（既に定義済みであることを確認済み）
