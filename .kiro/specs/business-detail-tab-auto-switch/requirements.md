# 要件定義書

## はじめに

本機能は、業務一覧画面（`WorkTasksPage`）でカテゴリーをクリックして案件（業務詳細モーダル）を開いた際に、クリックしたカテゴリーの種別に応じて `WorkTaskDetailModal` の表示タブを自動的に切り替えるものです。

現在の実装では、業務詳細モーダルは常にタブインデックス 0（「媒介契約」タブ）で開きます。カテゴリーによっては「サイト登録」タブや「契約決済」タブの情報が主要な操作対象となるため、クリックしたカテゴリーに対応するタブを自動的に表示することで、担当者の操作効率を向上させます。

## 用語集

- **WorkTasksPage**: 業務一覧画面（`frontend/frontend/src/pages/WorkTasksPage.tsx`）
- **WorkTaskDetailModal**: 業務詳細モーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **selectedCategory**: `WorkTasksPage` で現在選択されているカテゴリーのキー文字列（ステータス文字列と同一）
- **tabIndex**: `WorkTaskDetailModal` 内のタブ表示インデックス（0: 媒介契約、1: サイト登録、2: 契約決済、3: 売主、買主詳細）
- **initialTabIndex**: モーダルを開く際に渡す初期タブインデックス
- **カテゴリープレフィックス**: `calculateTaskStatus` が返すステータス文字列の先頭部分（例: 「媒介作成_締日」「サイト登録依頼してください」）

---

## 要件

### 要件1: カテゴリーに応じた初期タブの自動切り替え

**ユーザーストーリー:** 業務担当者として、業務一覧でカテゴリーをクリックして案件を開いた際に、そのカテゴリーに関連するタブが自動的に表示されることで、目的の情報にすぐアクセスしたい。

#### 受け入れ基準

1. WHEN ユーザーが「媒介」で始まるカテゴリーを選択した状態で行をクリックしたとき、THE WorkTaskDetailModal SHALL タブインデックス 0（「媒介契約」タブ）で開く

2. WHEN ユーザーが「サイト」で始まるカテゴリーを選択した状態で行をクリックしたとき、THE WorkTaskDetailModal SHALL タブインデックス 1（「サイト登録」タブ）で開く

3. WHEN ユーザーが「売買契約」で始まるカテゴリーを選択した状態で行をクリックしたとき、THE WorkTaskDetailModal SHALL タブインデックス 2（「契約決済」タブ）で開く

4. WHEN ユーザーが「決済」で始まるカテゴリーを選択した状態で行をクリックしたとき、THE WorkTaskDetailModal SHALL タブインデックス 2（「契約決済」タブ）で開く

5. WHEN ユーザーが「要台帳」で始まるカテゴリーを選択した状態で行をクリックしたとき、THE WorkTaskDetailModal SHALL タブインデックス 2（「契約決済」タブ）で開く

6. WHEN ユーザーが上記以外のカテゴリー（「all」を含む）を選択した状態で行をクリックしたとき、THE WorkTaskDetailModal SHALL タブインデックス 0（「媒介契約」タブ）で開く

---

### 要件2: initialTabIndex プロパティの追加

**ユーザーストーリー:** 業務担当者として、モーダルを開いた際に常に正しいタブが表示されることで、余分なタブ切り替え操作をなくしたい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL `initialTabIndex` プロパティ（省略可能、デフォルト値 0）を受け取る

2. WHEN `WorkTaskDetailModal` が開かれたとき、THE WorkTaskDetailModal SHALL `initialTabIndex` の値でタブを初期表示する

3. WHEN `WorkTaskDetailModal` が閉じられて再度開かれたとき、THE WorkTaskDetailModal SHALL 新たに渡された `initialTabIndex` の値でタブを初期表示する（前回のタブ状態を引き継がない）

4. WHERE `initialTabIndex` が省略されたとき、THE WorkTaskDetailModal SHALL タブインデックス 0（「媒介契約」タブ）で開く

---

### 要件3: カテゴリーからタブインデックスへのマッピングロジック

**ユーザーストーリー:** 開発者として、カテゴリー文字列からタブインデックスへの変換ロジックが一箇所に集約されていることで、将来のカテゴリー追加・変更に対応しやすくしたい。

#### 受け入れ基準

1. THE WorkTasksPage SHALL カテゴリーキー文字列からタブインデックスを返す変換関数（`getInitialTabIndexFromCategory`）を持つ

2. THE `getInitialTabIndexFromCategory` 関数 SHALL 以下のマッピングルールを適用する
   - 「媒介」で始まる文字列 → 0
   - 「サイト」で始まる文字列 → 1
   - 「売買契約」で始まる文字列 → 2
   - 「決済」で始まる文字列 → 2
   - 「要台帳」で始まる文字列 → 2
   - それ以外（「all」を含む） → 0

3. THE `getInitialTabIndexFromCategory` 関数 SHALL 空文字列または `null` を受け取った場合に 0 を返す

4. THE WorkTasksPage SHALL `handleRowClick` 内で `getInitialTabIndexFromCategory(selectedCategory)` を呼び出し、結果を `WorkTaskDetailModal` の `initialTabIndex` プロパティに渡す

---

### 要件4: 既存動作の保全

**ユーザーストーリー:** 業務担当者として、タブ自動切り替え機能の追加後も、モーダル内でのタブ手動切り替えや保存などの既存機能が正常に動作することを期待する。

#### 受け入れ基準

1. WHEN `WorkTaskDetailModal` が開かれた後にユーザーが手動でタブをクリックしたとき、THE WorkTaskDetailModal SHALL クリックされたタブに切り替える（手動切り替えは引き続き機能する）

2. THE WorkTaskDetailModal SHALL 既存の全タブ（「媒介契約」「サイト登録」「契約決済」「売主、買主詳細」）の内容・保存機能を変更しない

3. THE WorkTaskDetailModal SHALL `initialTabIndex` プロパティが追加された後も、既存の `open`・`onClose`・`propertyNumber`・`onUpdate`・`initialData` プロパティの動作を変更しない
