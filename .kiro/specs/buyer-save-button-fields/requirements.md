# 要件ドキュメント

## はじめに

買主詳細画面（`BuyerDetailPage.tsx`）の「問合せ内容」セクションにある特定フィールドの保存タイミングを変更する機能です。現在これらのフィールドはボタンクリックやドロップダウン変更と同時に自動保存（DB保存 + スプレッドシート同期）されていますが、ユーザーが「保存ボタン」を押したときにまとめて保存・同期するよう変更します。

対象フィールドは以下の10個です：
- `inquiry_email_phone`（【問合メール】電話対応）
- `distribution_type`（配信メール）
- `pinrich`（Pinrich）
- `broker_survey`（業者向けアンケート）
- `three_calls_confirmed`（3回架電確認済み）
- `initial_assignee`（初動担当）
- `owned_home_hearing_inquiry`（問合時持家ヒアリング）
- `owned_home_hearing_result`（持家ヒアリング結果）
- `valuation_required`（要査定）
- `broker_inquiry`（業者問合せ）

## 用語集

- **BuyerDetailPage**: 買主詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **自動保存**: フィールド変更と同時にDBへの保存とスプレッドシート同期を実行する現在の動作
- **保存ボタン**: 「問合せ内容」セクション右上（初動担当ラベルの右横）に表示される `SectionSaveButton` コンポーネント
- **handleInlineFieldSave**: 単一フィールドをDBに保存しスプレッドシートに同期する既存関数
- **handleSectionSave**: セクション内の変更フィールドをまとめてDBに保存しスプレッドシートに同期する既存関数
- **handleFieldChange**: フィールドの変更をローカルstate（`sectionChangedFields`）に記録する既存関数
- **sectionDirtyStates**: セクションに未保存の変更があるかを管理するstate
- **sectionChangedFields**: セクションごとの変更フィールドと新しい値を管理するstate
- **楽観的更新**: APIレスポンスを待たずにUIを即座に更新する手法

## 要件

### 要件1：対象フィールドの保存タイミング変更

**ユーザーストーリー：** 担当者として、複数のフィールドをまとめて変更してから保存ボタンを押すことで、一度にDBとスプレッドシートに反映させたい。これにより、途中の変更状態が保存されることなく、意図した状態でまとめて保存できる。

#### 受け入れ基準

1. WHEN ユーザーが対象フィールドの値を変更したとき、THE System SHALL UIを即座に更新し（楽観的更新）、変更内容を `sectionChangedFields` に記録するが、DBへの保存とスプレッドシート同期は実行しない
2. WHEN ユーザーが対象フィールドの値を変更したとき、THE System SHALL `sectionDirtyStates` を `true` に更新し、保存ボタンをアクティブ状態で表示する
3. WHEN ユーザーが保存ボタンを押したとき、THE System SHALL `sectionChangedFields` に記録された全変更フィールドをまとめて `handleSectionSave` でDBに保存し、スプレッドシートに同期する
4. WHEN 保存が成功したとき、THE System SHALL `sectionDirtyStates` を `false` に更新し、保存ボタンを非アクティブ状態に戻す
5. IF 保存が失敗したとき、THEN THE System SHALL エラーメッセージをスナックバーで表示し、`sectionDirtyStates` は `true` のままにする

### 要件2：対象外フィールドの動作維持

**ユーザーストーリー：** 担当者として、保存タイミング変更の対象外フィールド（`inquiry_source`、`latest_status`、`reception_date`、`next_call_date`、`inquiry_hearing` 等）は引き続き従来通りの動作（自動保存または既存の保存ボタン）で動作してほしい。

#### 受け入れ基準

1. THE System SHALL 対象外フィールドの保存動作を変更しない
2. WHILE 対象フィールドに未保存の変更があるとき、THE System SHALL 対象外フィールドの変更は独立して保存できる

### 要件3：必須フィールドのバリデーション維持

**ユーザーストーリー：** 担当者として、保存タイミングが変わっても必須フィールドの未入力ハイライト（赤枠表示）は引き続き機能してほしい。

#### 受け入れ基準

1. WHEN ユーザーが対象フィールドの値を変更したとき、THE System SHALL `missingRequiredFields` の更新（必須チェック）を従来通り実行する
2. THE System SHALL `inquiry_email_phone`、`distribution_type`、`three_calls_confirmed`、`initial_assignee`、`owned_home_hearing_result` の必須ハイライト表示を保存タイミング変更後も維持する

### 要件4：保存ボタンの表示制御

**ユーザーストーリー：** 担当者として、未保存の変更がある場合にのみ保存ボタンがアクティブになることで、保存が必要かどうかを視覚的に確認できる。

#### 受け入れ基準

1. WHILE 対象フィールドに未保存の変更がないとき、THE System SHALL 保存ボタンを非アクティブ（グレーアウト）状態で表示する
2. WHEN 対象フィールドのいずれかが変更されたとき、THE System SHALL 保存ボタンをアクティブ状態に切り替える
3. WHEN 保存が完了したとき、THE System SHALL 保存ボタンを非アクティブ状態に戻す

### 要件5：スプレッドシート同期タイミング

**ユーザーストーリー：** 担当者として、保存ボタンを押したときにDBへの保存とスプレッドシートへの同期が同時に行われることで、データの一貫性を保ちたい。

#### 受け入れ基準

1. WHEN ユーザーが保存ボタンを押したとき、THE System SHALL DBへの保存と同時にスプレッドシートへの同期（`sync: true`）を実行する
2. IF スプレッドシート同期が失敗したとき、THEN THE System SHALL 「DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました」という警告メッセージを表示する
3. THE System SHALL 保存ボタン押下前はスプレッドシートへの同期を実行しない
