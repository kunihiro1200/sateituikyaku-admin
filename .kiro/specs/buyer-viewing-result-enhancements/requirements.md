# 要件定義書

## はじめに

買主リストの内覧結果ページ（`BuyerViewingResultPage`）に対して、以下の3つの機能を追加する。

1. **後続担当に「業者」選択ボタンを追加する**（カレンダー送信先を `tenant@ifoo-oita.com` に設定）
2. **内覧日（最新）に日付が入ったら、時間・内覧形態・後続担当を必須にする**
3. **必須3項目がすべて入力された場合のみ「カレンダーで開く」ボタンを有効化する**

## 用語集

- **BuyerViewingResultPage**: 内覧結果・後続対応ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ
- **後続担当（follow_up_assignee）**: 内覧後の後続対応を担当するスタッフのイニシャルまたは識別子。`buyer.follow_up_assignee` フィールドに保存される
- **業者**: 後続担当の特殊な選択肢。選択時はカレンダーの送信先を `tenant@ifoo-oita.com` に設定する
- **内覧形態**: 内覧の種別を示すフィールド。専任物件の場合は `viewing_mobile`、一般媒介物件の場合は `viewing_type_general` に保存される
- **カレンダーで開く**: Googleカレンダーの新規イベント作成URLを開くボタン。後続担当のメールアドレスをゲストとして招待する
- **staffInitials**: バックエンドの `/api/employees/active-initials` から取得するアクティブ社員のイニシャル一覧
- **tenant@ifoo-oita.com**: 「業者」選択時のカレンダー送信先メールアドレス

---

## 要件

### 要件1：後続担当に「業者」選択ボタンを追加する

**ユーザーストーリー：** 担当者として、後続担当として「業者」を選択できるようにしたい。そうすることで、業者が後続対応する場合にカレンダーを業者のメールアドレス（`tenant@ifoo-oita.com`）に送信できる。

#### 受け入れ基準

1. THE BuyerViewingResultPage SHALL 後続担当ボタン群の末尾に「業者」ボタンを表示する
2. WHEN 「業者」ボタンをクリックする場合、THE BuyerViewingResultPage SHALL `follow_up_assignee` フィールドに `'業者'` を保存する
3. WHEN 「業者」ボタンが選択済みの状態で再度クリックする場合、THE BuyerViewingResultPage SHALL `follow_up_assignee` フィールドを空文字列にクリアする
4. WHEN `follow_up_assignee` が `'業者'` の場合、THE BuyerViewingResultPage SHALL 「カレンダーで開く」ボタンクリック時にカレンダーの送信先（ゲスト招待先）を `tenant@ifoo-oita.com` に設定する
5. WHEN `follow_up_assignee` が `'業者'` の場合、THE BuyerViewingResultPage SHALL 従業員マスタの検索をスキップして `tenant@ifoo-oita.com` を直接使用する

---

### 要件2：内覧日入力時に時間・内覧形態・後続担当を必須にする

**ユーザーストーリー：** 担当者として、内覧日が入力されたときに必要な情報（時間・内覧形態・後続担当）の入力漏れを防ぎたい。そうすることで、カレンダー登録に必要な情報が確実に揃う。

#### 受け入れ基準

1. WHEN `buyer.viewing_date` に日付が入力されている場合、THE BuyerViewingResultPage SHALL 「時間」フィールドを必須として視覚的に強調表示する（赤枠・赤ラベル）
2. WHEN `buyer.viewing_date` に日付が入力されている場合、THE BuyerViewingResultPage SHALL 「内覧形態」ボタン群を必須として視覚的に強調表示する（赤枠・赤ラベル）
3. WHEN `buyer.viewing_date` に日付が入力されている場合、THE BuyerViewingResultPage SHALL 「後続担当」ボタン群を必須として視覚的に強調表示する（赤枠・赤ラベル）
4. WHEN `buyer.viewing_date` が空欄の場合、THE BuyerViewingResultPage SHALL 時間・内覧形態・後続担当の必須強調表示を行わない
5. WHEN `buyer.viewing_time` に値が入力されている場合、THE BuyerViewingResultPage SHALL 「時間」フィールドの必須強調表示を解除する
6. WHEN 内覧形態（`viewing_mobile` または `viewing_type_general`）に値が入力されている場合、THE BuyerViewingResultPage SHALL 「内覧形態」の必須強調表示を解除する
7. WHEN `buyer.follow_up_assignee` に値が入力されている場合、THE BuyerViewingResultPage SHALL 「後続担当」の必須強調表示を解除する

---

### 要件3：必須3項目が揃った場合のみ「カレンダーで開く」ボタンを有効化する

**ユーザーストーリー：** 担当者として、カレンダー登録に必要な情報が揃っていない状態でボタンを押せないようにしたい。そうすることで、不完全な情報でカレンダーを開く操作ミスを防げる。

#### 受け入れ基準

1. WHEN `buyer.viewing_date` が入力済み かつ `buyer.viewing_time` が入力済み かつ `buyer.follow_up_assignee` が入力済み かつ 内覧形態（`viewing_mobile` または `viewing_type_general`）が入力済みの場合、THE BuyerViewingResultPage SHALL 「カレンダーで開く」ボタンを有効化する
2. WHEN 上記4条件のいずれか1つでも未入力の場合、THE BuyerViewingResultPage SHALL 「カレンダーで開く」ボタンを無効化（`disabled`）する
3. WHEN 「カレンダーで開く」ボタンが無効の場合、THE BuyerViewingResultPage SHALL ボタンをグレーアウト表示する
4. WHEN 「カレンダーで開く」ボタンが有効の場合、THE BuyerViewingResultPage SHALL 既存の強調アニメーション（`calendarPulse`）を維持する
5. THE BuyerViewingResultPage SHALL 内覧形態の判定において、専任物件の場合は `viewing_mobile`、一般媒介物件の場合は `viewing_type_general` を参照する
