# 要件定義書

## はじめに

本機能は、社内管理システムの物件リスト一覧ページ（`PropertyListingsPage`）において、物件番号をクリックするとクリップボードにコピーできる機能を追加するものです。

担当者が物件番号を他のツール（チャット、メール、スプレッドシートなど）に貼り付ける際の手間を削減し、業務効率を向上させることを目的とします。

対象ページ：`frontend/frontend/src/pages/PropertyListingsPage.tsx`

---

## 用語集

- **PropertyListingsPage**: 社内管理システムの物件リスト一覧ページ（`/property-listings`）
- **物件番号（property_number）**: 各物件を一意に識別する番号（例：AA1234）
- **クリップボードコピー**: ブラウザの Clipboard API を使用してテキストをクリップボードに書き込む操作
- **コピー成功トースト**: コピー完了を通知する一時的なポップアップ表示（Snackbar）
- **デスクトップ表示**: 画面幅が `sm` ブレークポイント以上のテーブル形式の表示
- **モバイル表示**: 画面幅が `sm` ブレークポイント未満のカード形式の表示

---

## 要件

### 要件1：物件番号クリックによるクリップボードコピー

**ユーザーストーリー：** 担当者として、物件リスト一覧ページで物件番号をクリックしてクリップボードにコピーしたい。そうすることで、物件番号を手入力せずに他のツールへ素早く貼り付けられる。

#### 受け入れ基準

1. WHEN 物件番号テキストがクリックされた場合、THE PropertyListingsPage SHALL ブラウザの Clipboard API を使用して物件番号の文字列をクリップボードに書き込む
2. WHEN クリップボードへの書き込みが成功した場合、THE PropertyListingsPage SHALL 「コピーしました」というメッセージを含む Snackbar を画面下部に表示する
3. WHEN Snackbar が表示された場合、THE PropertyListingsPage SHALL 2000ミリ秒後に自動的に Snackbar を非表示にする
4. IF クリップボードへの書き込みが失敗した場合、THEN THE PropertyListingsPage SHALL コンソールにエラーを出力し、ユーザーへの通知は行わない
5. WHEN 物件番号がクリックされた場合、THE PropertyListingsPage SHALL 行クリックによるページ遷移イベントの伝播を停止する（`stopPropagation`）

---

### 要件2：デスクトップ表示での物件番号クリック領域

**ユーザーストーリー：** 担当者として、デスクトップのテーブル表示で物件番号をクリックしてコピーしたい。そうすることで、テーブルを見ながら素早く物件番号を取得できる。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL デスクトップ表示のテーブル行において、物件番号セルにコピー用のクリック領域を設ける
2. WHEN 物件番号テキストにマウスカーソルが重なった場合、THE PropertyListingsPage SHALL カーソルを `pointer` に変更し、クリック可能であることを示す
3. WHEN 物件番号テキストにマウスカーソルが重なった場合、THE PropertyListingsPage SHALL コピーアイコン（`ContentCopy`）を物件番号の隣に表示する
4. WHEN マウスカーソルが物件番号テキストから離れた場合、THE PropertyListingsPage SHALL コピーアイコンを非表示にする

---

### 要件3：モバイル表示での物件番号クリック領域

**ユーザーストーリー：** 担当者として、モバイルのカード表示でも物件番号をタップしてコピーしたい。そうすることで、スマートフォンからでも物件番号を素早く取得できる。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL モバイル表示のカードにおいて、物件番号テキストにコピー用のタップ領域を設ける
2. WHEN 物件番号テキストがタップされた場合、THE PropertyListingsPage SHALL カード全体のタップによるページ遷移イベントの伝播を停止する（`stopPropagation`）
3. THE PropertyListingsPage SHALL モバイル表示の物件番号テキストにコピーアイコン（`ContentCopy`）を常時表示する（ホバー状態が存在しないため）

---

### 要件4：コピー通知の表示仕様

**ユーザーストーリー：** 担当者として、コピーが成功したかどうかを視覚的に確認したい。そうすることで、コピー操作が正しく完了したことを確信できる。

#### 受け入れ基準

1. THE PropertyListingsPage SHALL コピー成功時に MUI の `Snackbar` コンポーネントを使用して通知を表示する
2. THE PropertyListingsPage SHALL Snackbar のメッセージを「{物件番号} をコピーしました」の形式で表示する
3. THE PropertyListingsPage SHALL Snackbar を画面の下部中央（`anchorOrigin: { vertical: 'bottom', horizontal: 'center' }`）に表示する
4. WHILE Snackbar が表示されている間、THE PropertyListingsPage SHALL 別の物件番号がコピーされた場合に Snackbar のメッセージを新しい物件番号のメッセージに更新する
