# 要件定義書

## はじめに

買主リストの内覧ページ（`BuyerViewingResultPage`）に「内覧後売主連絡」フィールドを新規追加する。このフィールドはスプレッドシートのV列に対応し、内覧形態に「一般」という文字が含まれる場合にのみ表示される。選択肢は「済」「未」「不要」の3択ボタン形式で、特定条件下では必須入力となる。また、買主リストのサイドバーに「一般媒介_内覧後売主連絡未」カテゴリーを追加する。

### 背景

一般媒介契約の物件を内覧した買主に対して、売主への連絡状況を管理する必要がある。現状はスプレッドシートのV列（内覧後売主連絡）で管理しているが、システム上から入力・確認できないため、業務効率が低下している。また、連絡未完了の案件をサイドバーカテゴリーで一覧表示することで、対応漏れを防ぐ。

---

## 用語集

- **BuyerViewingResultPage**: 内覧ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ
- **BuyerDetailPage**: 買主詳細ページ。`/buyers/:buyer_number` に対応するフロントエンドページ
- **post_viewing_seller_contact**: 「内覧後売主連絡」フィールドのデータベースカラム名。スプレッドシートのV列に対応
- **viewing_type_general**: 「内覧形態_一般媒介」フィールドのデータベースカラム名。内覧形態に「一般」が含まれるかどうかを示す
- **viewing_mobile**: 「内覧形態」フィールドのデータベースカラム名
- **媒介形態**: スプレッドシートの「媒介形態」列。`[媒介形態] = "一般・公開中"` の条件で使用
- **●内覧日(最新）**: スプレッドシートの内覧日列。DBカラム名は `latest_viewing_date`
- **★内覧結果・後続対応**: スプレッドシートの内覧結果列。DBカラム名は `viewing_result_follow_up`
- **一般媒介_内覧後売主連絡未**: サイドバーカテゴリー名。内覧後に売主連絡が未完了の買主を表示する
- **BuyerStatusCalculator**: `backend/src/services/BuyerStatusCalculator.ts`。買主のステータスを算出するサービス
- **buyer-column-mapping.json**: `backend/src/config/buyer-column-mapping.json`。スプレッドシートとデータベースのカラムマッピング定義ファイル
- **GAS BUYER_COLUMN_MAPPING**: スプレッドシートに紐づいたGASプロジェクト内の買主カラムマッピング定義
- **button-select-layout-rule**: ボタン選択UIのレイアウトルール。ラベルとボタン群を横並びにし、各ボタンに `flex: 1` を付与する

---

## 要件

### 要件1：内覧ページへの「内覧後売主連絡」フィールド追加

**ユーザーストーリー：** 担当者として、内覧ページ上で「内覧後売主連絡」を直接入力・確認したい。そうすることで、一般媒介物件の内覧後に売主への連絡状況を即座に記録でき、対応漏れを防げる。

#### 受け入れ基準

1. WHEN 内覧ページ（`BuyerViewingResultPage`）が表示される WHEN 内覧形態（`viewing_mobile` または `viewing_type_general`）に「一般」という文字が含まれる THEN THE System SHALL 「内覧後売主連絡」フィールドを表示する
2. WHEN 内覧ページが表示される WHEN 内覧形態に「一般」という文字が含まれない THEN THE System SHALL 「内覧後売主連絡」フィールドを表示しない
3. WHEN 「内覧後売主連絡」フィールドが表示される THEN THE System SHALL `button-select-layout-rule.md` に準拠したボタン選択UIで「済」「未」「不要」の3択を表示する
4. WHEN ユーザーが「済」「未」「不要」のいずれかのボタンを選択する THEN THE System SHALL 選択したボタンを強調表示（`variant="contained"`）し、他のボタンを非選択状態（`variant="outlined"`）にする
5. WHEN ユーザーが既に選択済みのボタンを再度クリックする THEN THE System SHALL 選択を解除して空欄状態にする
6. WHEN ユーザーがボタンを選択する THEN THE System SHALL `PUT /api/buyers/:buyer_number` を呼び出して `post_viewing_seller_contact` フィールドをデータベースに即時保存する
7. WHEN 「内覧後売主連絡」フィールドに値が保存されている状態で内覧ページを表示する THEN THE System SHALL 保存済みの値に対応するボタンを選択状態で表示する

---

### 要件2：必須バリデーション

**ユーザーストーリー：** 担当者として、必須条件を満たす場合に「内覧後売主連絡」の入力を促したい。そうすることで、一般媒介・公開中の物件で内覧後の売主連絡漏れを防げる。

#### 受け入れ基準

1. THE System SHALL 以下の全条件を満たす場合に「内覧後売主連絡」を必須入力とする：
   - `[媒介形態] = "一般・公開中"`
   - `[●内覧日(最新）] >= "2025/7/5"`
   - `[●内覧日(最新）] <= TODAY()`
   - `ISNOTBLANK([★内覧結果・後続対応])`
2. WHEN 上記必須条件を全て満たす THEN THE System SHALL フィールドラベルに「内覧後売主連絡*」とアスタリスクを付与して必須であることを示す
3. WHEN 上記必須条件を全て満たす WHEN 「内覧後売主連絡」が空欄の状態で保存操作が行われる THEN THE System SHALL 必須入力エラーを表示する
4. WHEN 上記必須条件のいずれかを満たさない THEN THE System SHALL 「内覧後売主連絡」を任意入力として扱い、アスタリスクを表示しない

---

### 要件3：サイドバーカテゴリー「一般媒介_内覧後売主連絡未」の追加

**ユーザーストーリー：** 担当者として、買主リストのサイドバーで「一般媒介_内覧後売主連絡未」カテゴリーを確認したい。そうすることで、売主連絡が未完了の一般媒介案件を一覧で把握し、対応漏れを防げる。

#### 受け入れ基準

1. THE System SHALL `BuyerStatusCalculator` に「一般媒介_内覧後売主連絡未」ステータスの判定ロジックを追加する
2. WHEN 以下のいずれかの条件を満たす買主が存在する THEN THE System SHALL その買主のステータスを「一般媒介_内覧後売主連絡未」と算出する：
   - 条件A：`[●内覧日(最新）] >= DATE("2025/8/1")` AND `[●内覧日(最新）] < TODAY()` AND `ISBLANK([★内覧結果・後続対応])` AND `ISNOTBLANK([内覧形態_一般媒介])`
   - 条件B：`[内覧後売主連絡] = "未"`
3. WHEN 「一般媒介_内覧後売主連絡未」に該当する買主が1件以上存在する THEN THE System SHALL `BuyerStatusSidebar` にそのカテゴリーと件数を表示する
4. WHEN ユーザーがサイドバーの「一般媒介_内覧後売主連絡未」カテゴリーをクリックする THEN THE System SHALL 買主リストをそのカテゴリーに該当する買主のみに絞り込む
5. WHEN 「一般媒介_内覧後売主連絡未」に該当する買主が0件の場合 THEN THE System SHALL そのカテゴリーをサイドバーに表示しない

---

### 要件4：スプレッドシートV列との同期（buyer-column-sync-rule準拠）

**ユーザーストーリー：** 担当者として、システムで入力した「内覧後売主連絡」がスプレッドシートのV列にも反映されることを期待する。そうすることで、スプレッドシートとシステムのデータが一致し、業務上の混乱を防げる。

#### 受け入れ基準

1. THE System SHALL `backend/src/config/buyer-column-mapping.json` の `spreadsheetToDatabase`（または `spreadsheetToDatabaseExtended`）セクションに `"内覧後売主連絡": "post_viewing_seller_contact"` を追加する
2. THE System SHALL GASの `BUYER_COLUMN_MAPPING` に `'内覧後売主連絡': 'post_viewing_seller_contact'` を追加する
3. THE System SHALL `buyers` テーブルに `post_viewing_seller_contact` カラム（TEXT型）が存在する（`ADD COLUMN IF NOT EXISTS` で冪等に追加）
4. WHEN GASの定期同期（10分ごと）が実行される THEN THE System SHALL スプレッドシートのV列「内覧後売主連絡」の値をデータベースの `post_viewing_seller_contact` カラムに反映する
5. WHEN ユーザーがシステムで「内覧後売主連絡」を更新する THEN THE System SHALL データベースの `post_viewing_seller_contact` カラムを即時更新する

---

### 要件5：買主詳細画面への「内覧後売主連絡」フィールド追加（buyer-new-registration-sync-rule準拠）

**ユーザーストーリー：** 担当者として、買主詳細ページでも「内覧後売主連絡」を確認・編集したい。そうすることで、内覧ページを開かなくても詳細ページから状況を把握できる。

#### 受け入れ基準

1. THE System SHALL `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` に `post_viewing_seller_contact` フィールドを追加する（`fieldType: 'buttonSelect'`）
2. WHEN 買主詳細ページで「内覧後売主連絡」フィールドが表示される WHEN 内覧形態に「一般」が含まれる THEN THE System SHALL フィールドを表示する
3. WHEN 買主詳細ページで「内覧後売主連絡」を更新する THEN THE System SHALL 内覧ページでも同じ値が表示される（同一データソースを参照するため）
4. FOR ALL 有効な `post_viewing_seller_contact` の値（「済」「未」「不要」）に対して、システムへの保存後に取得した値が保存した値と一致する（ラウンドトリップ特性）
