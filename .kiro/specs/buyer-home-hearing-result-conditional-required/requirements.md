# 要件ドキュメント

## はじめに

買主リストの詳細ページにおいて「持家ヒアリング結果」フィールドを条件付き必須項目にする機能。

受付日が2026年3月30日以降、かつ「問合時持家ヒアリング」フィールドが空白でない場合に、「持家ヒアリング結果」フィールドの入力を必須とする。

この機能は買主詳細画面（`BuyerDetailPage.tsx`）に適用する。

---

## 用語集

- **持家ヒアリング結果（owned_home_hearing_result）**: 買主の持家状況のヒアリング結果を記録するフィールド。選択肢は「持家（マンション）」「持家（戸建）」「賃貸」「他不明」の4つ
- **問合時持家ヒアリング（owned_home_hearing_inquiry）**: 問い合わせ時に持家ヒアリングを実施したスタッフのイニシャルを記録するフィールド
- **受付日（reception_date）**: 買主からの問い合わせを受け付けた日付（`YYYY-MM-DD`形式）
- **必須バリデーション**: フィールドが空の場合に保存を阻止し、ユーザーに入力を促す処理
- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **ValidationWarningDialog**: 必須フィールド未入力時に表示する警告ダイアログコンポーネント
- **ISNOTBLANK**: スプレッドシートの関数。フィールドが空白でない（null、空文字列、空白文字のみでない）場合にtrueを返す

---

## 要件

### 要件1：持家ヒアリング結果の条件付き必須バリデーション

**ユーザーストーリー：** 担当者として、受付日が2026/3/30以降で問合時持家ヒアリングが実施された買主に対して、持家ヒアリング結果の入力を強制したい。そうすることで、ヒアリング結果の記録漏れを防ぐことができる。

#### 受け入れ基準

1. WHEN 買主詳細画面で保存ボタンが押され、受付日が2026/3/30以降であり、問合時持家ヒアリングが空白でなく、持家ヒアリング結果が空欄である場合、THE BuyerDetailPage SHALL 保存を阻止し、必須入力エラーを表示する

2. WHILE 受付日が2026/3/30より前の買主レコードを編集している場合、THE BuyerDetailPage SHALL 持家ヒアリング結果を必須として扱わない

3. WHILE 問合時持家ヒアリングが空白（null、空文字列、または空白文字のみ）の場合、THE BuyerDetailPage SHALL 受付日に関わらず持家ヒアリング結果を必須として扱わない

4. WHEN 持家ヒアリング結果が必須条件を満たしていない状態で保存が試みられた場合、THE ValidationWarningDialog SHALL 「持家ヒアリング結果」を未入力必須フィールドとして一覧に表示する

5. THE BuyerDetailPage SHALL 持家ヒアリング結果の条件付き必須判定において、受付日の比較を `2026-03-30` 以降（`>=`）として処理する

6. THE BuyerDetailPage SHALL 問合時持家ヒアリングの空白判定において、`String(value).trim()` を使用して空白文字のみの値を空白として扱う

---

### 要件2：条件式の実装

**ユーザーストーリー：** 開発者として、スプレッドシートの条件式と同じロジックを実装したい。そうすることで、スプレッドシートとフロントエンドで一貫した動作を保証できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 持家ヒアリング結果の必須判定を以下の条件式で実装する：`AND([受付日]>="2026/3/30", ISNOTBLANK([問合時持家ヒアリング]))`

2. THE BuyerDetailPage SHALL `ISNOTBLANK` の実装として、以下の条件を全て満たす場合に「空白でない」と判定する：
   - 値が `null` でない
   - 値が `undefined` でない
   - `String(value).trim()` の結果が空文字列でない

3. THE BuyerDetailPage SHALL 受付日が `null` または `undefined` の場合、持家ヒアリング結果を必須として扱わない

4. THE BuyerDetailPage SHALL 受付日の比較において、日付文字列を `Date` オブジェクトに変換して比較する

---

### 要件3：持家ヒアリング結果フィールドのハイライト表示

**ユーザーストーリー：** 担当者として、持家ヒアリング結果が必須になった際に視覚的に分かりやすく表示してほしい。そうすることで、どのフィールドを入力すべきか即座に把握できる。

#### 受け入れ基準

1. WHEN 持家ヒアリング結果の条件付き必須バリデーションが発動した場合、THE BuyerDetailPage SHALL `missingRequiredFields` に `owned_home_hearing_result` を追加し、フィールドをハイライト表示する

2. THE BuyerDetailPage SHALL 既存の `REQUIRED_FIELD_LABEL_MAP` において `owned_home_hearing_result` を「持家ヒアリング結果」として定義し、ValidationWarningDialog に正しい表示名を渡す

3. WHEN 持家ヒアリング結果が入力済みの場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `owned_home_hearing_result` を除外し、ハイライトを解除する

4. THE BuyerDetailPage SHALL 持家ヒアリング結果の4択ボタン（「持家（マンション）」「持家（戸建）」「賃貸」「他不明」）において、必須条件を満たしていない場合に赤枠でハイライト表示する

---

### 要件4：問合時持家ヒアリング変更時の動的バリデーション

**ユーザーストーリー：** 担当者として、問合時持家ヒアリングを変更した際に、持家ヒアリング結果の必須状態がリアルタイムで更新されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN 問合時持家ヒアリングフィールドが変更された場合、THE BuyerDetailPage SHALL 持家ヒアリング結果の必須状態を再計算し、`missingRequiredFields` を更新する

2. WHEN 問合時持家ヒアリングに値が入力され、持家ヒアリング結果が空欄の場合、THE BuyerDetailPage SHALL `missingRequiredFields` に `owned_home_hearing_result` を追加する

3. WHEN 問合時持家ヒアリングが空白にクリアされた場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `owned_home_hearing_result` を削除する

4. THE BuyerDetailPage SHALL 問合時持家ヒアリングの変更時に、受付日の条件（2026/3/30以降）も考慮して必須状態を判定する

---

### 要件5：持家ヒアリング結果ボタンの動的バリデーション

**ユーザーストーリー：** 担当者として、持家ヒアリング結果の4択ボタンを選択・解除した際に、必須状態がリアルタイムで更新されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN 持家ヒアリング結果の4択ボタンが選択された場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `owned_home_hearing_result` を削除する

2. WHEN 持家ヒアリング結果の4択ボタンが選択解除された場合、THE BuyerDetailPage SHALL 必須条件（受付日>=2026/3/30 かつ 問合時持家ヒアリングが空白でない）を満たす場合のみ `missingRequiredFields` に `owned_home_hearing_result` を追加する

3. WHEN 持家ヒアリング結果の4択ボタンが選択解除され、必須条件を満たさない場合、THE BuyerDetailPage SHALL `missingRequiredFields` から `owned_home_hearing_result` を削除する

---

### 要件6：既存の必須バリデーションとの共存

**ユーザーストーリー：** 担当者として、既存の必須バリデーションが壊れないようにしてほしい。そうすることで、他の必須フィールドのチェックが引き続き正常に動作する。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 既存の `checkMissingFields` 関数において、持家ヒアリング結果の条件付き必須チェックを追加する際に、既存の必須チェックロジックを維持する

2. THE BuyerDetailPage SHALL 持家ヒアリング結果の条件付き必須チェックが既存の必須チェックと重複して `owned_home_hearing_result` を2回 `missingKeys` に追加しないよう処理する

3. FOR ALL 既存の必須フィールド（`inquiry_source`、`latest_status`、`distribution_type` 等）、THE BuyerDetailPage SHALL 今回の変更によって既存のバリデーションロジックが変更されないことを保証する

4. THE BuyerDetailPage SHALL 持家ヒアリング結果の条件付き必須チェックを `isHomeHearingResultRequired` ヘルパー関数として実装し、コードの重複を避ける

---

### 要件7：持家ヒアリング結果フィールドの条件付き表示

**ユーザーストーリー：** 担当者として、問合時持家ヒアリングが「不要」または「未」の場合に持家ヒアリング結果フィールドを非表示にしてほしい。そうすることで、不要なフィールドが表示されず、画面がすっきりする。

#### 受け入れ基準

1. WHEN 問合時持家ヒアリングが「不要」の場合、THE BuyerDetailPage SHALL 持家ヒアリング結果フィールドを非表示にする

2. WHEN 問合時持家ヒアリングが「未」の場合、THE BuyerDetailPage SHALL 持家ヒアリング結果フィールドを非表示にする

3. WHEN 問合時持家ヒアリングが空白（null、空文字列、または空白文字のみ）の場合、THE BuyerDetailPage SHALL 持家ヒアリング結果フィールドを非表示にする

4. WHEN 問合時持家ヒアリングにスタッフのイニシャル（Y、K等）が入力されている場合、THE BuyerDetailPage SHALL 持家ヒアリング結果フィールドを表示する

5. THE BuyerDetailPage SHALL 持家ヒアリング結果フィールドが非表示の場合、必須バリデーションを発動しない

---

### 要件8：初期表示時の必須フィールドチェック

**ユーザーストーリー：** 担当者として、買主詳細画面を開いた際に、既に必須条件を満たしているが未入力のフィールドがハイライト表示されてほしい。そうすることで、保存前に必須フィールドを把握できる。

#### 受け入れ基準

1. WHEN 買主詳細画面が表示され、受付日が2026/3/30以降であり、問合時持家ヒアリングが空白でなく、持家ヒアリング結果が空欄の場合、THE BuyerDetailPage SHALL 初期表示時に `missingRequiredFields` に `owned_home_hearing_result` を追加する

2. THE BuyerDetailPage SHALL 買主データ取得後（`fetchBuyer` 完了後）に `checkMissingFields` を実行し、持家ヒアリング結果の必須状態を判定する

3. WHEN 初期表示時に持家ヒアリング結果が必須条件を満たしている場合、THE BuyerDetailPage SHALL 持家ヒアリング結果フィールドを赤枠でハイライト表示する

---

### 要件9：日本語ファイル編集時のエンコーディング保護

**ユーザーストーリー：** 開発者として、日本語を含むファイルを編集する際にShift-JIS変換が発生しないようにしてほしい。そうすることで、ビルドエラーや文字化けを防ぐことができる。

#### 受け入れ基準

1. WHEN 日本語文字列を含む `.tsx` ファイルを編集する場合、THE 開発プロセス SHALL Pythonスクリプトを使用してUTF-8エンコーディングで書き込みを行う

2. THE 開発プロセス SHALL `strReplace` ツールを使用した日本語ファイルの直接編集を避け、Pythonスクリプト経由での変更適用を優先する

3. WHEN ファイル編集後にビルドを実行する場合、THE 開発プロセス SHALL `getDiagnostics` ツールでエンコーディングエラーがないことを確認する
