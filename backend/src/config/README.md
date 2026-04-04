# Configuration Files

## ⚠️ 重要：buyer-column-mapping.json の編集について

**`buyer-column-mapping.json`を編集する前に、必ず以下を確認してください：**

### 絶対に変更してはいけない設定

#### 1. `spreadsheetToDatabase`セクション

```json
"spreadsheetToDatabase": {
  "●内覧日(最新）": "viewing_date"  // ← 絶対に "latest_viewing_date" にしてはいけない
}
```

**理由**: `latest_viewing_date`にすると、DB→スプレッドシートの即時同期が壊れます。

#### 2. `databaseToSpreadsheet`セクション

```json
"databaseToSpreadsheet": {
  "viewing_date": "●内覧日(最新）"  // ← 絶対に変更してはいけない
}
```

**理由**: スプレッドシートのヘッダー名と一致しなくなります。

### マッピングの一貫性

**両方向で`viewing_date`を使用することが絶対条件です：**

- スプレッドシート → DB: `"●内覧日(最新）"` → `viewing_date`
- DB → スプレッドシート: `viewing_date` → `"●内覧日(最新）"`

### 変更前のチェックリスト

- [ ] `spreadsheetToDatabase`セクションで`viewing_date`を`latest_viewing_date`に変更していないか？
- [ ] `databaseToSpreadsheet`セクションを削除していないか？
- [ ] カラム名の半角カッコ・全角カッコを変更していないか？

### 検証方法

変更後は、必ず以下のテストを実行してください：

```bash
cd backend
npx ts-node test-buyer-viewing-date-mapping-validation.ts
```

テストが失敗した場合は、変更を元に戻してください。

### 詳細ドキュメント

詳細は以下のドキュメントを参照してください：

- `.kiro/steering/buyer-viewing-date-sync-protection.md` - 買主内覧日同期保護ルール

### 過去の失敗事例

**2026年4月5日以前**: `spreadsheetToDatabase`で`"●内覧日(最新）"`を`latest_viewing_date`にマッピングしていたため、即時同期が壊れていました。

**修正後**: `viewing_date`に統一することで、即時同期が正常に動作するようになりました。

---

**この設定を守ることで、買主内覧日の即時同期が確実に動作します。**
