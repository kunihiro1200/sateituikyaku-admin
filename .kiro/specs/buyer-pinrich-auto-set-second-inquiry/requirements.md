# 要件ドキュメント

## はじめに

買主リストにおいて「●問合せ元（inquiry_source）」フィールドが `'2件目以降'` の場合、Pinrich（pinrich）フィールドを初期値 `'登録不要（不可）'` で自動セットし、かつ編集不可（読み取り専用）にする機能。

この機能は以下の画面・システムに適用される：
- 買主詳細ページ（BuyerDetailPage）
- 新規買主登録ページ（NewBuyerPage）
- バックエンドAPI（保存時の自動セット）
- スプレッドシート同期（DB→スプシ、スプシ→DBの双方向）

## 用語集

- **BuyerDetailPage**: 買主詳細ページ（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **NewBuyerPage**: 新規買主登録ページ（`frontend/src/pages/NewBuyerPage.tsx`）
- **inquiry_source**: 買主の問合せ元フィールド（DBカラム名）。スプレッドシートでは `●問合せ元` に対応
- **pinrich**: 買主のPinrichフィールド（DBカラム名）。スプレッドシートでは `Pinrich` に対応
- **2件目以降**: `inquiry_source` の選択肢の一つ。2件目以降の問合せを示す
- **登録不要（不可）**: `pinrich` の選択肢の一つ。Pinrich登録が不要かつ不可であることを示す
- **BuyerService**: 買主データのCRUD処理を担うバックエンドサービス（`backend/src/services/BuyerService.ts`）
- **BuyerSyncService**: 買主スプレッドシート同期を担うバックエンドサービス（`backend/src/services/BuyerSyncService.ts`）
- **EnhancedAutoSyncService**: 自動同期を担うバックエンドサービス（`backend/src/services/EnhancedAutoSyncService.ts`）
- **BuyerColumnMapper**: スプレッドシートとDBのカラムマッピングを担うサービス（`backend/src/services/BuyerColumnMapper.ts`）

---

## 要件

### 要件1：フロントエンド表示時の自動セットと読み取り専用化

**ユーザーストーリー：** 担当者として、問合せ元が「2件目以降」の買主を開いたとき、Pinrichフィールドが自動的に「登録不要（不可）」にセットされ編集できない状態で表示されることを望む。そうすることで、誤ってPinrichを設定してしまうミスを防げる。

#### 受け入れ基準

1. WHEN `inquiry_source` が `'2件目以降'` の買主詳細ページを表示するとき、THE BuyerDetailPage SHALL `pinrich` フィールドの値を `'登録不要（不可）'` として表示する
2. WHEN `inquiry_source` が `'2件目以降'` の買主詳細ページを表示するとき、THE BuyerDetailPage SHALL `pinrich` フィールドを読み取り専用（編集不可）として表示する
3. WHEN `inquiry_source` が `'2件目以降'` の新規買主登録ページを表示するとき、THE NewBuyerPage SHALL `pinrich` フィールドの値を `'登録不要（不可）'` として表示する
4. WHEN `inquiry_source` が `'2件目以降'` の新規買主登録ページを表示するとき、THE NewBuyerPage SHALL `pinrich` フィールドを読み取り専用（編集不可）として表示する
5. WHEN `inquiry_source` が `'2件目以降'` 以外の値である場合、THE BuyerDetailPage SHALL `pinrich` フィールドを従来通り編集可能として表示する
6. WHEN `inquiry_source` が `'2件目以降'` 以外の値である場合、THE NewBuyerPage SHALL `pinrich` フィールドを従来通り編集可能として表示する

---

### 要件2：問合せ元変更時のリアルタイム連動

**ユーザーストーリー：** 担当者として、問合せ元を「2件目以降」に変更した瞬間に、Pinrichフィールドが自動的に「登録不要（不可）」にセットされ編集不可になることを望む。そうすることで、手動でPinrichを変更する手間が省ける。

#### 受け入れ基準

1. WHEN 買主詳細ページで `inquiry_source` を `'2件目以降'` に変更するとき、THE BuyerDetailPage SHALL `pinrich` フィールドの値を即座に `'登録不要（不可）'` に更新する
2. WHEN 買主詳細ページで `inquiry_source` を `'2件目以降'` に変更するとき、THE BuyerDetailPage SHALL `pinrich` フィールドを即座に読み取り専用に切り替える
3. WHEN 買主詳細ページで `inquiry_source` を `'2件目以降'` から別の値に変更するとき、THE BuyerDetailPage SHALL `pinrich` フィールドを編集可能に戻す
4. WHEN 新規買主登録ページで `inquiry_source` を `'2件目以降'` に変更するとき、THE NewBuyerPage SHALL `pinrich` フィールドの値を即座に `'登録不要（不可）'` に更新する
5. WHEN 新規買主登録ページで `inquiry_source` を `'2件目以降'` に変更するとき、THE NewBuyerPage SHALL `pinrich` フィールドを即座に読み取り専用に切り替える

---

### 要件3：バックエンドAPIでの自動セット

**ユーザーストーリー：** システム管理者として、フロントエンドを経由しない更新（API直接呼び出しやスプレッドシート同期）でも、`inquiry_source` が `'2件目以降'` の場合に `pinrich` が必ず `'登録不要（不可）'` になることを望む。そうすることで、データの整合性が保たれる。

#### 受け入れ基準

1. WHEN 買主データの作成リクエストで `inquiry_source` が `'2件目以降'` である場合、THE BuyerService SHALL `pinrich` フィールドを `'登録不要（不可）'` に自動セットして保存する
2. WHEN 買主データの更新リクエストで `inquiry_source` が `'2件目以降'` である場合、THE BuyerService SHALL `pinrich` フィールドを `'登録不要（不可）'` に自動セットして保存する
3. WHEN 買主データの更新リクエストで `inquiry_source` が `'2件目以降'` 以外の値である場合、THE BuyerService SHALL `pinrich` フィールドをリクエストの値のまま保存する
4. IF 買主データの更新リクエストで `inquiry_source` が `'2件目以降'` であり、かつリクエストに `pinrich` の値が含まれる場合、THEN THE BuyerService SHALL リクエストの `pinrich` 値を無視して `'登録不要（不可）'` を保存する

---

### 要件4：既存データの自動補完

**ユーザーストーリー：** 担当者として、既存の買主データで `inquiry_source` が `'2件目以降'` かつ `pinrich` が未設定のものを開いたとき、自動的に `'登録不要（不可）'` がセットされることを望む。そうすることで、過去データも整合性が保たれる。

#### 受け入れ基準

1. WHEN `inquiry_source` が `'2件目以降'` かつ `pinrich` が空（null または空文字）の既存買主データを取得するとき、THE BuyerDetailPage SHALL `pinrich` フィールドを `'登録不要（不可）'` として表示する
2. WHEN `inquiry_source` が `'2件目以降'` かつ `pinrich` が空（null または空文字）の既存買主データを保存するとき、THE BuyerService SHALL `pinrich` フィールドを `'登録不要（不可）'` に自動セットして保存する
3. WHEN `inquiry_source` が `'2件目以降'` かつ `pinrich` に既に値が設定されている既存買主データを取得するとき、THE BuyerDetailPage SHALL `pinrich` フィールドを `'登録不要（不可）'` として表示する（既存値を上書き）

---

### 要件5：スプレッドシート→DB同期時の自動セット

**ユーザーストーリー：** システム管理者として、スプレッドシートから買主データをDBに同期する際、`●問合せ元` が `'2件目以降'` の行は `Pinrich` フィールドが `'登録不要（不可）'` に自動セットされることを望む。そうすることで、スプレッドシート経由の更新でもデータ整合性が保たれる。

#### 受け入れ基準

1. WHEN スプレッドシートから買主データを同期するとき、THE EnhancedAutoSyncService SHALL `●問合せ元` が `'2件目以降'` の行の `Pinrich` フィールドを `'登録不要（不可）'` に自動セットしてDBに保存する
2. WHEN スプレッドシートから買主データを同期するとき、THE EnhancedAutoSyncService SHALL `●問合せ元` が `'2件目以降'` 以外の行の `Pinrich` フィールドをスプレッドシートの値のままDBに保存する
3. IF スプレッドシートの `●問合せ元` が `'2件目以降'` であり、かつ `Pinrich` 列に別の値が入力されている場合、THEN THE EnhancedAutoSyncService SHALL スプレッドシートの `Pinrich` 値を無視して `'登録不要（不可）'` をDBに保存する

---

### 要件6：DB→スプレッドシート同期時の自動セット

**ユーザーストーリー：** システム管理者として、DBからスプレッドシートに買主データを同期する際、`inquiry_source` が `'2件目以降'` の行は `Pinrich` 列が `'登録不要（不可）'` に自動セットされることを望む。そうすることで、スプレッドシートのデータも常に正しい状態が保たれる。

#### 受け入れ基準

1. WHEN DBからスプレッドシートに買主データを書き込むとき、THE BuyerWriteService SHALL `inquiry_source` が `'2件目以降'` の行の `Pinrich` 列を `'登録不要（不可）'` に自動セットして書き込む
2. WHEN DBからスプレッドシートに買主データを書き込むとき、THE BuyerWriteService SHALL `inquiry_source` が `'2件目以降'` 以外の行の `Pinrich` 列をDBの値のまま書き込む
3. IF DBの `inquiry_source` が `'2件目以降'` であり、かつ `pinrich` に別の値が保存されている場合、THEN THE BuyerWriteService SHALL DBの `pinrich` 値を無視して `'登録不要（不可）'` をスプレッドシートに書き込む
