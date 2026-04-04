# 買主リスト「当日TEL」「３回架電未」カテゴリ追加 - タスクリスト

## 📋 タスク概要

買主リストのサイドバーに「当日TEL」カテゴリと「３回架電未」サブカテゴリを追加する実装タスクです。

---

## 🎯 実装フェーズ

### Phase 1: データベースマイグレーション

- [x] 1.1 マイグレーションファイルの作成
  - ファイル: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_buyer_three_call_fields.sql`
  - 内容:
    - `buyers.three_call_confirmed` カラムを追加（TEXT型）
    - `buyers.inquiry_email_phone_response` カラムを追加（TEXT型）
    - インデックスを追加（検索パフォーマンス向上）
    - コメントを追加

- [x] 1.2 ローカル環境でテスト
  - `npx supabase migration up` を実行
  - カラムが追加されることを確認
  - インデックスが作成されることを確認

- [x] 1.3 本番環境にデプロイ
  - `npx supabase db push` を実行
  - 本番データベースにカラムが追加されることを確認

---

### Phase 2: GAS同期処理の実装

- [ ] 2.1 スプレッドシート列位置の確認
  - 買主リストスプレッドシートを開く
  - FC列「３回架電確認済み」の存在を確認
  - 「【問合メール】電話対応」列の位置を確認（列名を正確に記録）

- [x] 2.2 `syncBuyerList()` の修正
  - ファイル: `gas_buyer_complete_code.js`
  - 追加内容:
    - FC列「３回架電確認済み」の同期処理
    - 「【問合メール】電話対応」列の同期処理
    - `normalizeValue()` を使用した値の正規化
    - `updateData` への追加

- [x] 2.3 `updateBuyerSidebarCounts_()` の修正
  - ファイル: `gas_buyer_complete_code.js`
  - 追加内容:
    - カウント変数の初期化（`todayCall`, `threeCallUnchecked`）
    - 当日TELカテゴリの計算ロジック
    - ３回架電未カテゴリの計算ロジック
    - Supabaseへの保存処理

- [ ] 2.4 GASエディタへのデプロイ
  - `gas_buyer_complete_code.js` の内容を全てコピー
  - GASエディタにペースト（既存コードを上書き）
  - 保存（Ctrl+S）

- [ ] 2.5 GAS手動実行テスト
  - GASエディタで `syncBuyerList` 関数を選択
  - 「実行」ボタンをクリック
  - 実行ログを確認:
    - 「３回架電確認済み」が同期されることを確認
    - 「【問合メール】電話対応」が同期されることを確認
  - GASエディタで `updateBuyerSidebarCounts_` 関数を選択
  - 「実行」ボタンをクリック
  - 実行ログを確認:
    - 「当日TEL」カウントが計算されることを確認
    - 「３回架電未」カウントが計算されることを確認

- [ ] 2.6 データベース確認
  - `buyers` テーブルを確認:
    - `three_call_confirmed` カラムにデータが保存されていることを確認
    - `inquiry_email_phone_response` カラムにデータが保存されていることを確認
  - `buyer_sidebar_counts` テーブルを確認:
    - `category = 'todayCall'` のレコードが存在することを確認
    - `category = 'threeCallUnchecked'` のレコードが存在することを確認

---

### Phase 3: バックエンドAPIの実装

- [x] 3.1 `BuyerService.listBuyers()` の修正
  - ファイル: `backend/src/services/BuyerService.ts`
  - 追加内容:
    - `statusCategory === 'todayCall'` のフィルタリング条件
    - `statusCategory === 'threeCallUnchecked'` のフィルタリング条件

- [ ] 3.2 ローカル環境でテスト
  - バックエンドサーバーを起動（`npm run dev`）
  - `/api/buyers/sidebar-counts` エンドポイントをテスト:
    - `todayCall` カウントが返されることを確認
    - `threeCallUnchecked` カウントが返されることを確認
  - `/api/buyers?statusCategory=todayCall` エンドポイントをテスト:
    - 後続担当が空の買主のみが返されることを確認
    - 次電日が今日以前の買主のみが返されることを確認
  - `/api/buyers?statusCategory=threeCallUnchecked` エンドポイントをテスト:
    - `three_call_confirmed = '3回架電未'` の買主のみが返されることを確認
    - `inquiry_email_phone_response = '不通' OR '未'` の買主のみが返されることを確認

- [x] 3.3 本番環境にデプロイ
  - `git add .`
  - `git commit -m "feat: 買主リスト「当日TEL」「３回架電未」カテゴリ追加（バックエンド）"`
  - `git push origin main`
  - Vercelで自動デプロイされることを確認

---

### Phase 4: フロントエンドの実装

- [x] 4.1 `BuyerStatusSidebar.tsx` の修正
  - ファイル: `frontend/frontend/src/components/BuyerStatusSidebar.tsx`
  - 追加内容:
    - `statusList` useMemoに「当日TEL」カテゴリを追加
    - `statusList` useMemoに「３回架電未」カテゴリを追加（インデント表示）
    - `getCategoryColor()` 関数に色定義を追加

- [ ] 4.2 ローカル環境でテスト
  - フロントエンドサーバーを起動（`npm run dev`）
  - `http://localhost:5173/buyers` を開く
  - サイドバーに「⑯当日TEL」が表示されることを確認
  - サイドバーに「↳ ３回架電未」がインデント表示されることを確認
  - カウント数が正しいことを確認
  - 「⑯当日TEL」をクリックして、正しくフィルタリングされることを確認
  - 「↳ ３回架電未」をクリックして、正しくフィルタリングされることを確認

- [x] 4.3 本番環境にデプロイ
  - `git add .`
  - `git commit -m "feat: 買主リスト「当日TEL」「３回架電未」カテゴリ追加（フロントエンド）"`
  - `git push origin main`
  - Vercelで自動デプロイされることを確認

---

### Phase 5: 統合テスト

- [ ] 5.1 GASの10分同期テスト
  - GASの10分トリガーが実行されるのを待つ（または手動実行）
  - `buyer_sidebar_counts` テーブルが更新されることを確認
  - 本番環境の買主リストページを開く
  - サイドバーカウントが正しく表示されることを確認

- [ ] 5.2 エンドツーエンドテスト
  - スプレッドシートで「３回架電確認済み」を「3回架電未」に変更
  - スプレッドシートで「【問合メール】電話対応」を「不通」に変更
  - GASの10分同期を待つ（または手動実行）
  - 本番環境の買主リストページを開く
  - サイドバーの「３回架電未」カウントが増えることを確認
  - 「３回架電未」をクリックして、該当する買主が表示されることを確認

- [ ] 5.3 既存機能への影響確認
  - 「②内覧日前日」カテゴリが正常に動作することを確認
  - 「担当(イニシャル)」カテゴリが正常に動作することを確認
  - 「↳ 当日TEL(イニシャル)」カテゴリが正常に動作することを確認
  - 買主一覧のページネーションが正常に動作することを確認

---

## 📝 実装優先順位

1. **Phase 1**: データベースマイグレーション（最優先）
2. **Phase 2**: GAS同期処理の実装
3. **Phase 3**: バックエンドAPIの実装
4. **Phase 4**: フロントエンドの実装
5. **Phase 5**: 統合テスト

---

## 🚨 注意事項

### 1. スプレッドシート列位置の確認

「【問合メール】電話対応」カラムの列位置は要確認です。Phase 2.1で必ず確認してください。

### 2. GASコードの更新

GASコードを更新する際は、必ず全体をコピー＆ペーストしてください。部分的な更新は避けてください。

### 3. データベースマイグレーション

本番環境にデプロイする前に、必ずローカル環境でテストしてください。

### 4. 既存機能への影響

各フェーズの実装後、必ず既存機能が正常に動作することを確認してください。

---

## ✅ 完了条件

### 受け入れ基準

- [ ] サイドバーに「⑯当日TEL」が表示される
- [ ] サイドバーに「↳ ３回架電未」がインデント表示される
- [ ] カウント数が正しい
- [ ] クリックすると正しくフィルタリングされる
- [ ] GASの10分同期が正常に動作する
- [ ] 既存機能に影響がない

---

**作成日**: 2026年4月5日  
**作成者**: Kiro AI  
**ステータス**: タスクリスト作成完了
