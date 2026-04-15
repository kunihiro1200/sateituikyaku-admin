# 実装計画: 物件リスト詳細画面 Email送信ボタンへの送信元選択機能追加

## Overview

設計ドキュメントに基づき、バックエンドの `replyTo` パラメータ対応とフロントエンドの返信先選択UIを段階的に実装する。
参考実装（`PropertyReportPage`）と同じパターンを踏襲し、変更範囲を2ファイルに限定する。

## Tasks

- [x] 1. バックエンド: `send-template-email` エンドポイントに `replyTo` 対応を追加
  - [x] 1.1 `backend/src/routes/emails.ts` の `by-seller-number/:sellerNumber/send-template-email` エンドポイントに `replyTo` バリデーションを追加する
    - `body('replyTo').optional().isEmail()` バリデーションルールを追加
    - リクエストボディの分割代入に `replyTo` を追加
    - _Requirements: 3.2, 3.4_

  - [x] 1.2 添付ファイルありの場合に `replyTo` を `sendEmailWithCcAndAttachments` に渡す
    - 既存の `sendEmailWithCcAndAttachments` 呼び出しに `replyTo: replyTo || undefined` を追加
    - _Requirements: 3.2, 3.3_

  - [x] 1.3 添付ファイルなしの場合に `replyTo` が指定されていれば `sendEmailWithCcAndAttachments` を使用する分岐を追加する
    - `replyTo` が存在する場合は `sendEmailWithCcAndAttachments`（添付なし）を呼び出す
    - `replyTo` が存在しない場合は既存の `sendTemplateEmail` フローを維持する
    - _Requirements: 3.4, 3.5_

- [ ] 2. チェックポイント - バックエンド変更の確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 3. フロントエンド: `PropertyListingDetailPage.tsx` に jimuStaff 取得と状態管理を追加
  - [x] 3.1 `jimuStaff` と `replyTo` の状態変数を追加する
    - `useState<Array<{ initials: string; name: string; email?: string }>>([])` で `jimuStaff` を定義
    - `useState<string>('')` で `replyTo` を定義
    - _Requirements: 1.1, 4.1_

  - [x] 3.2 `fetchJimuStaff` 関数を実装し、コンポーネント初期化時に呼び出す
    - `GET /api/employees/jimu-staff` を呼び出して `jimuStaff` にセットする
    - `useEffect` で初期化時に呼び出す
    - エラー時はコンソールに記録し、`jimuStaff` を空配列のままにする
    - _Requirements: 4.1, 4.2_

  - [ ]* 3.3 Property 1 のプロパティテストを実装する（fast-check）
    - **Property 1: メールアドレスを持つスタッフのみが選択肢に表示される**
    - **Validates: Requirements 1.2, 4.3**

  - [ ]* 3.4 Property 2 のプロパティテストを実装する（fast-check）
    - **Property 2: sales_assignee に対応するスタッフのメールがデフォルト選択される**
    - **Validates: Requirements 1.3, 1.4**

- [x] 4. フロントエンド: ダイアログオープン・クローズ時の `replyTo` 制御を追加
  - [x] 4.1 `handleOpenEmailDialog` でダイアログを開く際に `replyTo` のデフォルト値を設定する
    - `jimuStaff.find((s) => s.initials === data?.sales_assignee)` でマッチするスタッフを検索
    - `setReplyTo(matchedStaff?.email || '')` でデフォルト設定
    - _Requirements: 1.3, 1.4_

  - [x] 4.2 `handleSelectPropertyEmailTemplate` でも同様に `replyTo` のデフォルト値を設定する
    - `handleOpenEmailDialog` と同じロジックを適用
    - _Requirements: 1.3, 1.4_

  - [x] 4.3 ダイアログクローズ時（キャンセル・送信完了）に `replyTo` をリセットする
    - `setReplyTo('')` をダイアログクローズ処理に追加
    - _Requirements: 1.7_

  - [ ]* 4.4 Property 3 のプロパティテストを実装する（fast-check）
    - **Property 3: ダイアログクローズ時に返信先がリセットされる**
    - **Validates: Requirements 1.7**

- [x] 5. フロントエンド: メール送信ペイロードに `replyTo` を追加
  - [x] 5.1 `handleSendEmail` 内の送信ペイロードに `replyTo` を条件付きで追加する
    - `...(replyTo ? { replyTo } : {})` をペイロードに追加
    - `replyTo` が空の場合はペイロードに含めない
    - _Requirements: 3.1, 1.6_

  - [ ]* 5.2 Property 5 のプロパティテストを実装する（fast-check）
    - **Property 5: replyTo が送信ペイロードに正しく含まれる**
    - **Validates: Requirements 3.1, 1.6**

- [x] 6. フロントエンド: 返信先選択UIをダイアログに追加
  - [x] 6.1 メール送信ダイアログ内に返信先（Reply-To）選択フィールドを追加する
    - `SenderAddressSelector` の直下に `FormControl` + `Select` コンポーネントを追加
    - ラベルは「返信先（Reply-To）」
    - 空値の `MenuItem` に「選択なし（送信元と同じ）」を表示
    - `jimuStaff.filter((s) => s.email)` でメールアドレスを持つスタッフのみ選択肢に表示
    - 各選択肢は `{s.name} <{s.email}>` 形式で表示
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3_

  - [ ]* 6.2 Property 4 のプロパティテストを実装する（fast-check）
    - **Property 4: 選択肢の表示形式に氏名とメールアドレスが含まれる**
    - **Validates: Requirements 2.2**

- [x] 7. 最終チェックポイント - 全テストの確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## Notes

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保
- プロパティテストには fast-check を使用（最低100回イテレーション）
- 変更対象ファイルは `backend/src/routes/emails.ts` と `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の2ファイルのみ
- `EmailService.sendEmailWithCcAndAttachments` は既に `replyTo` をサポートしているため変更不要
