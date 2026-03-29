# 要件定義書

## はじめに

売主リストの通話モードページ（`CallModePage`）において、GmailテンプレートのGmail送信で「☆訪問前日通知メール」を送信した後に「通知送信者」フィールドを表示する機能を追加する。

### 背景

現状の実装：
- `AssigneeSection.tsx` の `EMAIL_LABEL_TO_KEY` に `'☆訪問前日通知メール': 'visitReminderAssignee'` が定義済み
- `sellerStatusFilters.ts` の `isVisitDayBefore()` 関数は `visitReminderAssignee` に値がある場合に `false` を返す（訪問日前日カテゴリーから除外）
- `SellerService.supabase.ts` の `decryptSeller` メソッドに `visitReminderAssignee: seller.visit_reminder_assignee` が定義済み
- `sellers` テーブルに `visit_reminder_assignee` カラムが既に存在する（マイグレーション `20260322_add_email_assignee_columns_to_sellers.sql`）

現状の問題：
- 「☆訪問前日通知メール」送信後に「通知送信者」を入力するUIが通話モードページに存在しない
- `visitReminderAssignee` フィールドへの入力手段がなく、訪問日前日カテゴリーからの除外が機能しない
- スタッフのボタン選択UIで直感的に入力できる仕組みが必要

---

## 用語集

- **CallModePage**: 売主リストの通話モードページ。`/sellers/:id/call` に対応するフロントエンドページ
- **AssigneeSection**: 通話モードページ内の担当者設定セクションコンポーネント（`frontend/frontend/src/components/AssigneeSection.tsx`）
- **visitReminderAssignee**: 訪問事前通知メール担当フィールド。DBカラム `visit_reminder_assignee` に対応
- **通知送信者**: 「☆訪問前日通知メール」を送信したスタッフのイニシャル。`visitReminderAssignee` に保存される
- **isVisitDayBefore**: `sellerStatusFilters.ts` の関数。`visitReminderAssignee` に値がある場合に `false` を返す
- **訪問日前日カテゴリー**: サイドバーの `visitDayBefore` カテゴリー。営担あり・今日が訪問日の前営業日（木曜訪問のみ2日前）の条件を満たす売主が表示される
- **通常スタッフ**: スタッフ管理で `normal = true` のスタッフ
- **メール/SMS履歴**: 通話モードページ内の活動履歴（`FollowUpLogHistoryTable`）
- **ボタン選択UI**: ラベルとボタン群を横並びに配置し、各ボタンに `flex: 1` を付与した均等幅のUI（`button-select-layout-rule.md` 準拠）

---

## 要件

### 要件1：「通知送信者」フィールドの条件付き表示

**ユーザーストーリー：** 担当者として、「☆訪問前日通知メール」を送信した後に「通知送信者」フィールドが表示されることを期待する。そうすることで、通知を送ったスタッフを記録でき、訪問日前日カテゴリーから除外できる。

#### 受け入れ基準

1. WHEN 通話モードページが表示される WHEN 活動履歴に「☆訪問前日通知メール」のメール送信記録が存在しない WHEN `visitReminderAssignee` が空欄である THEN THE System SHALL 「通知送信者」フィールドを表示しない
2. WHEN 通話モードページが表示される WHEN 活動履歴に「☆訪問前日通知メール」のメール送信記録が存在する THEN THE System SHALL メール/SMS履歴の下に「通知送信者」フィールドを表示する
3. WHEN 通話モードページが表示される WHEN `visitReminderAssignee` に値が保存されている THEN THE System SHALL メール/SMS履歴の下に「通知送信者」フィールドを表示する
4. WHEN 「通知送信者」フィールドが表示される THEN THE System SHALL ボタン選択UIを使用してスタッフのイニシャルを選択できる形式で表示する
5. WHEN 「通知送信者」フィールドが表示される THEN THE System SHALL スタッフ管理で `normal = true` のスタッフのみをボタンとして表示する

---

### 要件2：ボタン選択UIのレイアウト

**ユーザーストーリー：** 担当者として、「通知送信者」フィールドで直感的にスタッフを選択したい。そうすることで、素早く通知送信者を記録できる。

#### 受け入れ基準

1. THE System SHALL ラベル「通知送信者」とボタン群を横並びに配置する
2. THE System SHALL ボタン群のコンテナに `flex: 1` を付与して残りの幅を全て使用する
3. THE System SHALL 各スタッフボタンに `flex: 1` を付与して均等幅で表示する
4. THE System SHALL ラベルに `whiteSpace: 'nowrap'` と `flexShrink: 0` を付与して折り返しを防ぐ
5. WHEN スタッフボタンが選択されている THEN THE System SHALL 選択中のボタンを `variant="contained"` で強調表示する
6. WHEN スタッフボタンが選択されていない THEN THE System SHALL 未選択のボタンを `variant="outlined"` で表示する
7. WHEN 選択済みのスタッフボタンを再度クリックする THEN THE System SHALL 選択を解除して空文字を保存する

---

### 要件3：「通知送信者」の保存

**ユーザーストーリー：** 担当者として、選択したスタッフが「通知送信者」として保存されることを期待する。そうすることで、データが永続化され、訪問日前日カテゴリーからの除外が即座に反映される。

#### 受け入れ基準

1. WHEN ユーザーがスタッフボタンを選択する THEN THE System SHALL `PUT /api/sellers/:id` を呼び出して `visit_reminder_assignee` フィールドをデータベースに保存する
2. WHEN 保存が成功する THEN THE System SHALL 画面上の選択状態を保存後の値に更新する
3. WHEN 保存が成功する THEN THE System SHALL 売主データの `visitReminderAssignee` が更新され、`isVisitDayBefore()` の再評価によりサイドバーの「訪問日前日」カテゴリーから除外される
4. IF 保存が失敗する THEN THE System SHALL エラーメッセージを表示して選択前の値に戻す
5. WHEN 「通知送信者」フィールドに値が入力されている状態で通話モードページを表示する THEN THE System SHALL 保存済みの値を選択状態として正しく表示する

---

### 要件4：訪問日前日カテゴリーとの連携

**ユーザーストーリー：** 担当者として、「通知送信者」を入力した後、その売主が「訪問日前日」カテゴリーから除外されることを期待する。そうすることで、通知済みの案件が再度通知対象として表示されることを防げる。

#### 受け入れ基準

1. WHEN 「通知送信者」（`visitReminderAssignee`）に値が入力されている売主を判定する THEN THE System SHALL `isVisitDayBefore()` 関数が `false` を返す
2. WHEN 「通知送信者」が空欄の売主を判定する WHEN 営担に入力がある WHEN 今日が訪問日の前営業日である THEN THE System SHALL `isVisitDayBefore()` 関数が `true` を返す
3. THE System SHALL `isVisitDayBefore()` 関数の既存ロジック（`visitReminderAssignee` が入力済みの場合は `false` を返す）を変更しない
4. THE System SHALL 木曜訪問の場合のみ2日前、それ以外は1日前という前営業日ロジックを変更しない

---

### 要件5：スタッフ一覧の取得

**ユーザーストーリー：** 担当者として、ボタン選択UIに現在在籍中のスタッフのみが表示されることを期待する。そうすることで、退職済みスタッフが誤って選択されることを防げる。

#### 受け入れ基準

1. THE System SHALL `getActiveEmployees()` を使用してスタッフ一覧を取得する
2. THE System SHALL `normal = true` のスタッフのみをボタンとして表示する
3. WHEN スタッフ一覧の取得が完了する THEN THE System SHALL 取得したスタッフのイニシャルをボタンとして表示する
4. IF スタッフ一覧の取得が失敗する THEN THE System SHALL ボタンを表示せずフィールドを非表示にする

---

### 要件6：メール送信時の自動入力

**ユーザーストーリー：** 担当者として、「☆訪問前日通知メール」を送信した瞬間に、自分のイニシャルが「通知送信者」として自動的に保存されることを期待する。そうすることで、手動でボタンを選択する手間なく、送信者が正確に記録される。

#### 受け入れ基準

1. WHEN 「☆訪問前日通知メール」のGmail送信が完了する THEN THE System SHALL ログイン中のスタッフのイニシャルを `visitReminderAssignee` に自動保存する
2. WHEN Gmail送信完了の自動保存が実行される THEN THE System SHALL `PUT /api/sellers/:id` を呼び出して `visit_reminder_assignee` フィールドをデータベースに保存する
3. WHEN 自動保存が完了する THEN THE System SHALL 「通知送信者」フィールドのボタン選択UIに自動入力されたイニシャルを選択状態として反映する
4. WHEN 自動保存が完了する THEN THE System SHALL 「通知送信者」フィールドを表示する（未表示だった場合）
5. WHEN 「通知送信者」フィールドに自動入力された値が表示されている THEN THE System SHALL ボタン選択UIから手動で別のスタッフに変更できる
6. WHEN 「通知送信者」フィールドに自動入力された値が表示されている THEN THE System SHALL 選択済みボタンを再クリックすることで選択を解除して空文字を保存できる
7. IF Gmail送信完了時の自動保存が失敗する THEN THE System SHALL エラーメッセージを表示する
