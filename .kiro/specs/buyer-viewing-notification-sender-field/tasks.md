# 実装計画：内覧後売主連絡フィールド（buyer-viewing-notification-sender-field）

## 概要

`post_viewing_seller_contact` カラムをDBに追加し、`BuyerViewingResultPage` と `BuyerDetailPage` にボタン選択UIを追加する。あわせて `BuyerStatusCalculator` の「一般媒介_内覧後売主連絡未」判定ロジックを設計書の仕様（条件A OR 条件B）に更新する。

## タスク

- [ ] 1. DBマイグレーション
  - `backend/supabase/migrations/` に新しいSQLファイルを作成する
  - 内容: `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS post_viewing_seller_contact TEXT;`
  - Supabaseダッシュボードで実行する
  - _Requirements: 4.3_

- [ ] 2. buyer-column-mapping.json の確認
  - [ ] 2.1 `spreadsheetToDatabase` セクションに `"内覧後売主連絡": "post_viewing_seller_contact"` が存在することを確認する
    - 既に存在する場合は追加不要（設計書に確認済みと記載）
    - `spreadsheetToDatabaseExtended` への追加も不要（重複を避けるため）
    - _Requirements: 4.1_

- [ ] 3. BuyerStatusCalculator.ts の更新
  - [ ] 3.1 Priority 8 の「一般媒介_内覧後売主連絡未」判定ロジックを設計書の仕様に更新する
    - 現在の実装（`contains(viewing_type_general, '一般')` + `isBlank(post_viewing_seller_contact)` + `isAfterOrEqual('2026-03-01')` + `contains(atbb_status, '公開中')`）を削除する
    - 条件A: `isNotBlank(viewing_type_general)` AND `isNotBlank(latest_viewing_date)` AND `isPast(latest_viewing_date)` AND `isAfterOrEqual(latest_viewing_date, '2025-08-01')` AND `isBlank(viewing_result_follow_up)`
    - 条件B: `equals(post_viewing_seller_contact, '未')`
    - 最終判定: `or(条件A, 条件B)`
    - _Requirements: 3.1, 3.2_

  - [ ]* 3.2 BuyerStatusCalculator のユニットテストを作成する
    - 条件Aのみ満たす場合 → ステータスが「一般媒介_内覧後売主連絡未」
    - 条件Bのみ満たす場合 → ステータスが「一般媒介_内覧後売主連絡未」
    - 両条件を満たさない場合 → ステータスが「一般媒介_内覧後売主連絡未」でない
    - `latest_viewing_date` が `"2025-07-31"` の場合（境界値）→ 条件Aを満たさない
    - `latest_viewing_date` が `"2025-08-01"` の場合（境界値）→ 条件Aを満たす
    - _Requirements: 3.2, 3.3, 3.5_

  - [ ]* 3.3 Property 5 のプロパティテストを作成する（fast-check）
    - **Property 5: サイドバーカテゴリー件数の正確性**
    - **Validates: Requirements 3.2, 3.3, 3.5**
    - _Requirements: 3.2, 3.3, 3.5_

- [ ] 4. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [ ] 5. BuyerViewingResultPage.tsx の更新
  - [ ] 5.1 `post_viewing_seller_contact` ボタン選択フィールドを追加する
    - `file-encoding-protection.md` に従い、Pythonスクリプトで編集する
    - 表示条件: `viewing_mobile` または `viewing_type_general` に「一般」が含まれる場合のみ表示
    - `button-select-layout-rule.md` 準拠のレイアウト（ラベル横並び・`flex: 1` 均等幅）
    - 選択肢: `['済', '未', '不要']`
    - 既選択ボタン再クリックで空欄に戻す（トグル動作）
    - 選択時に `handleInlineFieldSave('post_viewing_seller_contact', value)` を呼び出す
    - `SYNC_FIELDS` 配列に `'post_viewing_seller_contact'` を追加する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ] 5.2 必須バリデーションを実装する
    - `isPostViewingSellerContactRequired(buyer)` ヘルパー関数を実装する
    - 条件: `mediation_type === "一般・公開中"` AND `latest_viewing_date >= "2025-07-05"` AND `latest_viewing_date <= today` AND `viewing_result_follow_up` が非空
    - 必須の場合はラベルに `*` を付与する
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.3 Property 1 のプロパティテストを作成する（fast-check）
    - **Property 1: 表示条件の正確性**
    - **Validates: Requirements 1.1, 1.2, 5.2**
    - _Requirements: 1.1, 1.2_

  - [ ]* 5.4 Property 3 のプロパティテストを作成する（fast-check）
    - **Property 3: ボタン選択トグル**
    - **Validates: Requirements 1.4, 1.5**
    - _Requirements: 1.4, 1.5_

  - [ ]* 5.5 Property 4 のプロパティテストを作成する（fast-check）
    - **Property 4: 必須判定ロジックの正確性**
    - **Validates: Requirements 2.1, 2.4**
    - _Requirements: 2.1, 2.4_

- [ ] 6. BuyerDetailPage.tsx の更新
  - [ ] 6.1 `BUYER_FIELD_SECTIONS` の「問合せ内容」セクションに `post_viewing_seller_contact` を追加する
    - `file-encoding-protection.md` に従い、Pythonスクリプトで編集する
    - `viewing_mobile` フィールドの直後に追加する
    - 定義: `{ key: 'post_viewing_seller_contact', label: '内覧後売主連絡', inlineEditable: true, fieldType: 'buttonSelect' }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.2 Property 2 のプロパティテストを作成する（fast-check）
    - **Property 2: 保存ラウンドトリップ**
    - **Validates: Requirements 1.6, 1.7, 4.5, 5.3, 5.4**
    - _Requirements: 1.6, 1.7, 5.3, 5.4_

- [ ] 7. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [ ] 8. GAS更新の案内
  - GASの `BUYER_COLUMN_MAPPING` に以下を追加する手順をユーザーに案内する
  - 追加内容: `'内覧後売主連絡': 'post_viewing_seller_contact'`
  - `buyer-column-sync-rule.md` に従い、スプシ→DB定期同期でこのカラムが反映されるようにする
  - _Requirements: 4.2_

- [ ] 9. デプロイ
  - `deploy-procedure.md` に従い `git push origin main` でデプロイする
  - フロントエンド・バックエンド両方が自動デプロイされることを確認する

## 注意事項

- `*` 付きのサブタスクはオプション（スキップ可能）
- 日本語を含むファイル（`.tsx`）の編集は必ず Pythonスクリプト経由で行う（`file-encoding-protection.md` 参照）
- `buyer-column-mapping.json` の `spreadsheetToDatabase` に `"内覧後売主連絡"` が既に存在するため、`spreadsheetToDatabaseExtended` への追加は不要
- `BuyerStatusCalculator.ts` の Priority 8 は既に実装済みだが、設計書の仕様（条件A OR 条件B）と異なるため更新が必要
