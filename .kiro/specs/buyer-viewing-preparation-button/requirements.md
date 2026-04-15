# 要件定義書

## はじめに

買主詳細画面（`/buyers/:buyer_number`）のヘッダーに「内覧準備」ボタンを追加する機能。
ボタンをクリックするとポップアップが開き、内覧前に必要な情報（買主番号・物件番号のコピー、各種リソースへのリンク）を一覧表示する。
買主番号・物件番号はワンクリックでクリップボードにコピーできる。

## 用語集

- **BuyerDetailPage**: 買主管理システムの買主詳細画面（`/buyers/:buyer_number`）
- **内覧準備ポップアップ**: 「内覧準備」ボタンクリック時に表示されるダイアログ
- **買主番号**: 買主を一意に識別する番号（`buyer.buyer_number`）
- **物件番号**: 買主に紐づく物件を識別する番号（リンク済み物件の `property_number`）
- **ViewingPreparationButton**: 「内覧準備」ボタンコンポーネント
- **ViewingPreparationPopup**: 内覧準備ポップアップダイアログコンポーネント

## 要件

### 要件1：内覧準備ボタンの配置

**ユーザーストーリー：** 営業担当者として、買主詳細画面のヘッダーから内覧準備リソースに素早くアクセスしたい。そうすることで、内覧前の準備を効率的に行える。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 買主詳細画面のヘッダー内の「近隣物件」ボタンの左側に「内覧準備」ボタンを表示する
2. THE ViewingPreparationButton SHALL MUI の `Button` コンポーネントを使用し、`variant="outlined"` スタイルで表示する
3. THE ViewingPreparationButton SHALL `size="small"` で表示する

---

### 要件2：内覧準備ポップアップの表示

**ユーザーストーリー：** 営業担当者として、「内覧準備」ボタンをクリックしたときにポップアップが開き、内覧準備に必要な情報を確認したい。

#### 受け入れ基準

1. WHEN 「内覧準備」ボタンがクリックされる、THE ViewingPreparationPopup SHALL MUI の `Dialog` コンポーネントを使用してポップアップを表示する
2. THE ViewingPreparationPopup SHALL ポップアップのタイトルに「内覧準備資料」を表示する
3. THE ViewingPreparationPopup SHALL タイトル直下に「※準備前にカレンダーに●をつけてください」という注意書きを表示する
4. THE ViewingPreparationPopup SHALL 上記注意書きを視覚的に目立つスタイル（例：赤色・太字）で表示する
5. WHEN ポップアップの閉じるボタンまたはダイアログ外がクリックされる、THE ViewingPreparationPopup SHALL ポップアップを閉じる

---

### 要件3：買主番号のコピー機能

**ユーザーストーリー：** 営業担当者として、買主番号をワンクリックでコピーして他のツールに貼り付けたい。

#### 受け入れ基準

1. THE ViewingPreparationPopup SHALL 「買主番号」ラベルとともに `buyer.buyer_number` の値を表示する
2. WHEN 買主番号の表示エリアがクリックされる、THE ViewingPreparationPopup SHALL `buyer.buyer_number` の値をクリップボードにコピーする
3. WHEN コピーが成功する、THE ViewingPreparationPopup SHALL コピー完了を示すフィードバック（例：アイコン変化またはスナックバー）を表示する
4. WHEN `buyer.buyer_number` が存在しない場合、THE ViewingPreparationPopup SHALL 買主番号の表示エリアに「（未設定）」を表示する

---

### 要件4：物件番号のコピー機能

**ユーザーストーリー：** 営業担当者として、物件番号をワンクリックでコピーして他のツールに貼り付けたい。

#### 受け入れ基準

1. THE ViewingPreparationPopup SHALL 「物件番号」ラベルとともに、買主に紐づく物件の `property_number` を表示する
2. WHEN 物件番号の表示エリアがクリックされる、THE ViewingPreparationPopup SHALL `property_number` の値をクリップボードにコピーする
3. WHEN コピーが成功する、THE ViewingPreparationPopup SHALL コピー完了を示すフィードバック（例：アイコン変化またはスナックバー）を表示する
4. WHEN 買主に紐づく物件が複数存在する場合、THE ViewingPreparationPopup SHALL 最初の物件の `property_number` を表示する
5. WHEN 買主に紐づく物件が存在しない場合、THE ViewingPreparationPopup SHALL 物件番号の表示エリアに「（未設定）」を表示する

---

### 要件5：スプシの資料リンクの表示

**ユーザーストーリー：** 営業担当者として、内覧準備用のスプレッドシートへのリンクをポップアップから直接開きたい。

#### 受け入れ基準

1. THE ViewingPreparationPopup SHALL 「スプシの資料」というラベルで固定URLへのリンクを表示する
2. THE ViewingPreparationPopup SHALL 「スプシの資料」リンクのURLを `https://docs.google.com/spreadsheets/d/1M9uVzHWD2ipzoY5Om3h3a2-_uQa9D_UGhpB5U4_nyRc/edit?gid=195766785#gid=195766785` とする
3. THE ViewingPreparationPopup SHALL 「スプシの資料」リンクを `target="_blank"` かつ `rel="noopener noreferrer"` で新しいタブで開く

---

### 要件6：ATBBリンクの表示

**ユーザーストーリー：** 営業担当者として、ATBBの詳細ページ・地図・インフォシートを印刷するためのリンクをポップアップから直接開きたい。

#### 受け入れ基準

1. THE ViewingPreparationPopup SHALL 「ATBB」セクションとして「①詳細ページと②地図③インフォシートを印刷」というラベルでリンクを表示する
2. THE ViewingPreparationPopup SHALL ATBBリンクのURLを `https://atbb.athome.jp/` とする
3. THE ViewingPreparationPopup SHALL ATBBリンクを `target="_blank"` かつ `rel="noopener noreferrer"` で新しいタブで開く

---

### 要件7：リンクの視認性

**ユーザーストーリー：** 営業担当者として、ポップアップ内の各項目を素早く識別して操作したい。

#### 受け入れ基準

1. THE ViewingPreparationPopup SHALL 買主番号・物件番号のコピーエリアをリスト形式で表示する
2. THE ViewingPreparationPopup SHALL 各リンク項目をリスト形式（番号付き）で表示する
3. THE ViewingPreparationPopup SHALL 各リンクをクリック可能なアンカー要素として表示する
4. THE ViewingPreparationPopup SHALL コピー可能な項目にコピーアイコン（`ContentCopy`）を表示する
