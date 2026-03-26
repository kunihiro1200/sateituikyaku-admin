# 実装計画：買主詳細画面バリデーション警告機能

## 概要

`ValidationWarningDialog` コンポーネントの新規作成と、`BuyerDetailPage` の遷移ロジックをダイアログ方式に切り替える実装を行う。

## タスク

- [x] 1. ValidationWarningDialog コンポーネントの新規作成
  - [x] 1.1 `frontend/frontend/src/components/ValidationWarningDialog.tsx` を新規作成する
    - MUI `Dialog` を使用してコンポーネントを実装する
    - `open`, `missingFieldLabels`, `onProceed`, `onStay` の4つのpropsを受け取る
    - タイトルに「必須項目が未入力です」を表示する
    - `missingFieldLabels` を `<ul>` リスト形式で表示する
    - 「画面に留まる」ボタンに `variant="contained"` + `autoFocus` を設定する
    - 「このまま移動する」ボタンに `color="warning"` + `variant="outlined"` を設定する
    - _Requirements: 1.2, 1.3, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 1.2 ValidationWarningDialog のプロパティテストを作成する
    - **Property 2: 未入力項目名の完全表示**
    - **Validates: Requirements 1.2, 5.2, 5.3**
    - `missingFieldLabels` に渡した全ての項目名がレンダリング結果に含まれることを検証する

  - [ ]* 1.3 ValidationWarningDialog のユニットテストを作成する
    - 2つのボタンが存在することを確認する
    - 「画面に留まる」ボタンに `autoFocus` が設定されていることを確認する
    - 「このまま移動する」クリック時に `onProceed` が呼ばれることを確認する
    - 「画面に留まる」クリック時に `onStay` が呼ばれることを確認する
    - _Requirements: 1.3, 1.4, 1.5, 5.4_

- [x] 2. BuyerDetailPage の checkMissingFields() 関数実装
  - [x] 2.1 `BuyerDetailPage.tsx` に `checkMissingFields()` 関数を実装する
    - 既存の `validateRequiredFields()` を置き換える（削除または無効化）
    - 常時必須4項目（`initial_assignee`, `inquiry_source`, `latest_status`, `distribution_type`）をチェックする
    - `inquiry_source` に「メール」を含む場合、`inquiry_email_phone` を必須に追加する
    - `inquiry_source` に「メール」を含み `inquiry_email_phone` に値がある場合、`three_calls_confirmed` を必須に追加する
    - `distribution_type` が「要」の場合、`desired_area`, `budget`, `desired_property_type` を必須に追加する
    - `buyer` が `null` の場合は空リストを返す
    - 未入力項目の表示名リスト（`string[]`）を返す
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.2 checkMissingFields() のプロパティテストを作成する
    - **Property 1: 必須項目未入力時のダイアログ表示**
    - **Validates: Requirements 1.1, 1.6, 2.1**
    - 必須4項目のいずれかが空の場合に空でないリストを返すことを検証する

  - [ ]* 2.3 checkMissingFields() のプロパティテストを作成する（メール条件）
    - **Property 3: メール問合せ条件付き必須チェック**
    - **Validates: Requirements 2.2, 2.3**
    - `inquiry_source` に「メール」を含む/含まない場合の条件付きチェックを検証する

  - [ ]* 2.4 checkMissingFields() のプロパティテストを作成する（配信メール条件）
    - **Property 4: 配信メール「要」条件付き必須チェック**
    - **Validates: Requirements 3.1, 3.2, 3.4**
    - `distribution_type` が「要」/「要」以外の場合の条件付きチェックを検証する

- [ ] 3. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 4. BuyerDetailPage の handleNavigate() 共通ハンドラー実装
  - [x] 4.1 `BuyerDetailPage.tsx` に `validationDialogOpen` と `pendingNavigationUrl` の state を追加する
    - `const [validationDialogOpen, setValidationDialogOpen] = useState(false);`
    - `const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string>('');`
    - _Requirements: 1.1_

  - [x] 4.2 `handleNavigate(url: string)` 関数を実装する
    - `checkMissingFields()` を呼び出して未入力項目リストを取得する
    - 未入力あり → `setPendingNavigationUrl(url)` + `setValidationDialogOpen(true)`
    - 未入力なし → `navigate(url)` を直接実行する
    - _Requirements: 1.1, 1.6_

  - [x] 4.3 `ValidationWarningDialog` を JSX に追加する
    - `open={validationDialogOpen}` を渡す
    - `missingFieldLabels` に `checkMissingFields()` の結果を渡す
    - `onProceed` で `navigate(pendingNavigationUrl)` を実行し、ダイアログを閉じる
    - `onStay` でダイアログを閉じる（`setValidationDialogOpen(false)`）
    - _Requirements: 1.4, 1.5_

  - [ ]* 4.4 handleNavigate() のプロパティテストを作成する
    - **Property 5: 「このまま移動する」選択時の遷移実行**
    - **Validates: Requirements 1.4**
    - 「このまま移動する」選択時に `navigate` が当該URLで呼ばれることを検証する

- [x] 5. 全遷移操作を handleNavigate() に切り替え
  - [x] 5.1 問合履歴・希望条件・内覧ボタンのクリックハンドラーを `handleNavigate()` に切り替える
    - 既存の `validateRequiredFields()` チェック + `navigate()` の組み合わせを `handleNavigate()` に置き換える
    - _Requirements: 4.1_

  - [x] 5.2 戻るボタン（ArrowBackIcon）のクリックハンドラーを `handleNavigate()` に切り替える
    - 買主一覧への遷移に `handleNavigate()` を適用する
    - _Requirements: 4.1_

  - [x] 5.3 買主番号検索バー（Enter キー）のハンドラーを `handleNavigate()` に切り替える
    - 別の買主番号を入力してEnterを押した際に `handleNavigate()` を適用する
    - _Requirements: 4.2_

- [x] 6. PageNavigation コンポーネントへの対応
  - [x] 6.1 `PageNavigation` コンポーネントに `onNavigate` コールバックpropsを追加する
    - `onNavigate?: (url: string) => void` を props に追加する
    - `onNavigate` が渡された場合は `navigate()` の代わりに `onNavigate(url)` を呼び出す
    - `onNavigate` が渡されない場合は従来通り `navigate()` を使用する（後方互換性を維持）
    - _Requirements: 4.1_

  - [x] 6.2 `BuyerDetailPage` で `PageNavigation` に `onNavigate={handleNavigate}` を渡す
    - _Requirements: 4.1_

- [x] 7. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## Notes

- タスクに `*` が付いているものはオプションであり、MVP実装ではスキップ可能
- 各タスクは要件との対応が明記されており、トレーサビリティを確保している
- プロパティテストには fast-check ライブラリを使用する
- `validateRequiredFields()` の既存ハイライト表示ロジック（要件2.4）は維持すること
- ブラウザの戻るボタンによる遷移にはバリデーションを適用しない（要件4.3）
