# Tasks

## Phase 1: GASカウント計算ロジック実装

- [x] 1.1 `updateBuyerSidebarCounts_()`関数の骨格を作成
- [x] 1.2 「問合メール未対応」カテゴリのカウント計算ロジックを実装
- [x] 1.3 「業者問合せあり」カテゴリのカウント計算ロジックを実装
- [x] 1.4 「一般媒介_内覧後売主連絡未」カテゴリのカウント計算ロジックを実装
- [x] 1.5 「要内覧促進客」カテゴリのカウント計算ロジックを実装
- [x] 1.6 「ピンリッチ未登録」カテゴリのカウント計算ロジックを実装
- [x] 1.7 Supabase APIでカウントを`buyer_sidebar_counts`テーブルに保存
- [x] 1.8 `syncBuyerList()`から`updateBuyerSidebarCounts_()`を呼び出し
- [ ] 1.9 GASエディタにコピー＆ペーストして手動実行テスト

## Phase 2: Backend API実装

- [x] 2.1 `/api/buyers/sidebar-counts`エンドポイントを作成
- [x] 2.2 `buyer_sidebar_counts`テーブルからカウントを取得するクエリを実装
- [x] 2.3 レスポンス形式を整形（5つの新カテゴリのカウントを返す）
- [x] 2.4 エラーハンドリングを実装
- [ ] 2.5 ローカル環境でテスト

## Phase 3: Frontend表示実装

- [x] 3.1 `BuyerStatusSidebar.tsx`の`CategoryCounts`型に5つの新カテゴリを追加
- [x] 3.2 `getCategoryColor()`関数に新カテゴリの色（赤: #d32f2f）を追加
- [x] 3.3 `getCategoryLabel()`関数に新カテゴリのラベルを追加
- [x] 3.4 サイドバーに新カテゴリを表示するロジックを実装
- [x] 3.5 カウントが0の場合に非表示にするロジックを確認
- [ ] 3.6 ローカル環境でサイドバー表示をテスト

## Phase 4: Frontendフィルタリング実装

- [x] 4.1 `BuyersPage.tsx`でカテゴリ選択時の処理を実装
- [x] 4.2 各カテゴリのフィルタリング条件を構築
- [x] 4.3 APIに条件を渡して買主リストを取得
- [x] 4.4 URLパラメータにフィルタリング条件を保存
- [x] 4.5 ページリロード時にURLパラメータから条件を復元
- [ ] 4.6 ローカル環境でフィルタリング動作をテスト

## Phase 5: テストとデプロイ

- [ ] 5.1 GASの実行ログを確認してエラーがないか検証
- [ ] 5.2 `buyer_sidebar_counts`テーブルにカウントが正しく保存されているか確認
- [ ] 5.3 Backend APIのレスポンスが正しいか確認
- [ ] 5.4 Frontendで各カテゴリが赤字で表示されるか確認
- [ ] 5.5 各カテゴリをクリックして正しくフィルタリングされるか確認
- [-] 5.6 本番環境にデプロイ（Backend + Frontend）
- [ ] 5.7 本番環境で動作確認

## Phase 6: ドキュメント更新

- [ ] 6.1 `buyer-sidebar-status-definition.md`に新カテゴリの定義を追加
- [ ] 6.2 `gas-sidebar-counts-update-guide.md`に新カテゴリの追加手順を記録
- [ ] 6.3 README.mdを更新（必要に応じて）
