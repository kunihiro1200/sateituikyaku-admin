# GASコード更新手順（重要）

## 問題の原因

AA13918が「未査定」カテゴリに表示され続ける問題の**根本原因**は、**GASコードのロジックがバックエンドと不一致**だったことです。

### 具体的な問題

GASの`updateSidebarCounts_`関数（line 883）が間違った値をチェックしていました：

```javascript
// ❌ 間違い（修正前）
var isValuationNotNeeded = valuationMethod === '査定不要';

// ✅ 正しい（修正後）
var isValuationNotNeeded = valuationMethod === '不要';
```

## 修正内容

`gas_complete_code.js`のline 883を修正しました（commit 627b2180）。

## 🚨 必須作業：GASエディタへの反映

**この修正を有効にするには、GASエディタにコードをコピー＆ペーストする必要があります。**

### 手順

1. **`gas_complete_code.js`の内容を全てコピー**
   - ファイルを開く
   - 全選択（Ctrl+A）
   - コピー（Ctrl+C）

2. **Google スプレッドシートを開く**
   - 売主リストスプレッドシートを開く

3. **Apps Scriptエディタを開く**
   - 「拡張機能」→「Apps Script」を選択

4. **コードを全て置き換え**
   - GASエディタの既存コードを全選択（Ctrl+A）
   - 削除（Delete）
   - コピーした`gas_complete_code.js`の内容をペースト（Ctrl+V）

5. **保存**
   - Ctrl+S または「保存」ボタンをクリック

6. **手動実行（推奨）**
   - 関数選択: `syncSellerList`
   - 「実行」ボタンをクリック
   - 実行ログを確認

## 確認方法

### 1. GAS実行ログを確認

実行ログに以下が表示されることを確認：
```
📊 サイドバーカウント更新開始...
✅ seller_sidebar_counts INSERT成功: XX件
📊 サイドバーカウント更新完了: 合計 XX行
```

### 2. データベースを確認

```bash
npx ts-node backend/check-sidebar-counts-aa13918.ts
```

**期待される結果**:
```
📊 現在のサイドバーカウント:
   unvaluated: 7件 (更新: 2026-04-05T...)

🔍 AA13918が「未査定」に含まれているか: いいえ ✅
🔍 AA13918が「当日TEL_未着手」に含まれているか: はい ✅
```

### 3. ブラウザで確認

1. **ハードリフレッシュ**（Ctrl+Shift+R または Ctrl+F5）
2. **サイドバーの「未査定」カウントを確認**
   - 期待値: 7件
3. **「未査定」をクリックして一覧を確認**
   - AA13918が表示されないことを確認
   - 7件の売主が表示されることを確認

## トラブルシューティング

### Q: GAS実行後もカウントが変わらない

**A**: 以下を確認してください：
1. GASエディタに正しくコードをペーストしたか？
2. 保存したか？
3. `syncSellerList`関数を実行したか？
4. 実行ログにエラーが出ていないか？

### Q: ブラウザで変わらない

**A**: 以下を試してください：
1. ハードリフレッシュ（Ctrl+Shift+R）
2. ブラウザのキャッシュをクリア
3. DevToolsのNetworkタブでAPIレスポンスを確認

## 関連ファイル

- `gas_complete_code.js` (line 883) - **修正済み**
- `backend/fix-unvaluated-gas-logic.md` - 詳細な説明
- `backend/check-sidebar-counts-aa13918.ts` - 診断スクリプト

---

**作成日**: 2026年4月5日  
**重要度**: 🚨 最高  
**所要時間**: 5分
