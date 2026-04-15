# 要件定義書

## はじめに

売主リストの通話モードページ（`/sellers/:id/call`）のヘッダーに「訪問準備」ボタンを追加する機能。
ボタンをクリックするとポップアップが開き、訪問前に必要な各種リソースへのリンクを一覧表示する。
査定書リンクは売主ごとの「つながるオンライン」URL（`inquiryUrl`）を動的に表示し、
近隣買主リンクは当該売主の近隣買主ページへのURLを表示する。

## 用語集

- **CallModePage**: 売主管理システムの通話モードページ（`/sellers/:id/call`）
- **訪問準備ポップアップ**: 「訪問準備」ボタンクリック時に表示されるダイアログ
- **inquiryUrl**: 売主ごとに設定された「つながるオンライン」査定書URL（APIから取得済み）
- **近隣買主ページ**: 売主IDに紐づく近隣買主一覧ページ（`/sellers/:id/nearby-buyers`）
- **VisitPreparationButton**: 「訪問準備」ボタンコンポーネント
- **VisitPreparationPopup**: 訪問準備ポップアップダイアログコンポーネント

## 要件

### 要件1：訪問準備ボタンの配置

**ユーザーストーリー：** 営業担当者として、通話モードページのヘッダーから訪問準備リソースに素早くアクセスしたい。そうすることで、訪問前の準備を効率的に行える。

#### 受け入れ基準

1. THE CallModePage SHALL 通話モードページのヘッダー内の「画像」ボタンの左側に「訪問準備」ボタンを表示する
2. WHEN seller?.phoneNumber が存在する場合、THE VisitPreparationButton SHALL ヘッダーの `seller?.phoneNumber` が存在する条件ブロック内に配置される
3. THE VisitPreparationButton SHALL MUI の `Button` コンポーネントを使用し、`variant="outlined"` スタイルで表示する
4. THE VisitPreparationButton SHALL `size="small"` で表示する

---

### 要件2：訪問準備ポップアップの表示

**ユーザーストーリー：** 営業担当者として、「訪問準備」ボタンをクリックしたときにポップアップが開き、必要なリソースへのリンクを確認したい。

#### 受け入れ基準

1. WHEN 「訪問準備」ボタンがクリックされる、THE VisitPreparationPopup SHALL MUI の `Dialog` コンポーネントを使用してポップアップを表示する
2. THE VisitPreparationPopup SHALL ポップアップの先頭に「＊準備前に必ずカレンダーに●つけてください！！」というメッセージを表示する
3. THE VisitPreparationPopup SHALL 上記メッセージを視覚的に目立つスタイル（例：赤色・太字）で表示する
4. WHEN ポップアップが表示される、THE VisitPreparationPopup SHALL 以下の6項目をリンク付きで表示する：
   - 「添付資料」
   - 「ぜんりん」
   - 「謄本」
   - 「査定書」
   - 「成約事例」
   - 「近隣買主」
5. WHEN ポップアップの閉じるボタンまたはダイアログ外がクリックされる、THE VisitPreparationPopup SHALL ポップアップを閉じる

---

### 要件3：固定リンクの表示

**ユーザーストーリー：** 営業担当者として、訪問準備に必要な外部サービスへのリンクをポップアップから直接開きたい。

#### 受け入れ基準

1. THE VisitPreparationPopup SHALL 「添付資料」リンクのURLを `https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I/edit?gid=422937915#gid=422937915` とする
2. THE VisitPreparationPopup SHALL 「ぜんりん」リンクのURLを `https://app.zip-site.com/reos/app/index.htm` とする
3. THE VisitPreparationPopup SHALL 「謄本」リンクのURLを `https://www.jtn-map.com/member/kiyaku.asp` とする
4. THE VisitPreparationPopup SHALL 「成約事例」リンクのURLを `https://atbb.athome.jp/` とする
5. THE VisitPreparationPopup SHALL 全ての固定リンクを `target="_blank"` かつ `rel="noopener noreferrer"` で新しいタブで開く

---

### 要件4：査定書リンクの動的表示

**ユーザーストーリー：** 営業担当者として、売主ごとの「つながるオンライン」査定書リンクをポップアップから開きたい。

#### 受け入れ基準

1. WHEN `inquiryUrl` が存在する場合、THE VisitPreparationPopup SHALL 「査定書」項目に `inquiryUrl` をリンクとして表示する
2. WHEN `inquiryUrl` が存在しない場合（null または空文字）、THE VisitPreparationPopup SHALL 「査定書」項目に「（リンクなし）」というテキストを表示する
3. THE VisitPreparationPopup SHALL 「査定書」リンクを `target="_blank"` かつ `rel="noopener noreferrer"` で新しいタブで開く

---

### 要件5：近隣買主リンクの動的表示

**ユーザーストーリー：** 営業担当者として、当該売主の近隣買主ページへのリンクをポップアップから開きたい。

#### 受け入れ基準

1. WHEN `seller?.id` が存在する場合、THE VisitPreparationPopup SHALL 「近隣買主」項目に `/sellers/${seller.id}/nearby-buyers` へのリンクを表示する
2. THE VisitPreparationPopup SHALL 「近隣買主」リンクを `target="_blank"` で新しいタブで開く
3. WHEN `seller?.id` が存在しない場合、THE VisitPreparationPopup SHALL 「近隣買主」項目に「（リンクなし）」というテキストを表示する

---

### 要件6：リンクの視認性

**ユーザーストーリー：** 営業担当者として、ポップアップ内の各リンクを素早く識別して操作したい。

#### 受け入れ基準

1. THE VisitPreparationPopup SHALL 各リンク項目をリスト形式（番号付き）で表示する
2. THE VisitPreparationPopup SHALL 各リンクをクリック可能なアンカー要素として表示する
3. THE VisitPreparationPopup SHALL 各リンクに項目名（「添付資料」「ぜんりん」等）をラベルとして表示する
