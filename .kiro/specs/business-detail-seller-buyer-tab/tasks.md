# 実装計画: 業務詳細画面「売主、買主詳細」タブ機能

## 概要

業務詳細画面（`WorkTaskDetailModal`）の「司法書士、相手側不動産情報」タブを「売主、買主詳細」タブに改名し、売主・買主の連絡先情報、ローン情報、引き渡し予定日などの新規フィールドを追加する。

実装順序: DBマイグレーション → バックエンド（マッピング追加）→ フロントエンド（タブ名変更・フィールド追加）

---

## タスク

- [x] 1. DBマイグレーション: work_tasksテーブルへのカラム追加
  - `backend/` ディレクトリに `add-seller-buyer-fields-to-work-tasks.sql` を作成する
  - 以下のカラムを `work_tasks` テーブルに追加するSQLを記述する:
    - `seller_contact_name TEXT`
    - `seller_contact_email TEXT`
    - `seller_contact_tel TEXT`
    - `buyer_contact_name TEXT`
    - `buyer_contact_email TEXT`
    - `buyer_contact_tel TEXT`
    - `loan TEXT`
    - `financial_institution TEXT`
    - `delivery_scheduled_date DATE`
  - `ADD COLUMN IF NOT EXISTS` を使用してべき等性を確保する
  - _Requirements: 2.5, 3.5, 4.4, 5.3_

- [x] 2. バックエンド: work-task-column-mapping.jsonへのマッピング追加
  - [x] 2.1 `backend/src/` 配下の `work-task-column-mapping.json` を特定し、`spreadsheetToDatabase2`（または該当セクション）に新規フィールドのマッピングを追加する
    - `"売主名前": "seller_contact_name"`
    - `"売主メアド": "seller_contact_email"`
    - `"売主TEL": "seller_contact_tel"`
    - `"買主名前": "buyer_contact_name"`
    - `"買主メアド": "buyer_contact_email"`
    - `"買主TEL": "buyer_contact_tel"`
    - `"ローン": "loan"`
    - `"金融機関名": "financial_institution"`
    - `"引き渡し予定": "delivery_scheduled_date"`
    - _Requirements: 9.1, 9.4_

  - [x] 2.2 `typeConversions` セクションに `"delivery_scheduled_date": "date"` を追加する
    - _Requirements: 9.5_

  - [ ]* 2.3 マッピングの一意性プロパティテストを作成する
    - **Property 3: スプシカラム名→DBカラム名マッピングの一意性**
    - **Validates: Requirements 9.4**

- [ ] 3. チェックポイント - DBマイグレーションとマッピング確認
  - Supabaseダッシュボードで `work_tasks` テーブルに新規カラムが追加されていることを確認する
  - `work-task-column-mapping.json` の新規マッピングが正しく記述されていることを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する

- [x] 4. フロントエンド: WorkTaskDetailModal.tsxのタブ名変更
  - `frontend/frontend/src/components/WorkTaskDetailModal.tsx` を開く
  - `tabLabels` 配列の4番目の要素を `'司法書士、相手側不動産情報'` から `'売主、買主詳細'` に変更する
  - 既存タブ（`'媒介契約'`、`'サイト登録'`、`'契約決済'`）の名称・順序は変更しない
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. フロントエンド: SellerBuyerDetailSectionコンポーネントの実装
  - [x] 5.1 `WorkTaskDetailModal.tsx` 内の既存 `JudicialScrivenerSection` コンポーネントを `SellerBuyerDetailSection` にリネームする
    - `semanticRename` ツールを使用してリネームする
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 5.2 `SellerBuyerDetailSection` に売主情報セクションを追加する
    - `<SectionHeader label="【売主情報】" />` を追加する
    - `<EditableField label="売主名前" field="seller_contact_name" />` を追加する
    - `<EditableField label="売主メアド" field="seller_contact_email" />` を追加する
    - `<EditableField label="売主TEL" field="seller_contact_tel" />` を追加する
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 5.3 `SellerBuyerDetailSection` に買主情報セクションを追加する
    - `<SectionHeader label="【買主情報】" />` を追加する
    - `<EditableField label="買主名前" field="buyer_contact_name" />` を追加する
    - `<EditableField label="買主メアド" field="buyer_contact_email" />` を追加する
    - `<EditableField label="買主TEL" field="buyer_contact_tel" />` を追加する
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.4 `SellerBuyerDetailSection` にローン・金融機関セクションを追加する
    - `<SectionHeader label="【ローン情報】" />` を追加する
    - `<EditableButtonSelect label="ローン" field="loan" options={['あり', 'なし']} />` を追加する
    - `<EditableField label="金融機関名" field="financial_institution" />` を追加する
    - _Requirements: 4.1, 4.2_

  - [x] 5.5 `SellerBuyerDetailSection` に日程セクションを追加する
    - `<SectionHeader label="【日程】" />` を追加する
    - `<EditableDateField label="引き渡し予定" field="delivery_scheduled_date" />` を追加する（または `type="date"` 対応の `EditableField`）
    - `<EditableDateField label="融資承認予定日" field="loan_approval_scheduled_date" />` を追加する（既存カラム）
    - _Requirements: 5.1, 6.1, 6.3_

  - [x] 5.6 既存の司法書士・仲介業者情報セクションを `SellerBuyerDetailSection` 内に維持する
    - `<SectionHeader label="【司法書士・仲介業者情報】" />` を追加する
    - 既存の `judicial_scrivener`、`judicial_scrivener_contact`、`broker`、`broker_contact` フィールドを維持する
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.7 `SellerBuyerDetailSection` のレンダリングユニットテストを作成する
    - 全新規フィールドが表示されることを確認
    - 既存フィールド（司法書士・仲介業者情報）が引き続き表示されることを確認
    - ローンフィールドが「あり」「なし」のボタン選択として表示されることを確認
    - _Requirements: 2.1-2.3, 3.1-3.3, 4.1-4.2, 5.1, 6.1, 7.1-7.4_

- [ ] 6. チェックポイント - フロントエンド動作確認
  - タブ名が「売主、買主詳細」に変更されていることを確認する
  - 全新規フィールドが正しく表示・編集・保存できることを確認する
  - 既存フィールド（司法書士・仲介業者情報）が引き続き動作することを確認する
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する

- [ ] 7. バックエンドAPIの動作確認とプロパティテスト
  - [ ] 7.1 `PUT /api/work-tasks/:propertyNumber` に新規フィールドを含むリクエストを送信し、DBに正しく保存されることを確認するインテグレーションテストを作成する
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 7.2 新規テキストフィールドの保存ラウンドトリッププロパティテストを作成する
    - **Property 1: 新規フィールドの保存ラウンドトリップ**
    - `seller_contact_name`、`seller_contact_email`、`seller_contact_tel`、`buyer_contact_name`、`buyer_contact_email`、`buyer_contact_tel`、`financial_institution` の任意の文字列値を保存・取得して同一値が返ることを確認する
    - **Validates: Requirements 2.4, 3.4, 4.3**

  - [ ]* 7.3 日付フィールドの保存ラウンドトリッププロパティテストを作成する
    - **Property 2: 日付フィールドの保存ラウンドトリップ**
    - `delivery_scheduled_date` に任意の有効な日付（YYYY-MM-DD形式）を保存・取得して同一値が返ることを確認する
    - **Validates: Requirements 5.2, 6.2**

- [ ] 8. 最終チェックポイント - 全テスト通過確認
  - 全ユニットテスト・プロパティテスト・インテグレーションテストが通ることを確認する
  - スプレッドシート同期（`WorkTaskSyncService`）が新規フィールドを正しく処理することを確認する
  - 疑問点があればユーザーに確認する

---

## 注意事項

- `*` が付いたタスクはオプションであり、MVP実装ではスキップ可能
- 各タスクは対応する要件番号を参照している
- DBマイグレーション（タスク1）は必ずフロントエンド・バックエンド実装より先に実施すること
- `loan_approval_scheduled_date` は既存カラムのため、DBマイグレーション不要（フロントエンド表示追加のみ）
- `WorkTaskService` および `WorkTaskSyncService` はコード変更不要（マッピングJSON追加のみで対応）
- プロパティテストには **fast-check** ライブラリを使用する
