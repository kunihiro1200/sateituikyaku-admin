# 実装計画: call-mode-assignee-section

## 概要

通話モードページ（CallModePage）の「追客の活動ログ」セクション直上に「担当者設定」セクションを追加する。
DBマイグレーション → バックエンド型定義 → カラムマッピング → フロントエンド型定義 → UIコンポーネント → CallModePageへの組み込みの順で実装する。

## タスク

- [x] 1. DBマイグレーションの作成
  - `backend/migrations/101_add_assignee_fields_to_sellers.sql` を作成する
  - `sellers` テーブルに7つのカラムを `ADD COLUMN IF NOT EXISTS` で追加する
  - 追加カラム: `unreachable_sms_assignee`, `valuation_sms_assignee`, `valuation_reason_email_assignee`, `valuation_reason`, `cancel_notice_assignee`, `long_term_email_assignee`, `call_reminder_email_assignee`（全てTEXT型）
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. バックエンド型定義とSellerServiceの更新
  - [x] 2.1 `backend/src/types/index.ts` の `Seller` インターフェースに7つのオプショナルフィールドを追加する
    - `unreachableSmsAssignee?: string`, `valuationSmsAssignee?: string`, `valuationReasonEmailAssignee?: string`, `valuationReason?: string`, `cancelNoticeAssignee?: string`, `longTermEmailAssignee?: string`, `callReminderEmailAssignee?: string`
    - _Requirements: 2.1_

  - [x] 2.2 `backend/src/services/SellerService.supabase.ts` の `decryptSeller` メソッドに7フィールドのマッピングを追加する
    - DBカラム名（snake_case）→ TypeScriptフィールド名（camelCase）のマッピングを追加
    - _Requirements: 2.2_

  - [ ]* 2.3 Property 4 のプロパティテストを作成する
    - **Property 4: decryptSellerの新フィールドマッピング**
    - **Validates: Requirements 2.2**
    - `fast-check` を使用して `fc.record()` で7フィールドのランダム値を生成し、`decryptSeller` の出力が対応するDBカラムの値と一致することを検証する

- [x] 3. スプレッドシートカラムマッピングの更新
  - `backend/src/config/column-mapping.json` の `spreadsheetToDatabase` セクションに7つのマッピングを追加する
  - `backend/src/config/column-mapping.json` の `databaseToSpreadsheet` セクションに逆方向の7つのマッピングを追加する
  - スプシカラム名: `不通時Sメール担当`(CS), `査定Sメール担当`(CT), `査定理由別３後Eメ担`(DL), `査定理由`(AO), `キャンセル案内担当`(AF), `除外前、長期客メール担当`(CX), `当社が電話したというリマインドメール担当`(CO)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 4. チェックポイント — バックエンドの動作確認
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

- [x] 5. フロントエンド型定義の更新
  - `frontend/frontend/src/types/index.ts` の `Seller` インターフェースに7つのオプショナルフィールドを追加する
  - バックエンドと同じフィールド名（camelCase）を使用する
  - _Requirements: 4.1_

- [x] 6. AssigneeSectionコンポーネントの実装
  - [x] 6.1 `frontend/frontend/src/components/AssigneeSection.tsx` を新規作成する
    - `AssigneeSectionProps`（`seller: Seller`, `onUpdate: (fields: Partial<Seller>) => void`）を定義する
    - `/api/employees/active-initials` からイニシャル一覧を取得する `useEffect` を実装する
    - `ASSIGNEE_FIELDS` 定数（7フィールドの設定配列）を定義する
    - 各フィールドに対してイニシャルボタン（`fieldType: 'assignee'`）またはテキスト入力（`fieldType: 'text'`）を表示する
    - 「不要」ボタンを各担当者フィールドに常に表示する
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.8_

  - [x] 6.2 イニシャルボタンの選択状態とスタイルを実装する
    - 選択中のボタンは `variant="contained"` + `color="error"` でハイライト表示する
    - 未選択のボタンは `variant="outlined"` で表示する
    - _Requirements: 5.6, 5.7, 7.2, 7.3_

  - [ ]* 6.3 Property 3 のプロパティテストを作成する
    - **Property 3: イニシャルボタンのハイライト整合性**
    - **Validates: Requirements 5.6, 5.7, 7.2, 7.3**
    - `fast-check` を使用して任意のフィールドキー・現在値・イニシャル一覧の組み合わせで、選択状態のボタンが `currentValue` と一致するものだけであることを検証する

  - [x] 6.4 担当者選択時の即時保存ロジックを実装する
    - ボタンクリック時に `PUT /api/sellers/:id` を呼び出す
    - 同じボタンを再クリックした場合は `null` を保存する（選択解除）
    - 「不要」ボタンクリック時は `"不要"` を保存する
    - 保存成功後に `onUpdate` を呼び出してローカル状態を更新する
    - 保存失敗時は MUI `Snackbar` でエラーメッセージを表示し、UIの選択状態を元に戻す
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.5 Property 1 のプロパティテストを作成する
    - **Property 1: 担当者フィールドの保存ラウンドトリップ**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 7.1, 7.2**
    - `fast-check` を使用して任意のフィールドキーと値（イニシャル・`"不要"`・`null`）の組み合わせで、`PUT` 後に `GET` した値が一致することを検証する

  - [x] 6.6 査定理由テキストフィールドの1秒デバウンス保存を実装する
    - `valuationReason` フィールドをテキスト入力として表示する
    - テキスト変更後1秒のデバウンスで `PUT /api/sellers/:id` を呼び出す
    - _Requirements: 5.8, 6.6_

  - [ ]* 6.7 Property 2 のプロパティテストを作成する
    - **Property 2: 査定理由テキストのラウンドトリップ**
    - **Validates: Requirements 6.6, 7.1**
    - `fast-check` を使用して任意の文字列（空文字・日本語・特殊文字を含む）を `valuation_reason` に保存し、再取得した値が一致することを検証する

  - [x] 6.8 ページ読み込み時の初期値表示を実装する
    - `seller` props から各フィールドの初期値を読み込み、対応するボタンをハイライト表示する
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. CallModePageへのAssigneeSectionの組み込み
  - `frontend/frontend/src/pages/CallModePage.tsx` を編集する
  - `FollowUpLogHistoryTable` の直上に `AssigneeSection` を追加する
  - `seller` と `onUpdate` props を正しく渡す（`setSeller` を使用してローカル状態を更新）
  - _Requirements: 5.1_

- [x] 8. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 日本語を含むファイルの編集は Pythonスクリプトを使用してUTF-8で書き込む
- 編集対象は `backend/src/` と `frontend/frontend/src/` のみ（`backend/api/` は触らない）
- `SellerService.supabase.ts` は `backend/src/services/` のものを編集する（`backend/api/` のものは触らない）
- 各タスクは前のタスクの成果物を前提として実装する
