# 要件ドキュメント

## はじめに

買主詳細画面（BuyerDetailPage.tsx）において、必須項目が未入力の状態で別ページへ遷移しようとした際に警告ダイアログを表示する機能を新規実装する。遷移を強制ブロックするのではなく、ユーザーが「このまま移動する」か「画面に留まる」かを選択できる注意喚起にとどめる。

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **BuyerDesiredConditionsPage**: 希望条件ページ（`frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx`）
- **ValidationWarningDialog**: 必須項目未入力時に表示する警告ダイアログコンポーネント
- **distribution_type**: 配信メールフィールド（「要」「不要」等の値を持つ）
- **desired_area**: 希望条件ページのエリアフィールド
- **budget**: 希望条件ページの予算フィールド
- **desired_property_type**: 希望条件ページの希望種別フィールド
- **必須項目**: 入力が推奨される項目（未入力でも遷移は可能だが警告を表示する）

---

## 要件

### 要件1：遷移時の警告ダイアログ表示

**ユーザーストーリー：** 担当者として、買主詳細画面から別ページへ遷移しようとした際に必須項目が未入力であれば警告を受け取りたい。そうすることで、入力漏れに気づいて対処できる。

#### 受け入れ基準

1. WHEN 買主詳細画面から別ページへの遷移が発生し、かつ必須項目が1つ以上未入力の場合、THE ValidationWarningDialog SHALL 警告ダイアログを表示する
2. THE ValidationWarningDialog SHALL 未入力の必須項目名を一覧で表示する
3. THE ValidationWarningDialog SHALL 「このまま移動する」ボタンと「画面に留まる」ボタンの2択を提供する
4. WHEN ユーザーが「このまま移動する」を選択した場合、THE System SHALL 元の遷移先へ移動する
5. WHEN ユーザーが「画面に留まる」を選択した場合、THE System SHALL ダイアログを閉じて買主詳細画面に留まる
6. IF 全ての必須項目が入力済みの場合、THEN THE System SHALL 警告ダイアログを表示せずに遷移する

### 要件2：常時必須項目のバリデーション

**ユーザーストーリー：** 担当者として、買主詳細画面の基本的な必須項目が未入力の場合に警告を受け取りたい。そうすることで、重要な情報の入力漏れを防げる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 以下の4項目を常時必須項目として扱う：初動担当（initial_assignee）、問合せ元（inquiry_source）、★最新状況（latest_status）、配信メール（distribution_type）
2. WHEN 問合せ元（inquiry_source）に「メール」が含まれる場合、THE BuyerDetailPage SHALL 【問合メール】電話対応（inquiry_email_phone）も必須項目として扱う
3. WHILE 問合せ元に「メール」が含まれ、かつ inquiry_email_phone に値が入力されている場合、THE BuyerDetailPage SHALL 3回架電確認済み（three_calls_confirmed）も必須項目として扱う
4. THE BuyerDetailPage SHALL 未入力の必須項目をハイライト表示する（既存実装の維持）

### 要件3：配信メール「要」の場合の希望条件必須項目バリデーション

**ユーザーストーリー：** 担当者として、配信メールが「要」に設定されている買主の希望条件（エリア・予算・種別）が未入力の場合に警告を受け取りたい。そうすることで、配信に必要な情報の入力漏れを防げる。

#### 受け入れ基準

1. WHEN distribution_type が「要」に設定されている場合、THE BuyerDetailPage SHALL 希望条件ページの以下3項目を追加の必須項目として扱う：エリア（desired_area）、予算（budget）、希望種別（desired_property_type）
2. WHEN distribution_type が「要」であり、かつ desired_area・budget・desired_property_type のいずれかが未入力の場合、THE ValidationWarningDialog SHALL 該当する未入力項目名を警告ダイアログに含める
3. THE BuyerDetailPage SHALL 希望条件の必須項目チェックのために、ページ表示時に買主データから desired_area・budget・desired_property_type の値を取得する
4. IF distribution_type が「要」以外の場合、THEN THE System SHALL 希望条件の3項目を必須項目として扱わない

### 要件4：遷移対象の範囲

**ユーザーストーリー：** 担当者として、買主詳細画面内のナビゲーションボタンや戻るボタンを押した際にバリデーションが動作してほしい。そうすることで、どの遷移経路でも入力漏れを検知できる。

#### 受け入れ基準

1. THE BuyerDetailPage SHALL 以下の遷移操作に対してバリデーションを適用する：ページ内ナビゲーションボタン（問合履歴・希望条件・内覧等）、買主一覧への戻るボタン（ArrowBackIcon）、PageNavigation コンポーネントによる遷移
2. WHEN ユーザーが買主番号検索バーで別の買主番号を入力してEnterキーを押した場合、THE System SHALL バリデーションを適用する
3. THE BuyerDetailPage SHALL ブラウザの戻るボタンによる遷移にはバリデーションを適用しない（ブラウザ標準動作を妨げない）

### 要件5：警告ダイアログのUI仕様

**ユーザーストーリー：** 担当者として、警告ダイアログが分かりやすく表示されてほしい。そうすることで、何が未入力なのかを素早く把握できる。

#### 受け入れ基準

1. THE ValidationWarningDialog SHALL MUI の Dialog コンポーネントを使用して実装する
2. THE ValidationWarningDialog SHALL ダイアログタイトルに「必須項目が未入力です」と表示する
3. THE ValidationWarningDialog SHALL 未入力項目を箇条書きまたはリスト形式で表示する
4. THE ValidationWarningDialog SHALL 「画面に留まる」ボタンをデフォルトフォーカス（推奨アクション）として表示する
5. THE ValidationWarningDialog SHALL 「このまま移動する」ボタンを警告色（warning または secondary）で表示する
