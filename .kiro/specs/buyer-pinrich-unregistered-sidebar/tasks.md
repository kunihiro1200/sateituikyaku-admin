# 実装計画: buyer-pinrich-unregistered-sidebar

## 概要

買主リストのサイドバーに「Pinrich未登録」カテゴリーを追加する。
過去の失敗（カテゴリーから消えずにクリックするとデータなし）を防ぐため、カテゴリー表示とフィルタリング結果の常時一致を最重要原則とする。

## タスク

- [ ] 1. バックエンド: BuyerStatusCalculator.ts の修正
  - [x] 1.1 Priority 31「ピンリッチ未登録」の判定条件を修正する
    - `isBlank(buyer.pinrich)` に加えて `equals(buyer.pinrich, '登録無し')` を OR 条件で追加する
    - `reception_date >= '2026-01-01'` の条件を AND 条件で追加する（`isOnOrAfter` ヘルパーが存在しない場合は直接比較を使用）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_
  - [ ]* 1.2 `BuyerStatusCalculator` の単体テストを書く
    - pinrich=null, email='a@b.com', broker_inquiry='', reception_date='2026-01-15' → 'ピンリッチ未登録'
    - pinrich='', email='a@b.com', broker_inquiry='', reception_date='2026-01-15' → 'ピンリッチ未登録'
    - pinrich='登録無し', email='a@b.com', broker_inquiry='', reception_date='2026-01-15' → 'ピンリッチ未登録'
    - pinrich='送信中', email='a@b.com', broker_inquiry='', reception_date='2026-01-15' → 'ピンリッチ未登録' でない
    - pinrich='', email='a@b.com', broker_inquiry='', reception_date='2025-12-31' → 'ピンリッチ未登録' でない
    - pinrich='', email='', broker_inquiry='', reception_date='2026-01-15' → 'ピンリッチ未登録' でない
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.4_
  - [ ]* 1.3 Property 1: `isPinrichUnregistered` の正確な判定プロパティテストを書く（fast-check）
    - **Property 1: isPinrichUnregistered の正確な判定**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.4**

- [ ] 2. チェックポイント - BuyerStatusCalculator の修正確認
  - すべてのテストが通ることを確認する。疑問点があればユーザーに確認する。

- [ ] 3. バックエンド: BuyerService.ts の修正（backend/src/ のみ）
  - [x] 3.1 `shouldUpdateBuyerSidebarCounts` の `sidebarFields` に `'pinrich'` を追加する
    - `pinrich` フィールドが変更された場合にキャッシュが無効化されるようにする
    - _Requirements: 2.1, 2.2, 5.1_
  - [ ]* 3.2 `shouldUpdateBuyerSidebarCounts` の単体テストを書く
    - `{ pinrich: '送信中' }` → `true`
    - `{ pinrich: '登録無し' }` → `true`
    - `{ latest_status: '追客中' }` → `false`
    - _Requirements: 2.1, 2.2, 5.1_
  - [ ]* 3.3 Property 3: `pinrich` 変更時のキャッシュ無効化プロパティテストを書く（fast-check）
    - **Property 3: pinrich変更時のキャッシュ無効化**
    - **Validates: Requirements 2.1, 2.2, 5.1**
  - [x] 3.4 `getBuyersByStatus` の `pinrichUnregistered` フィルタリングロジックを実装する
    - 現在空配列を返している箇所に、`pinrich` が NULL・空文字・「登録無し」かつ `reception_date >= '2026-01-01'` のフィルタを実装する
    - `BuyerStatusCalculator.ts` の Priority 31 条件と完全に一致させること
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.4_
  - [x] 3.5 `getSidebarCountsFallback` の `pinrichUnregistered` カウントを動的計算で実装する
    - `pinrich` が NULL・空文字・「登録無し」かつ `reception_date >= '2026-01-01'` の件数を計算する
    - _Requirements: 3.3_
  - [ ]* 3.6 `getSidebarCounts` のレスポンスに `pinrichUnregistered` が含まれることを確認する単体テストを書く
    - _Requirements: 3.1, 3.3_
  - [ ]* 3.7 Property 2: バックエンドカウントとフロントエンドフィルタの一致プロパティテストを書く（fast-check）
    - **Property 2: バックエンドカウントとフロントエンドフィルタの一致（モデルベーステスト）**
    - バックエンドのロジックをモック化してフィルター結果と比較
    - **Validates: Requirements 1.5, 1.6, 3.2, 3.4, 4.3, 5.3, 5.4**

- [ ] 4. チェックポイント - BuyerService.ts の修正確認
  - すべてのテストが通ることを確認する。疑問点があればユーザーに確認する。

- [ ] 5. バグ修正: inquiry_source='2件目以降' の既存データ一括修正
  - [x] 5.1 `inquiry_source = '2件目以降'` かつ `pinrich IS NULL または空文字` の買主を一括で `pinrich = '登録不要（不可）'` に更新するPythonスクリプトを作成・実行する
    - 対象件数を事前に確認してからユーザーに報告し、承認を得てから実行する
    - _Requirements: 6.1_
  - [x] 5.2 `BuyerStatusCalculator.ts` の Priority 31 に `inquiry_source !== '2件目以降'` の条件を追加する
    - `notEquals(buyer.inquiry_source, '2件目以降')` を AND 条件で追加する
    - `getBuyersByStatus` の `pinrichUnregistered` フィルタにも同条件を追加する
    - `getSidebarCountsFallback` のカウントにも同条件を追加する
    - _Requirements: 6.2, 6.3, 6.4_
  - [x] 5.3 修正後、7609が「Pinrich未登録」サイドバーから消えることを確認する
    - _Requirements: 6.1, 6.2_

- [ ] 6. チェックポイント - すべてのテストが通ることを確認する
  - すべてのテストが通ることを確認する。疑問点があればユーザーに確認する。

## 注意事項

- タスク `*` 付きはオプションであり、MVP優先の場合はスキップ可能
- 日本語を含むファイルの編集は必ずPythonスクリプトを使用してUTF-8で書き込む
- `backend/src/` のみ編集対象（`backend/api/` は触らない）
- `BuyerStatusCalculator.ts` の Priority 31 条件と `getBuyersByStatus` の `pinrichUnregistered` フィルタ条件を必ず一致させること（不一致が過去の問題の原因）
- プロパティテストには fast-check を使用し、最低100回のランダム入力で実行する
- `BuyerStatusSidebar.tsx` と `BuyersPage.tsx` は `BuyerStatusCalculator.ts` 修正後に自動的に機能するため変更不要
- `inquiry_source = '2件目以降'` の買主は `pinrich` が「登録不要（不可）」であるべき。バックエンドの `applySecondInquiryRule` は新規・更新時に適用済みだが、既存データには未適用のため一括修正が必要
