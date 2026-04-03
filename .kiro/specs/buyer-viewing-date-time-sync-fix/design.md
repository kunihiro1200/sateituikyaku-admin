# 設計: 買主リストの内覧日・時間同期修正

## 概要

買主リストのGAS同期コードで、スプレッドシートのカラム名「●時間」を正しく参照するように修正する。

---

## 修正対象

### ファイル: `gas_buyer_complete_code.js`

**修正箇所**: 496行目

**現在のコード**:
```javascript
// 時間
var sheetViewingTime = row['時間'] ? String(row['時間']) : null;
var normalizedSheetViewingTime = normalizeValue(sheetViewingTime);
var normalizedDbViewingTime = normalizeValue(dbBuyer.viewing_time);
if (normalizedSheetViewingTime !== normalizedDbViewingTime) {
  updateData.viewing_time = normalizedSheetViewingTime;
  needsUpdate = true;
  if (normalizedSheetViewingTime === null && normalizedDbViewingTime !== null) {
    Logger.log('  🗑️ ' + buyerNumber + ': 内覧時間を削除 (旧値: ' + normalizedDbViewingTime + ')');
  }
}
```

**修正後のコード**:
```javascript
// 時間（BP列「●時間」）
var sheetViewingTime = row['●時間'] ? String(row['●時間']) : null;
var normalizedSheetViewingTime = normalizeValue(sheetViewingTime);
var normalizedDbViewingTime = normalizeValue(dbBuyer.viewing_time);
if (normalizedSheetViewingTime !== normalizedDbViewingTime) {
  updateData.viewing_time = normalizedSheetViewingTime;
  needsUpdate = true;
  if (normalizedSheetViewingTime === null && normalizedDbViewingTime !== null) {
    Logger.log('  🗑️ ' + buyerNumber + ': 内覧時間を削除 (旧値: ' + normalizedDbViewingTime + ')');
  }
}
```

**変更点**:
- `row['時間']` → `row['●時間']`（2箇所）
- コメントを明確化: `// 時間` → `// 時間（BP列「●時間」）`

---

## スプレッドシートのカラムマッピング

| 列 | カラム名 | データベースカラム | 説明 |
|----|---------|------------------|------|
| I | `●内覧日(最新)` | `viewing_date` | 内覧日（最新） |
| BP | `●時間` | `viewing_time` | 内覧時間 |

---

## 同期フロー

```
GASの syncBuyerList() が10分ごとに実行
  ↓
スプレッドシートから全買主データを取得
  ↓
各買主について:
  - row['●内覧日(最新)'] を取得 → viewing_date
  - row['●時間'] を取得 → viewing_time  ← 修正箇所
  ↓
データベースの値と比較
  ↓
差分があれば更新
  ↓
完了
```

---

## デプロイ手順

### ステップ1: ローカルファイルを修正

```bash
# gas_buyer_complete_code.js を編集
# 496行目を修正
```

### ステップ2: Google Apps Scriptエディタにコピー

1. 買主リストスプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. `gas_buyer_complete_code.js` の内容を**全て**コピー
4. GASエディタに**全て**ペースト（既存コードを上書き）
5. 保存（Ctrl+S）

### ステップ3: 手動実行してテスト

1. GASエディタで `syncBuyerList` 関数を選択
2. 「実行」ボタンをクリック
3. ログを確認（「実行ログ」タブ）
4. エラーがないことを確認

### ステップ4: データベースで確認

```bash
# 買主7282を確認
node backend/check-buyer-7282-simple.js
```

**期待結果**:
- `viewing_date`: `2026-04-05`
- `viewing_time`: `14:30`

---

## ロールバック手順

修正が問題を引き起こした場合:

1. Gitで元のコードを確認:
   ```bash
   git show HEAD:gas_buyer_complete_code.js
   ```

2. Google Apps Scriptエディタで元のコードをペースト

3. 保存

---

## 影響範囲

- **変更ファイル**: `gas_buyer_complete_code.js`（1ファイルのみ）
- **影響テーブル**: `buyers`
- **影響カラム**: `viewing_time`
- **影響範囲**: 全買主（過去のデータは修正されない、次回同期から正しく動作）

---

## 注意事項

### 過去のデータについて

この修正は**次回同期から**有効になります。過去に同期されなかったデータは自動的には修正されません。

**過去のデータを修正する場合**:
1. GASを修正
2. 手動で `syncBuyerList()` を実行
3. 全買主が再同期される

---

## 関連ドキュメント

- `.kiro/specs/buyer-viewing-date-time-sync-fix/bugfix.md` - バグ条件定義
- `.kiro/steering/gas-sidebar-counts-update-guide.md` - GAS更新ガイド
- `.kiro/steering/identifier-prefix-rules.md` - 識別子プレフィックスルール

---

**作成日**: 2026年4月3日  
**作成者**: Kiro
