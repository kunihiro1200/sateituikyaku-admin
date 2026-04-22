# 要件定義書

## はじめに

本機能は、業務依頼詳細画面（`WorkTaskDetailModal`）の「媒介契約」タブ（tabIndex=0）および「サイト登録」タブ（tabIndex=1）のヘッダーに「スプシ」ボタンを追加するものです。

既存の「契約決済」タブ（tabIndex=2）・「売主、買主詳細」タブ（tabIndex=3）には台帳シート（gid=78322744）へのスプシボタンが実装済みです。本機能では、各タブに対応する異なるシートへ遷移するボタンを追加します。

- 「媒介契約」タブ → 「媒介依頼」シート（gid=1819926492）
- 「サイト登録」タブ → 「athome」シート（gid=1725934947）

なお、本機能はフロントエンドのみの変更で完結します（バックエンド・DB変更なし）。

## 用語集

- **WorkTaskDetailModal**: 業務依頼詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **スプシURL**: `work_tasks` テーブルの `spreadsheet_url` カラムに格納されたGoogleスプレッドシートのURL
- **スプシボタン**: ヘッダーに設置する「スプシ」ラベルのボタン
- **媒介契約タブ**: `WorkTaskDetailModal` のタブインデックス0
- **サイト登録タブ**: `WorkTaskDetailModal` のタブインデックス1
- **媒介依頼シート**: スプレッドシート内の「媒介依頼」という名前のシートページ（gid=1819926492）
- **athomeシート**: スプレッドシート内の「athome」という名前のシートページ（gid=1725934947）
- **spreadsheetUrl.ts**: `frontend/frontend/src/utils/spreadsheetUrl.ts` に定義されたURL生成ユーティリティ

---

## 要件

### 要件1: 媒介契約タブのスプシボタン表示

**ユーザーストーリー:** 業務担当者として、「媒介契約」タブを表示中にヘッダーの「スプシ」ボタンを押すと、その案件の「媒介依頼」シートに直接遷移したい。そうすることで、スプレッドシートを開いてから手動でシートを探す手間を省ける。

#### 受け入れ基準

1. WHILE タブインデックスが0（媒介契約）のとき、THE WorkTaskDetailModal SHALL ヘッダーに「スプシ」ボタンを表示する
2. WHEN ユーザーが媒介契約タブのヘッダーの「スプシ」ボタンをクリックしたとき、THE WorkTaskDetailModal SHALL 新しいタブでスプレッドシートの「媒介依頼」シートページを開く
3. THE WorkTaskDetailModal SHALL 媒介依頼シートへの遷移URLを `{スプシURLのベースURL}/edit#gid=1819926492` の形式で生成する
4. THE WorkTaskDetailModal SHALL 媒介依頼シートのgidを定数 `1819926492` として管理する

---

### 要件2: サイト登録タブのスプシボタン表示

**ユーザーストーリー:** 業務担当者として、「サイト登録」タブを表示中にヘッダーの「スプシ」ボタンを押すと、その案件の「athome」シートに直接遷移したい。そうすることで、スプレッドシートを開いてから手動でシートを探す手間を省ける。

#### 受け入れ基準

1. WHILE タブインデックスが1（サイト登録）のとき、THE WorkTaskDetailModal SHALL ヘッダーに「スプシ」ボタンを表示する
2. WHEN ユーザーがサイト登録タブのヘッダーの「スプシ」ボタンをクリックしたとき、THE WorkTaskDetailModal SHALL 新しいタブでスプレッドシートの「athome」シートページを開く
3. THE WorkTaskDetailModal SHALL athomeシートへの遷移URLを `{スプシURLのベースURL}/edit#gid=1725934947` の形式で生成する
4. THE WorkTaskDetailModal SHALL athomeシートのgidを定数 `1725934947` として管理する

---

### 要件3: スプシボタンの活性・非活性制御

**ユーザーストーリー:** 業務担当者として、スプシURLが未設定の案件では「スプシ」ボタンが押せないことを視覚的に確認できるようにしたい。

#### 受け入れ基準

1. WHEN `spreadsheet_url` フィールドに有効なURLが設定されているとき、THE WorkTaskDetailModal SHALL 媒介契約タブおよびサイト登録タブの「スプシ」ボタンを活性状態で表示する
2. IF `spreadsheet_url` フィールドがnullまたは空文字のとき、THEN THE WorkTaskDetailModal SHALL 媒介契約タブおよびサイト登録タブの「スプシ」ボタンを非活性状態（disabled）で表示する

---

### 要件4: タブごとのシートURL生成ロジック

**ユーザーストーリー:** 業務担当者として、タブに応じた正しいシートへ遷移できるようにしたい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL タブインデックスに応じて遷移先のシートgidを切り替える（tabIndex=0 → 1819926492、tabIndex=1 → 1725934947）
2. THE WorkTaskDetailModal SHALL `spreadsheet_url` から `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit` の形式のベースURLを抽出する
3. WHEN `spreadsheet_url` に既に `#gid=` パラメータが含まれているとき、THE WorkTaskDetailModal SHALL そのパラメータを除去してからタブに対応するシートのgidを付加する
4. WHEN `spreadsheet_url` に `?gid=` クエリパラメータが含まれているとき、THE WorkTaskDetailModal SHALL そのパラメータを除去してからタブに対応するシートのgidを付加する
5. IF `spreadsheet_url` がGoogleスプレッドシートのURLとして解析できないとき、THEN THE WorkTaskDetailModal SHALL `spreadsheet_url` をそのまま新しいタブで開く

---

### 要件5: 既存実装との整合性

**ユーザーストーリー:** 開発者として、既存のスプシボタン実装（tabIndex=2・3）と一貫したコードパターンで新しいタブのボタンを追加したい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL 既存の `spreadsheetUrl.ts` ユーティリティを拡張する形でタブごとのURL生成関数を追加する
2. THE WorkTaskDetailModal SHALL 新しいスプシボタンを既存のヘッダー要素と同一行に配置する
3. THE WorkTaskDetailModal SHALL 新しいスプシボタンのスタイルを既存のスプシボタン（tabIndex=2・3）と統一する
