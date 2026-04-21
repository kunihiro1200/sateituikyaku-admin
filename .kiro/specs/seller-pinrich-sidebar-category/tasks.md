# 実装計画: seller-pinrich-sidebar-category

## 概要

売主リストの通話モードページにおいて、Pinrichフィールドの状態に基づく2つのサイドバーカテゴリー（「Pinrich要変更」「Pinrich空欄」）を正確に実装する。
過去の失敗（カテゴリーから消えずにクリックするとデータなし）を防ぐため、カテゴリー表示とフィルタリング結果の常時一致を最重要原則とする。

## タスク

- [ ] 1. フロントエンド: sellerStatusFilters.ts の修正
  - [ ] 1.1 `isPinrichNeedsChange(seller)` 関数を実装する
    - `pinrichStatus === '配信中'` かつ `visitAssignee` に有効な値（空・null・'外す' 以外）かつ `inquiryDate >= '2026-01-01'` の場合に `true` を返す
    - `normalizeDateString` を使って日付を正規化してから比較する
    - `seller.pinrichStatus || seller.pinrich_status` のように複数フィールド名に対応する
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1_
  - [ ]* 1.2 `isPinrichNeedsChange` の単体テストを書く
    - pinrichStatus='配信中', visitAssignee='Y', inquiryDate='2026-01-15' → true
    - pinrichStatus='クローズ', visitAssignee='Y', inquiryDate='2026-01-15' → false
    - pinrichStatus='配信中', visitAssignee='', inquiryDate='2026-01-15' → false
    - pinrichStatus='配信中', visitAssignee='Y', inquiryDate='2025-12-31' → false
    - pinrichStatus='配信中', visitAssignee='外す', inquiryDate='2026-01-15' → false
    - _Requirements: 4.4, 4.5_
  - [ ]* 1.3 Property 1: `isPinrichNeedsChange` の正確な判定プロパティテストを書く（fast-check）
    - **Property 1: isPinrichNeedsChange の正確な判定**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5**
  - [ ] 1.4 `isPinrichEmpty(seller)` 関数に `inquiryDate >= '2026-01-01'` 条件を追加する
    - 既存の `isTodayCall(seller)` チェックと `pinrichStatus` 空欄チェックに加えて日付条件を追加
    - _Requirements: 3.1, 3.4_
  - [ ]* 1.5 `isPinrichEmpty` の単体テストを書く
    - isTodayCall=true, pinrichStatus='', inquiryDate='2026-01-15' → true
    - isTodayCall=true, pinrichStatus='配信中', inquiryDate='2026-01-15' → false
    - isTodayCall=true, pinrichStatus='', inquiryDate='2025-12-31' → false
    - _Requirements: 3.2, 3.4_
  - [ ]* 1.6 Property 2: `isPinrichEmpty` の正確な判定プロパティテストを書く（fast-check）
    - **Property 2: isPinrichEmpty の正確な判定**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [ ] 2. フロントエンド: SellerStatusSidebar.tsx の修正
  - [ ] 2.1 `filterSellersByCategory` の `pinrichChangeRequired` ケースを `isPinrichNeedsChange` に変更する
    - `isPinrichChangeRequired` → `isPinrichNeedsChange` に差し替え
    - `isPinrichNeedsChange` を `sellerStatusFilters.ts` からインポートする
    - _Requirements: 4.2, 7.5_
  - [ ] 2.2 「Pinrich要変更」カテゴリーのUI定義（`StatusCategory` / `CategoryCounts` の `pinrichChangeRequired`）が存在することを確認し、なければ追加する
    - `StatusCategory` 型に `'pinrichChangeRequired'` が含まれているか確認
    - `CategoryCounts` インターフェースに `pinrichChangeRequired: number` が含まれているか確認
    - _Requirements: 1.6, 4.2_
  - [ ]* 2.3 Property 4: カテゴリー表示とフィルタリング結果の常時一致プロパティテストを書く（fast-check）
    - **Property 4: カテゴリー表示とフィルタリング結果の常時一致（不変条件）**
    - **Validates: Requirements 1.6, 1.7, 7.3, 7.5**
  - [ ]* 2.4 Property 5: Pinrich空欄カテゴリーの双方向一致プロパティテストを書く（fast-check）
    - **Property 5: Pinrich空欄カテゴリーの双方向一致（不変条件）**
    - **Validates: Requirements 3.3, 3.5, 7.4, 7.5**

- [ ] 3. チェックポイント - フロントエンドのフィルタリングロジック確認
  - すべてのテストが通ることを確認する。疑問点があればユーザーに確認する。

- [ ] 4. バックエンド: SellerService.supabase.ts の修正（backend/src/ のみ）
  - [ ] 4.1 `getSidebarCounts` / `getSidebarCountsFallback` の `pinrichNeedsChange` カウントロジックを新条件に修正する
    - 条件: `pinrich_status = '配信中'` かつ `visit_assignee` に値あり（null・空・'外す' 以外）かつ `inquiry_date >= '2026-01-01'`
    - Supabaseクエリ: `.eq('pinrich_status', '配信中').not('visit_assignee', 'is', null).neq('visit_assignee', '').neq('visit_assignee', '外す').gte('inquiry_date', '2026-01-01')`
    - _Requirements: 5.1, 5.2_
  - [ ] 4.2 `getSidebarCountsFallback` の `pinrichEmpty` カウントに `inquiry_date >= '2026-01-01'` 条件を追加する
    - `filteredTodayCallSellers` のフィルター処理に `inquiryDate >= '2026-01-01'` チェックを追加
    - _Requirements: 5.3_
  - [ ]* 4.3 `getSidebarCounts` のレスポンスに `pinrichNeedsChange` と `pinrichEmpty` が含まれることを確認する単体テストを書く
    - _Requirements: 5.1, 5.3_
  - [ ]* 4.4 Property 3: バックエンドとフロントエンドのカウント一致プロパティテストを書く（fast-check）
    - **Property 3: バックエンドとフロントエンドのカウント一致（モデルベーステスト）**
    - バックエンドのロジックをモック化してフロントエンドの `isPinrichNeedsChange()` フィルターと比較
    - **Validates: Requirements 5.2, 5.4**

- [ ] 5. スプレッドシート同期: column-mapping.json の確認
  - [ ] 5.1 `column-mapping.json` に `"Pinrich" → "pinrich_status"`（spreadsheetToDatabase）マッピングが存在することを確認する
    - 存在しない場合のみ追加する
    - _Requirements: 6.3_
  - [ ] 5.2 `column-mapping.json` に `"pinrich_status" → "Pinrich"`（databaseToSpreadsheet）マッピングが存在することを確認する
    - 存在しない場合のみ追加する
    - _Requirements: 6.4_

- [ ] 6. チェックポイント - すべてのテストが通ることを確認する
  - すべてのテストが通ることを確認する。疑問点があればユーザーに確認する。

## 注意事項

- タスク `*` 付きはオプションであり、MVP優先の場合はスキップ可能
- 日本語を含むファイルの編集は必ずPythonスクリプトを使用してUTF-8で書き込む
- `backend/src/` のみ編集対象（`backend/api/` は触らない）
- カテゴリー表示とフィルタリング結果が常に一致することを最優先で確認する
- プロパティテストには fast-check を使用し、最低100回のランダム入力で実行する
