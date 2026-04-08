# 物件リストスプレッドシート同期修正記録

## 修正日
2026年4月8日

## 問題
「事務へCHAT」送信後、サイドバーは「未完了」カテゴリーに表示されるが、スプレッドシートのDQ列（確認）が「未」に即時同期されない。

## 根本原因
環境変数名の不一致:
- コード: `GOOGLE_SHEETS_SPREADSHEET_ID`を使用
- Vercel環境変数: `PROPERTY_LISTING_SPREADSHEET_ID`が設定されている
- `GOOGLE_SHEETS_SPREADSHEET_ID`は別のスプレッドシート（売主用）で使用されているため、物件リスト用には`PROPERTY_LISTING_SPREADSHEET_ID`を使用する必要があった

## 修正内容

### 1. 環境変数名の変更（コミット: df31922e）
`backend/src/routes/propertyListings.ts`の2箇所を修正:

**修正前**:
```typescript
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
console.log(`[send-chat-to-office] GOOGLE_SHEETS_SPREADSHEET_ID: ${spreadsheetId ? '設定済み' : '未設定'}`);

if (!spreadsheetId) {
  throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set');
}

const sheetsClient = new GoogleSheetsClient({
  spreadsheetId,
  sheetName: '物件',
});
const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);
```

**修正後**:
```typescript
const spreadsheetId = process.env.PROPERTY_LISTING_SPREADSHEET_ID || '';
console.log(`[send-chat-to-office] PROPERTY_LISTING_SPREADSHEET_ID: ${spreadsheetId ? '設定済み' : '未設定'}`);

if (!spreadsheetId) {
  throw new Error('PROPERTY_LISTING_SPREADSHEET_ID is not set');
}

const sheetsClient = new GoogleSheetsClient({
  spreadsheetId,
  sheetName: '物件',
});
await sheetsClient.authenticate();
const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);
```

**変更点**:
- `GOOGLE_SHEETS_SPREADSHEET_ID` → `PROPERTY_LISTING_SPREADSHEET_ID`
- `sheetsClient.authenticate()`の呼び出しを追加（認証を明示的に実行）

## 影響範囲
- `backend/src/routes/propertyListings.ts`の`send-chat-to-office`エンドポイント（2箇所）

## テスト確認事項
- [ ] 「事務へCHAT」送信後、スプレッドシートのDQ列が「未」に即時更新される
- [ ] ログに`[PropertyListingSpreadsheetSync]`と`[GoogleSheetsClient]`が表示される
- [ ] サイドバーが「未完了」カテゴリーに表示される
- [ ] エラーログに「PROPERTY_LISTING_SPREADSHEET_ID is not set」が表示されない

## 関連ファイル
- `backend/src/routes/propertyListings.ts`
- `backend/src/services/PropertyListingSpreadsheetSync.ts`
- `backend/src/services/GoogleSheetsClient.ts`

## コミット番号
- **df31922e** - 環境変数名を`PROPERTY_LISTING_SPREADSHEET_ID`に変更、認証呼び出しを追加

## 環境変数設定
Vercelの`sateituikyaku-admin-backend`プロジェクトで以下の環境変数が設定されている必要があります:
- `PROPERTY_LISTING_SPREADSHEET_ID`: 物件リストスプレッドシートのID
- `GOOGLE_SERVICE_ACCOUNT_JSON`: Google Sheets API認証用のサービスアカウントJSON

## 教訓
1. 環境変数名はプロジェクト全体で統一する
2. 複数のスプレッドシートを使用する場合、明確に区別できる環境変数名を使用する
3. 環境変数が設定されていない場合、詳細なログを出力する
4. `GoogleSheetsClient`を使用する前に必ず`authenticate()`を呼び出す

---

**最終更新日**: 2026年4月8日
**作成理由**: 物件リストスプレッドシート同期の環境変数名不一致を修正した記録
