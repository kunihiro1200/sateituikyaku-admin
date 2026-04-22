# 要件定義書

## はじめに

本機能は、業務依頼詳細画面（`WorkTaskDetailModal`）の「契約決済」タブおよび「売主、買主詳細」タブのヘッダーに「スプシ」ボタンを設置するものです。

このボタンを押すと、その案件に紐づくスプレッドシート（`spreadsheet_url` フィールドに格納されたURL）の「台帳」シートページに直接遷移します。

Googleスプレッドシートでは、特定のシートへの遷移に `#gid=` パラメータ（シートID）が必要です。しかし、`spreadsheet_url` にはシートIDが含まれていない場合があるため、「台帳」シートへの遷移は以下の方式で実現します：スプシURLのベースURLに `#gid=` パラメータを付加する形で遷移先URLを生成します。台帳シートのシートIDは固定値として管理するか、またはURLをそのまま開いてユーザーが手動でシートを選択する方式とします。

なお、本機能はフロントエンドのみの変更で完結します（バックエンド・DB変更なし）。

## 用語集

- **WorkTaskDetailModal**: 業務依頼詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **スプシURL**: `work_tasks` テーブルの `spreadsheet_url` カラムに格納されたGoogleスプレッドシートのURL
- **台帳シート**: スプレッドシート内の「台帳」という名前のシートページ
- **スプシボタン**: ヘッダーに設置する「スプシ」ラベルのボタン
- **契約決済タブ**: `WorkTaskDetailModal` のタブインデックス2（`ContractSettlementSection`）
- **売主、買主詳細タブ**: `WorkTaskDetailModal` のタブインデックス3（`SellerBuyerDetailSection`）
- **台帳シートgid**: 台帳シートのシートID。全案件共通の固定値 `78322744`

---

## 要件

### 要件1: スプシボタンの表示

**ユーザーストーリー:** 業務担当者として、「契約決済」タブまたは「売主、買主詳細」タブを表示中に「スプシ」ボタンをヘッダーで確認できるようにしたい。そうすることで、関連するスプレッドシートにすぐアクセスできる。

#### 受け入れ基準

1. WHILE タブインデックスが2（契約決済）または3（売主、買主詳細）のとき、THE WorkTaskDetailModal SHALL ヘッダーに「スプシ」ボタンを表示する
2. WHILE タブインデックスが0（媒介契約）または1（サイト登録）のとき、THE WorkTaskDetailModal SHALL ヘッダーに「スプシ」ボタンを表示しない
3. THE WorkTaskDetailModal SHALL 「スプシ」ボタンを既存のヘッダー要素（物件番号・物件住所・種別・売主氏名・担当名・媒介バッジ等）と同一行に配置する

---

### 要件2: スプシボタンの活性・非活性制御

**ユーザーストーリー:** 業務担当者として、スプシURLが未設定の案件では「スプシ」ボタンが押せないことを視覚的に確認できるようにしたい。

#### 受け入れ基準

1. WHEN `spreadsheet_url` フィールドに有効なURLが設定されているとき、THE WorkTaskDetailModal SHALL 「スプシ」ボタンを活性状態で表示する
2. IF `spreadsheet_url` フィールドがnullまたは空文字のとき、THEN THE WorkTaskDetailModal SHALL 「スプシ」ボタンを非活性状態（disabled）で表示する

---

### 要件3: 台帳シートへの遷移

**ユーザーストーリー:** 業務担当者として、「スプシ」ボタンを押すと、その案件のスプレッドシートの「台帳」シートページに直接遷移したい。そうすることで、スプレッドシートを開いてから手動でシートを探す手間を省ける。

#### 受け入れ基準

1. WHEN ユーザーが「スプシ」ボタンをクリックしたとき、THE WorkTaskDetailModal SHALL 新しいタブでスプレッドシートの「台帳」シートページを開く
2. THE WorkTaskDetailModal SHALL 遷移先URLを `{spreadsheet_url のベースURL}/edit#gid={台帳シートのgid}` の形式で生成する
3. THE WorkTaskDetailModal SHALL `spreadsheet_url` に既に `#gid=` パラメータが含まれている場合、そのパラメータを除去してから台帳シートのgidを付加する
4. THE WorkTaskDetailModal SHALL 台帳シートのgidを定数 `78322744` として管理する

---

### 要件4: 遷移先URLの生成ロジック

**ユーザーストーリー:** 業務担当者として、様々な形式のスプシURLに対しても正しく台帳シートへ遷移できるようにしたい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL `spreadsheet_url` から `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit` の形式のベースURLを抽出する
2. WHEN `spreadsheet_url` が `https://docs.google.com/spreadsheets/d/{ID}/edit#gid=XXXXX` の形式のとき、THE WorkTaskDetailModal SHALL `#gid=XXXXX` 部分を除去してから台帳シートのgidを付加する
3. WHEN `spreadsheet_url` が `https://docs.google.com/spreadsheets/d/{ID}/edit?gid=XXXXX#gid=XXXXX` の形式のとき、THE WorkTaskDetailModal SHALL `?gid=XXXXX` クエリパラメータおよび `#gid=XXXXX` ハッシュ部分を除去してから台帳シートのgidを付加する
4. WHEN `spreadsheet_url` が `https://docs.google.com/spreadsheets/d/{ID}/edit` の形式のとき、THE WorkTaskDetailModal SHALL そのまま台帳シートのgidを付加する
5. IF `spreadsheet_url` がGoogleスプレッドシートのURLとして解析できないとき、THEN THE WorkTaskDetailModal SHALL `spreadsheet_url` をそのまま新しいタブで開く

