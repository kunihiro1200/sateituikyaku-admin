# 実装計画: 売主サイドバー「他社買取」除外機能

## 概要

売主リスト一覧のサイドバーにおいて、営業担当別カテゴリ（担当(I)、担当(K)、担当(M)等）から「状況（当社）」が「他社買取」を含む売主を除外する機能を実装します。既存の除外ルール（一般媒介、専任媒介、追客不要）に「他社買取」を追加します。

## タスク

- [ ] 1. フロントエンドのフィルタリング関数を更新
  - [x] 1.1 `isVisitAssignedTo()` 関数に「他社買取」除外ロジックを追加
    - `frontend/frontend/src/utils/sellerStatusFilters.ts` の `isVisitAssignedTo()` 関数を修正
    - statusフィールドに「他社買取」を含む売主を除外する条件を追加
    - エラーハンドリングを実装（statusがnull/undefinedの場合は空文字として扱う）
    - _Requirements: 1.1, 1.3, 3.1, 3.3_
  
  - [ ]* 1.2 Property 1のプロパティテストを作成
    - **Property 1: 他社買取除外フィルタ**
    - **Validates: Requirements 1.1, 1.3, 2.2, 3.1, 3.3**
    - fast-checkを使用して、任意の売主と担当者に対してstatusに「他社買取」を含む場合はfalseを返すことを検証
    - 最低100回の反復実行を設定
  
  - [x] 1.3 `getUniqueAssignees()` 関数に「他社買取」除外ロジックを追加
    - `frontend/frontend/src/utils/sellerStatusFilters.ts` の `getUniqueAssignees()` 関数を修正
    - 「他社買取」を含む売主を除外してから担当者リストを抽出
    - エラーハンドリングを実装（sellersが配列でない場合は空配列を返す）
    - _Requirements: 3.2_
  
  - [ ]* 1.4 Property 4のプロパティテストを作成
    - **Property 4: 担当者リストからの除外**
    - **Validates: Requirements 3.2**
    - fast-checkを使用して、「他社買取」のみの担当者がリストに含まれないことを検証
  
  - [ ]* 1.5 フロントエンドのユニットテストを作成
    - `isVisitAssignedTo()` のテストケースを追加（「他社買取」、「他社買取→追客」、「追客中」、空文字）
    - `getUniqueAssignees()` のテストケースを追加
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.4, 3.2_

- [x] 2. バックエンドのカウント計算を更新
  - [x] 2.1 `getSidebarCountsFallback()` に「他社買取」除外条件を追加
    - `backend/src/services/SellerService.supabase.ts` の `getSidebarCountsFallback()` メソッドを修正
    - **visitAssignedCountsの計算時に `.not('status', 'ilike', '%他社買取%')` を追加** ← ✅ 完了
    - **todayCallAssignedCountsの計算時に `.not('status', 'ilike', '%他社買取%')` を追加** ← ✅ 完了
    - エラーハンドリングを実装（データ取得失敗時はデフォルト値を返す）
    - _Requirements: 1.2, 2.1, 2.3_
  
  - [ ]* 2.2 Property 2のプロパティテストを作成
    - **Property 2: 他社買取除外カウント**
    - **Validates: Requirements 1.2, 2.1, 2.3**
    - fast-checkを使用して、「他社買取」を含む売主がカウントに含まれないことを検証

- [x] 3. バックエンドのリスト取得を更新
  - [x] 3.1 `listSellers()` の `visitAssigned:xxx` カテゴリ処理に「他社買取」除外条件を追加
    - `backend/src/services/SellerService.supabase.ts` の `listSellers()` メソッドを修正
    - **visitAssignedカテゴリの処理時に `.not('status', 'ilike', '%他社買取%')` を追加** ← ✅ 完了
    - **todayCallAssignedカテゴリの処理時に `.not('status', 'ilike', '%他社買取%')` を追加** ← ✅ 完了
    - エラーハンドリングを実装（クエリエラー時は空の結果を返す）
    - _Requirements: 1.3, 3.1, 3.4_
  
  - [ ]* 3.2 Property 3とProperty 5のプロパティテストを作成
    - **Property 3: 他社買取以外の売主の表示**
    - **Property 5: 全担当者への一貫した適用**
    - **Validates: Requirements 1.4, 3.4, 5.4**
    - fast-checkを使用して、「他社買取」を含まない売主が正しく表示されることを検証
  
  - [ ]* 3.3 バックエンドのユニットテストを作成
    - `getSidebarCountsFallback()` のテストケースを追加
    - `listSellers()` のテストケースを追加（visitAssigned:Iカテゴリで「他社買取」除外を検証）
    - _Requirements: 1.2, 1.3, 2.1, 2.3, 3.1_

- [ ] 4. チェックポイント - 全テストを実行
  - 全てのテストが通ることを確認し、ユーザーに質問があれば確認する

- [ ]* 5. 統合テストを作成
  - [ ]* 5.1 フロントエンドとバックエンドの連携テストを作成
    - サイドバーカウントとリスト取得で一貫した除外が行われることを検証
    - カウントとリストの件数が一致することを確認
    - _Requirements: 1.2, 1.3, 2.1, 2.3, 3.1_
  
  - [ ]* 5.2 他のカテゴリへの影響なしテストを作成
    - 「All」「当日TEL分」「未査定」「訪問日前日」カテゴリが影響を受けないことを検証
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6. 最終チェックポイント - 全テストを実行
  - 全てのテストが通ることを確認し、ユーザーに質問があれば確認する

## 注意事項

- `*` が付いているタスクはオプションで、スキップ可能です
- 各タスクは要件番号を参照しており、トレーサビリティを確保しています
- チェックポイントで段階的に検証を行います
- プロパティテストは最低100回の反復実行を行います
- 既存の除外ルール（一般媒介、専任媒介、追客不要）との整合性を保ちます
