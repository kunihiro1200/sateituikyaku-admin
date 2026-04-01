# 実装タスクリスト：買主リスト表示パフォーマンス改善

## 1. Bug Condition探索テスト（実装前）

- [ ] 1. サイドバーカウント取得の遅延を確認するテスト
  - **Property 1: Bug Condition** - サイドバーカウント取得が10秒以上かかる
  - **重要**: このテストは実装前に実行し、バグの存在を確認する
  - **目標**: 未修正コードでテストが失敗することを確認（バグの存在証明）
  - **Scoped PBT Approach**: 買主リストページを開いたときのサイドバーカウント取得時間を測定
  - テスト内容: `/api/buyers/status-categories-with-buyers` の応答時間が10秒以上かかることを確認
  - 未修正コードで実行 - **期待される結果: テスト失敗**（10秒以上かかる）
  - 失敗例を記録: 「サイドバーカウント取得に12秒かかった」
  - _Requirements: 1.1_

## 2. Preservation Property Tests（実装前）

- [ ] 2. テーブルデータ取得の保持テスト
  - **Property 2: Preservation** - テーブルデータ取得は変更されない
  - **重要**: 観察優先方法論に従う
  - 観察: 未修正コードで `/api/buyers` がページネーション付きでデータを返すことを確認
  - 観察: 検索・フィルタリング機能が正常に動作することを確認
  - プロパティベーステスト: 全ての非サイドバーカウント入力に対して、テーブルデータ取得が同じ結果を返すことを検証
  - 未修正コードで実行 - **期待される結果: テスト成功**（ベースライン動作の確認）
  - テスト成功を確認してタスク完了とする
  - _Requirements: 3.1, 3.2_

## 3. Phase 1: データベーススキーマの作成

- [ ] 3.1 `buyer_sidebar_counts` テーブルの作成
  - マイグレーションファイルを作成: `backend/supabase/migrations/YYYYMMDDHHMMSS_create_buyer_sidebar_counts.sql`
  - テーブル構造:
    - `category` (TEXT): カテゴリ名
    - `count` (INTEGER): カウント数
    - `label` (TEXT, nullable): ラベル
    - `assignee` (TEXT, nullable): 担当者イニシャル
    - `updated_at` (TIMESTAMP): 更新日時
  - 主キー: `(category, COALESCE(label, ''), COALESCE(assignee, ''))`
  - インデックス: `category` カラム
  - _Bug_Condition: isBugCondition(input) where input.page = '/buyers' AND input.action = 'load'_
  - _Expected_Behavior: サイドバーカウントを1秒以内に返す_
  - _Preservation: テーブルデータ取得、ページネーション、フィルタリングは変更しない_
  - _Requirements: 2.1_

  - [ ] 3.1.1 マイグレーションをローカルで実行
    - `npx supabase migration up` でローカルDBに適用
    - テーブルが正しく作成されたか確認

  - [x] 3.1.2 マイグレーションを本番環境に適用
    - Supabase Dashboardでマイグレーションを実行
    - 本番DBにテーブルが作成されたか確認

## 4. Phase 2: GASの実装

- [x] 4.1 `updateBuyerSidebarCounts_()` 関数の実装
  - ファイル: `gas_complete_code.js`
  - 実装内容:
    - スプレッドシートから全買主データを取得
    - 各カテゴリのカウントを計算（売主リストと同じロジック）
    - `buyer_sidebar_counts` テーブルに保存（DELETE + INSERT）
  - カテゴリ計算ロジック:
    - 当日TEL分（担当なし）
    - 当日TEL（担当別）
    - 担当（担当別）
    - その他のカテゴリ（STATUS_DEFINITIONS に基づく）
  - _Requirements: 2.1_

  - [x] 4.1.1 `syncBuyerList()` 関数に `updateBuyerSidebarCounts_()` の呼び出しを追加
    - 同期完了後に `updateBuyerSidebarCounts_()` を呼び出す

  - [x] 4.1.2 GASエディタにコピー＆ペースト
    - Google スプレッドシートを開く
    - 「拡張機能」→「Apps Script」を選択
    - `gas_complete_code.js` の内容を全てコピー
    - GASエディタに全てペースト（既存コードを上書き）
    - 保存（Ctrl+S）

  - [x] 4.1.3 手動実行してテスト
    - GASエディタで `syncBuyerList` 関数を選択
    - 「実行」ボタンをクリック
    - ログを確認（「実行ログ」タブ）
    - `buyer_sidebar_counts` テーブルに新しいカテゴリが追加されたか確認

## 5. Phase 3: バックエンドAPIの実装

- [x] 5.1 `BuyerService.getSidebarCounts()` メソッドの追加
  - ファイル: `backend/src/services/BuyerService.ts`
  - 実装内容:
    - `buyer_sidebar_counts` テーブルから全行取得
    - カテゴリ別に集計して返す
    - エラー時は `getSidebarCountsFallback()` にフォールバック
  - _Requirements: 2.1_

  - [x] 5.1.1 `BuyerService.getSidebarCountsFallback()` メソッドの追加
    - 従来の `getStatusCategoriesWithBuyers()` と同じロジック
    - `buyer_sidebar_counts` テーブルが空またはエラー時に使用

  - [x] 5.1.2 `/api/buyers/sidebar-counts` エンドポイントの追加
    - ファイル: `backend/src/routes/buyers.ts`
    - `BuyerService.getSidebarCounts()` を呼び出す
    - レスポンス形式: `{ categories: [...], normalStaffInitials: [...] }`

  - [x] 5.1.3 ローカルでテスト
    - `curl http://localhost:3000/api/buyers/sidebar-counts` でテスト
    - レスポンスが正しいか確認

## 6. Phase 4: フロントエンドの修正

- [x] 6.1 サイドバーカウント取得の変更
  - ファイル: `frontend/frontend/src/pages/BuyersPage.tsx`
  - 変更内容:
    - `/api/buyers/status-categories-with-buyers` → `/api/buyers/sidebar-counts` に変更
    - テーブルデータ取得と並列実行（`Promise.all`）
  - _Requirements: 2.2_

  - [x] 6.1.1 `/api/buyers/status-categories-with-buyers` の使用を削除
    - 使用箇所を全て削除
    - エンドポイント自体は削除しない（後方互換性のため）

  - [x] 6.1.2 ローカルでテスト
    - `http://localhost:5173/buyers` を開く
    - サイドバーが1秒以内に表示されることを確認
    - テーブルデータが正しく表示されることを確認

## 7. Phase 5: テスト・検証

- [ ] 7.1 サイドバーカウントの正確性テスト
  - 各カテゴリのカウントが正しいことを確認
  - 売主リストのサイドバーカウントと同じロジックで計算されていることを確認
  - 手動計算と一致することを確認
  - _Requirements: 2.1_

- [ ] 7.2 パフォーマンステスト
  - 買主リストページの初回ロード時間を測定
  - サイドバー表示時間を測定（1秒以内）
  - テーブル表示時間を測定（2秒以内）
  - 全体として4秒以内に表示されることを確認
  - _Requirements: 2.1, 2.2_

- [ ] 7.3 リグレッションテスト
  - **Property 2: Preservation** - テーブルデータ取得の保持
  - **重要**: タスク2で作成したテストを再実行
  - テーブルデータの取得が正常に動作することを確認
  - ページネーション、検索、フィルタリングが正常に動作することを確認
  - サイドバーカテゴリの表示が正常に動作することを確認
  - **期待される結果: テスト成功**（リグレッションなし）
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7.4 Bug Condition検証テスト（実装後）
  - **Property 1: Expected Behavior** - サイドバーカウント高速取得
  - **重要**: タスク1で作成したテストを再実行
  - `/api/buyers/sidebar-counts` の応答時間が1秒以内であることを確認
  - **期待される結果: テスト成功**（バグが修正された）
  - _Requirements: 2.1_

## 8. Checkpoint - 全テスト成功確認

- [ ] 8. 全テスト成功確認
  - 全てのテストが成功していることを確認
  - 質問があればユーザーに確認

---

## 📝 注意事項

### GASコードの更新手順（最重要）

GASコードの更新は3ステップ：

1. **`gas_complete_code.js` を更新**（3箇所）
   - カウント変数の初期化
   - カテゴリ計算ロジック
   - Supabaseへの保存

2. **GASエディタにコピー＆ペースト**
   - Google スプレッドシートを開く
   - 「拡張機能」→「Apps Script」を選択
   - `gas_complete_code.js` の内容を全てコピー
   - GASエディタに全てペースト（既存コードを上書き）
   - 保存（Ctrl+S）

3. **手動実行してテスト**
   - GASエディタで `syncBuyerList` 関数を選択
   - 「実行」ボタンをクリック
   - ログを確認

### デプロイ手順

**Git連携によりpushするだけで自動デプロイされます。**

```bash
git add .
git commit -m "fix: 買主リスト表示パフォーマンス改善"
git push origin main
```

- `sateituikyaku-admin-backend`（バックエンド）→ Root Directory: `backend`
- `sateituikyaku-admin-frontend`（フロントエンド）→ Root Directory: `frontend/frontend`

---

**作成日**: 2026年3月26日  
**仕様書**: `.kiro/specs/buyer-list-performance-improvement/bugfix.md`  
**デザイン**: `.kiro/specs/buyer-list-performance-improvement/design.md`
