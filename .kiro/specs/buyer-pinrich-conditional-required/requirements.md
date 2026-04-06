# 要件ドキュメント

## はじめに

買主リストの詳細ページにおいて「Pinrich」フィールドを条件付き必須項目にする機能。

メールアドレスが空白でなく、かつ「業者問合せ」フィールドが空白の場合に、「Pinrich」フィールドの入力を必須とする。

この機能は買主詳細画面（`BuyerDetailPage.tsx`）に適用する。

---

## 用語集

- **Pinrich（pinrich）**: 買主への配信状況を記録するフィールド。選択肢は「未選択」「配信中」「クローズ」の3つ
- **メールアドレス（email）**: 買主のメールアドレスを記録するテキストフィールド
- **業者問合せ（broker_inquiry）**: 業者からの問い合わせかどうかを記録するフィールド。選択肢は「業者問合せ」「業者（両手）」の2つ
- **必須バリデーション**: フィールドが空の場合に保存を阻止し、ユーザーに入力を促す処理
- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **ValidationWarningDialog**: 必須フィールド未入力時に表示する警告ダイアログコンポーネント
- **ISNOTBLANK**: スプレッドシートの関数。フィールドが空白でない（null、空文字列、空白文字のみでない）場合にtrueを返す
- **ISBLANK**: スプレッドシートの関数。フィールドが空白（null、空文字列、空白文字のみ）の場合にtrueを返す

---

## 要件

### 要件1：Pinrichの条件付き必須バリデーション

**ユーザーストーリー：** 担当者として、メールアドレスが入力されていて業者問合せでない買主に対して、Pinrichの入力を強制したい。そうすることで、配信状況の記録漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN 買主詳細画面で保存ボタンが押され、メールアドレスが空白でなく、業者問合せが空白であり、Pinrichが空欄である場合、THE BuyerDetailPage SHALL 保存を阻止し、必須入力エラーを表示する

2. WHILE メールアドレスが空白（null、空文字列、または空白文字のみ）の場合、THE BuyerDetailPage SHALL Pinrichを必須として扱わない

3. WHILE 業者問合せが空白でない（「業者問合せ」または「業者（両手）」が選択されている）場合、THE BuyerDetailPage SHALL メールアドレスに関わらずPinrichを必須として扱わない

4. WHEN Pinrichが必須条件を満たしていない状態で保存が試みられた場合、THE ValidationWarningDialog SHALL 「Pinrich」を未入力必須フィールドとして一覧に表示する

5. THE BuyerDetailPage SHALL メールアドレスの空白判定において、`String(value).trim()` を使用して空白文字のみの値を空白として扱う

6. THE BuyerDetailPage SHALL 業者問合せの空白判定において、`null`、`undefined`、空文字列、空白文字のみを空白として扱う

---

### 要件2：条件式の実装

**ユーザーストーリー：** 開発者として、スプレッドシートの条件式と同じロジックを実装したい。そうすることで、スプレッドシートとフロントエンドで一貫した動作を保証できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL Pinrichの必須判定を以下の条件式で実装する：`AND(ISNOTBLANK([メールアドレス]), ISBLANK([業者問合せ]))`

2. THE BuyerDetailPage SHALL `ISNOTBLANK` の実装として、以下の条件を全て満たす場合に「空白でない」と判定する：
   - 値が `null` でない
   - 値が `undefined` でない
   - `String(value).trim()` の結果が空文字列でない

3. THE BuyerDetailPage SHALL `ISBLANK` の実装として、以下のいずれかを満たす場合に「空白」と判定する：
   - 値が `null`
   - 値が `undefined`
   - `String(value).trim()` の結果が空文字列

4. THE BuyerDetailPage SHALL メールアドレスが `null` または `undefined` の場合、Pinrichを必須として扱わない

5. THE BuyerDetailPage SHALL 業者問合せが「業者問合せ」または「業者（両手）」の場合、Pinrichを必須として扱わない

---

### 要件3：Pinrichフィールドのハイライト表示

**ユーザーストーリー：** 担当者として、Pinrichが必須になった際に視覚的に分かりやすく表示してほしい。そうすることで、どのフィールドを入力すべきか即座に把握できる。

#### 受け入れ基準

1. WHEN Pinrichの条件付き必須バリデーションが発動した場合、THE BuyerDetailPage SHALL `missingRequiredFields` に `pinrich` を追加し、フィールドをハイライト表示する

2. THE BuyerDetailPage SHALL 既存の `REQUIRED_FIELD_LABEL_MAP` において `pinrich` を「Pinrich」として定義し、ValidationWarningDialog に正しい表示名を渡す

3. WHEN Pinrichが入力済みの場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `pinrich` を除外し、ハイライトを解除する

4. THE BuyerDetailPage SHALL Pinrichのドロップダウンフィールドにおいて、必須条件を満たしていない場合に赤枠でハイライト表示する

---

### 要件4：メールアドレス変更時の動的バリデーション

**ユーザーストーリー：** 担当者として、メールアドレスを変更した際に、Pinrichの必須状態がリアルタイムで更新されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN メールアドレスフィールドが変更された場合、THE BuyerDetailPage SHALL Pinrichの必須状態を再計算し、`missingRequiredFields` を更新する

2. WHEN メールアドレスに値が入力され、業者問合せが空白で、Pinrichが空欄の場合、THE BuyerDetailPage SHALL `missingRequiredFields` に `pinrich` を追加する

3. WHEN メールアドレスが空白にクリアされた場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `pinrich` を削除する

4. THE BuyerDetailPage SHALL メールアドレスの変更時に、業者問合せの条件（空白であること）も考慮して必須状態を判定する

---

### 要件5：業者問合せ変更時の動的バリデーション

**ユーザーストーリー：** 担当者として、業者問合せを変更した際に、Pinrichの必須状態がリアルタイムで更新されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN 業者問合せフィールドが変更された場合、THE BuyerDetailPage SHALL Pinrichの必須状態を再計算し、`missingRequiredFields` を更新する

2. WHEN 業者問合せに値が選択された場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `pinrich` を削除する

3. WHEN 業者問合せが空白にクリアされ、メールアドレスが空白でなく、Pinrichが空欄の場合、THE BuyerDetailPage SHALL `missingRequiredFields` に `pinrich` を追加する

4. THE BuyerDetailPage SHALL 業者問合せの変更時に、メールアドレスの条件（空白でないこと）も考慮して必須状態を判定する

---

### 要件6：Pinrichドロップダウン変更時の動的バリデーション

**ユーザーストーリー：** 担当者として、Pinrichのドロップダウンを選択・解除した際に、必須状態がリアルタイムで更新されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN Pinrichのドロップダウンが選択された場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `pinrich` を削除する

2. WHEN Pinrichのドロップダウンが「未選択」に変更された場合、THE BuyerDetailPage SHALL 必須条件（メールアドレスが空白でない かつ 業者問合せが空白）を満たす場合のみ `missingRequiredFields` に `pinrich` を追加する

3. WHEN Pinrichのドロップダウンが「未選択」に変更され、必須条件を満たさない場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `pinrich` を削除する

---

### 要件7：既存の必須バリデーションとの共存

**ユーザーストーリー：** 担当者として、既存の必須バリデーションが壊れないようにしてほしい。そうすることで、他の必須フィールドのチェックが引き続き正常に動作する。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 既存の `checkMissingFields` 関数において、Pinrichの条件付き必須チェックを追加する際に、既存の必須チェックロジックを維持する

2. THE BuyerDetailPage SHALL Pinrichの条件付き必須チェックが既存の必須チェックと重複して `pinrich` を2回 `missingKeys` に追加しないよう処理する

3. FOR ALL 既存の必須フィールド（`inquiry_source`、`latest_status`、`distribution_type`、`owned_home_hearing_result` 等）、THE BuyerDetailPage SHALL 今回の変更によって既存のバリデーションロジックが変更されないことを保証する

4. THE BuyerDetailPage SHALL Pinrichの条件付き必須チェックを `isPinrichRequired` ヘルパー関数として実装し、コードの重複を避ける

---

### 要件8：初期表示時の必須フィールドチェック

**ユーザーストーリー：** 担当者として、買主詳細画面を開いた際に、既に必須条件を満たしているが未入力のフィールドがハイライト表示されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN 買主詳細画面が表示され、メールアドレスが空白でなく、業者問合せが空白であり、Pinrichが空欄の場合、THE BuyerDetailPage SHALL 初期表示時に `missingRequiredFields` に `pinrich` を追加する

2. THE BuyerDetailPage SHALL 買主データ取得後（`fetchBuyer` 完了後）に `checkMissingFields` を実行し、Pinrichの必須状態を判定する

3. WHEN 初期表示時にPinrichが必須条件を満たしている場合、THE BuyerDetailPage SHALL Pinrichフィールドを赤枠でハイライト表示する

---

### 要件9：日本語ファイル編集時のエンコーディング保護

**ユーザーストーリー：** 開発者として、日本語を含むファイルを編集する際にShift-JIS変換が発生しないようにしてほしい。そうすることで、ビルドエラーや文字化けを防ぐことができる。

#### 受け入れ基準

1. WHEN 日本語文字列を含む `.tsx` ファイルを編集する場合、THE 開発プロセス SHALL Pythonスクリプトを使用してUTF-8エンコーディングで書き込みを行う

2. THE 開発プロセス SHALL `strReplace` ツールを使用した日本語ファイルの直接編集を避け、Pythonスクリプト経由での変更適用を優先する

3. WHEN ファイル編集後にビルドを実行する場合、THE 開発プロセス SHALL `getDiagnostics` ツールでエンコーディングエラーがないことを確認する
