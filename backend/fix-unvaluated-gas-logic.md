# GAS「未査定」カウントロジック修正

## 問題

AA13918が「未査定」カテゴリに表示され続ける問題。

## 根本原因

**GASコードの`updateSidebarCounts_`関数**（line 883）が間違った値をチェックしていた：

```javascript
// ❌ 間違い（修正前）
var isValuationNotNeeded = valuationMethod === '査定不要';
```

**正しい値**:
```javascript
// ✅ 正しい（修正後）
var isValuationNotNeeded = valuationMethod === '不要';
```

## 詳細

### バックエンドのロジック（正しい）

`backend/src/services/SellerService.supabase.ts` (line 2458):
```typescript
const isNotRequired = valuationMethod === '不要';
```

### GASのロジック（間違っていた）

`gas_complete_code.js` (line 883):
```javascript
var isValuationNotNeeded = valuationMethod === '査定不要';  // ❌ 間違い
```

### 影響

- GASが10分ごとに`seller_sidebar_counts`テーブルを更新する際、間違ったロジックで「未査定」カウントを計算していた
- `valuationMethod === '不要'`の売主が「未査定」に含まれてしまっていた
- バックエンドの`getSidebarCountsFallback()`は正しいロジックだったが、GASが更新したキャッシュが間違っていた

## 修正内容

**ファイル**: `gas_complete_code.js`

**変更箇所**: line 883

```javascript
// 修正前
var isValuationNotNeeded = valuationMethod === '査定不要';

// 修正後
var isValuationNotNeeded = valuationMethod === '不要';  // 🚨 修正: '査定不要' → '不要'
```

## 次のステップ

1. **GASコードをGoogle Apps Scriptエディタにコピー＆ペースト**
2. **GASの`syncSellerList`関数を手動実行**（または10分待つ）
3. **`seller_sidebar_counts`テーブルが更新される**
4. **フロントエンドで確認**（ハードリフレッシュ: Ctrl+Shift+R）

## 確認方法

```bash
# サイドバーカウントを確認
npx ts-node backend/check-sidebar-counts-aa13918.ts
```

**期待される結果**:
- `unvaluated: 7件` （現在は1件だが、GAS同期後は7件になるはず）
- AA13918は「未査定」に含まれない
- AA13918は「当日TEL_未着手」に含まれる

## 関連ファイル

- `gas_complete_code.js` (line 883) - **修正済み**
- `backend/src/services/SellerService.supabase.ts` (line 2458) - 正しいロジック
- `backend/check-sidebar-counts-aa13918.ts` - 診断スクリプト

---

**作成日**: 2026年4月5日  
**修正理由**: GASの「未査定」カウントロジックがバックエンドと不一致だったため
