# 要件定義書

## はじめに

本機能は、業務依頼（business detail）画面の「売主、買主詳細」タブにある売主TEL・買主TELフィールドにおいて、日本の電話番号の先頭「0」が欠落している場合に自動的に補完する機能を実装するものです。

スプレッドシートからの同期時や、フロントエンドでの入力・保存時に、電話番号の先頭が「0」でない場合（例：`90-1234-5678`）は自動的に「0」を付加（例：`090-1234-5678`）してDBに保存・表示します。

既存の `seller_contact_tel`（売主TEL）および `buyer_contact_tel`（買主TEL）カラムは `work_tasks` テーブルに既に存在しており、フロントエンドの `SellerBuyerDetailSection` コンポーネントおよびスプレッドシートマッピングも実装済みです。本機能は既存実装に「0」補完ロジックを追加するものです。

## 用語集

- **PhoneNormalizer**: 電話番号の先頭「0」補完ロジックを担うユーティリティ関数（新規作成）
- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **SellerBuyerDetailSection**: 「売主、買主詳細」タブのコンテンツコンポーネント（`WorkTaskDetailModal` 内に定義）
- **WorkTaskColumnMapper**: `backend/src/services/WorkTaskColumnMapper.ts` - スプレッドシートとDBカラムのマッピングおよびデータ変換を担うサービス
- **WorkTaskSyncService**: `backend/src/services/WorkTaskSyncService.ts` - スプレッドシートとDBの同期を担うサービス
- **work_tasks**: 業務依頼データを格納するSupabaseテーブル
- **seller_contact_tel**: `work_tasks` テーブルの売主電話番号カラム（TEXT型）
- **buyer_contact_tel**: `work_tasks` テーブルの買主電話番号カラム（TEXT型）
- **先頭0補完**: 電話番号文字列の先頭が「0」でない場合に「0」を付加する処理

---

## 要件

### 要件1: 電話番号の先頭「0」補完ロジック

**ユーザーストーリー:** 業務担当者として、売主・買主の電話番号を入力・同期する際に先頭の「0」が自動補完されることで、電話番号の表記ゆれを防ぎ、正確な情報をDBに保存したい。

#### 受け入れ基準

1. THE PhoneNormalizer SHALL 電話番号文字列の先頭が「0」でない場合に「0」を付加した文字列を返す
2. WHEN 電話番号文字列の先頭が既に「0」である場合、THE PhoneNormalizer SHALL 元の文字列をそのまま返す
3. WHEN 電話番号文字列が空文字・null・undefinedである場合、THE PhoneNormalizer SHALL 入力値をそのまま返す（補完しない）
4. THE PhoneNormalizer SHALL 数字・ハイフン・括弧以外の文字を含む文字列に対しても先頭「0」補完のみを行い、文字列の内容を変更しない
5. FOR ALL 有効な電話番号文字列 `s`（先頭が「0」でない）に対して、`PhoneNormalizer.normalize(s)` の結果は `"0" + s` と等しい（ラウンドトリッププロパティ）

---

### 要件2: フロントエンドでの保存時の先頭「0」補完

**ユーザーストーリー:** 業務担当者として、業務詳細画面で売主TEL・買主TELを入力・編集して保存する際に、先頭「0」が自動補完された状態でDBに保存されることを期待する。

#### 受け入れ基準

1. WHEN ユーザーが `WorkTaskDetailModal` の売主TELフィールドに先頭「0」なしの電話番号を入力して保存したとき、THE WorkTaskDetailModal SHALL `seller_contact_tel` に先頭「0」を付加した値を保存する
2. WHEN ユーザーが `WorkTaskDetailModal` の買主TELフィールドに先頭「0」なしの電話番号を入力して保存したとき、THE WorkTaskDetailModal SHALL `buyer_contact_tel` に先頭「0」を付加した値を保存する
3. WHEN ユーザーが売主TEL・買主TELフィールドに先頭「0」ありの電話番号を入力して保存したとき、THE WorkTaskDetailModal SHALL 値を変更せずにそのまま保存する
4. WHEN ユーザーが売主TEL・買主TELフィールドを空にして保存したとき、THE WorkTaskDetailModal SHALL 空値（null）をそのまま保存する（「0」を付加しない）
5. THE WorkTaskDetailModal SHALL 売主TEL・買主TEL以外のフィールドの保存動作を変更しない

---

### 要件3: スプレッドシート同期時の先頭「0」補完

**ユーザーストーリー:** 業務担当者として、スプレッドシートから同期された売主TEL・買主TELの値に先頭「0」が自動補完されることで、スプシ側の表記ゆれに関わらず正確な電話番号がDBに保存されることを期待する。

#### 受け入れ基準

1. WHEN `WorkTaskColumnMapper.mapToDatabase` がスプレッドシートの「売主TEL」カラムの値を変換するとき、THE WorkTaskColumnMapper SHALL 先頭「0」がない場合に「0」を付加した値を `seller_contact_tel` に設定する
2. WHEN `WorkTaskColumnMapper.mapToDatabase` がスプレッドシートの「買主TEL」カラムの値を変換するとき、THE WorkTaskColumnMapper SHALL 先頭「0」がない場合に「0」を付加した値を `buyer_contact_tel` に設定する
3. WHEN スプレッドシートの「売主TEL」または「買主TEL」カラムの値が空である場合、THE WorkTaskColumnMapper SHALL `null` を設定する（「0」を付加しない）
4. THE WorkTaskColumnMapper SHALL 「売主TEL」「買主TEL」以外のカラムの変換動作を変更しない

---

### 要件4: DBへの保存・表示の一貫性

**ユーザーストーリー:** 業務担当者として、業務詳細画面で表示される売主TEL・買主TELが常に先頭「0」ありの形式で表示されることを期待する。

#### 受け入れ基準

1. WHEN `work_tasks` テーブルの `seller_contact_tel` または `buyer_contact_tel` に先頭「0」なしの値が既に保存されている場合、THE WorkTaskDetailModal SHALL 表示時に先頭「0」を付加して表示する
2. THE WorkTaskDetailModal SHALL DBから取得した売主TEL・買主TELの値を `SellerBuyerDetailSection` に渡す前に先頭「0」補完を適用する
3. WHEN 売主TEL・買主TELの値が null または空文字である場合、THE WorkTaskDetailModal SHALL 空のまま表示する（「0」を付加しない）

