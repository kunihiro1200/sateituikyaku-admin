# 設計ドキュメント

## 概要

物件リスト報告ページ（`PropertyReportPage.tsx`）に「報告_メモ」フィールドを追加する機能の設計です。このフィールドは報告業務に関する補足情報を記録するためのデータベース専用フィールドで、スプレッドシート同期の対象外とします。

この機能により、担当者は報告日・報告完了・報告担当・SUUMO URLに加えて、自由形式のメモを記録できるようになります。

## アーキテクチャ

### システム構成

```
┌─────────────────────────────────────────────────────────────┐
│ フロントエンド（PropertyReportPage.tsx）                      │
│ - 報告_メモ入力フィールド（TextField multiline）              │
│ - 保存ボタン（変更検知でハイライト）                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP PUT /api/property-listings/:propertyNumber
                            │ { report_memo: "..." }
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ バックエンドAPI（propertyListings.ts）                        │
│ - PUT /:propertyNumber エンドポイント                         │
│ - リクエストボディから report_memo を受け取る                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ PropertyListingService.update()
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PropertyListingService                                       │
│ - update() メソッドで report_memo を含む更新を実行           │
│ - スプレッドシート同期は実行しない（除外設定）                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Supabase UPDATE
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Database（property_listings テーブル）              │
│ - report_memo カラム（TEXT型、NULL許可）                      │
└─────────────────────────────────────────────────────────────┘
```

### データフロー

#### 1. 読み込み時

```
ユーザーが報告ページを開く
  ↓
PropertyReportPage.fetchData()
  ↓
GET /api/property-listings/:propertyNumber
  ↓
PropertyListingService.getByPropertyNumber()
  ↓
Supabase SELECT（report_memo を含む）
  ↓
フロントエンドに返却
  ↓
report_memo をテキストフィールドに表示
```

#### 2. 保存時

```
ユーザーが報告_メモを入力して保存ボタンをクリック
  ↓
PropertyReportPage.handleSave()
  ↓
PUT /api/property-listings/:propertyNumber
  { report_memo: "入力されたメモ" }
  ↓
PropertyListingService.update()
  ↓
Supabase UPDATE property_listings
  SET report_memo = '入力されたメモ'
  WHERE property_number = 'AA10424'
  ↓
スプレッドシート同期はスキップ（除外設定）
  ↓
成功レスポンス
  ↓
「報告情報を保存しました」メッセージ表示
```

### スプレッドシート同期の除外

`report_memo` フィールドは以下の理由でスプレッドシート同期の対象外とします：

1. **データベース専用フィールド**: 報告ページでのみ使用される内部メモ
2. **スプレッドシートに対応カラムなし**: 物件リストスプレッドシートに該当カラムが存在しない
3. **同期の必要性なし**: スプレッドシートで編集する必要がない

除外方法：
- `property-listing-column-mapping.json` に `report_memo` のマッピングを追加しない
- `PropertyListingService.syncToSpreadsheet()` は自動的にマッピングがないフィールドをスキップする

## コンポーネントとインターフェース

### フロントエンド

#### PropertyReportPage.tsx

**変更箇所**:

1. **ReportData インターフェース**に `report_memo` を追加
   ```typescript
   interface ReportData {
     report_date?: string;
     report_completed?: string;
     report_assignee?: string;
     sales_assignee?: string;
     address?: string;
     owner_name?: string;
     owner_email?: string;
     suumo_url?: string;
     report_memo?: string;  // 追加
   }
   ```

2. **変更検知ロジック**に `report_memo` を追加
   ```typescript
   const hasChanges =
     reportData.report_date !== savedData.report_date ||
     reportData.report_completed !== savedData.report_completed ||
     reportData.report_assignee !== savedData.report_assignee ||
     reportData.suumo_url !== savedData.suumo_url ||
     reportData.report_memo !== savedData.report_memo;  // 追加
   ```

3. **fetchData()** で `report_memo` を取得
   ```typescript
   const initial: ReportData = {
     // ... 既存フィールド
     suumo_url: d.suumo_url || '',
     report_memo: d.report_memo || '',  // 追加
   };
   ```

4. **handleSave()** で `report_memo` を保存
   ```typescript
   await api.put(`/api/property-listings/${propertyNumber}`, {
     report_date: reportData.report_date || null,
     report_completed: reportData.report_completed || 'N',
     report_assignee: reportData.report_assignee || null,
     suumo_url: reportData.suumo_url || null,
     report_memo: reportData.report_memo || null,  // 追加
   });
   ```

5. **UIフィールド追加**（SUUMO URLの下）
   ```tsx
   {/* SUUMO URL */}
   <Box sx={{ mt: 3 }}>
     {/* ... 既存のSUUMO URLフィールド ... */}
   </Box>

   {/* 報告_メモ（新規追加） */}
   <Box sx={{ mt: 3 }}>
     <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>
       報告_メモ
     </Typography>
     <TextField
       fullWidth
       multiline
       minRows={3}
       maxRows={10}
       placeholder="報告に関するメモを入力..."
       value={reportData.report_memo || ''}
       onChange={(e) => setReportData((prev) => ({ ...prev, report_memo: e.target.value }))}
     />
   </Box>
   ```

### バックエンド

#### PropertyListingService.ts

**変更箇所**: なし

**理由**: 
- `update()` メソッドは `Record<string, any>` を受け取るため、`report_memo` を自動的に処理できる
- `syncToSpreadsheet()` は `column-mapping.json` にマッピングがないフィールドを自動的にスキップする

#### propertyListings.ts（ルート）

**変更箇所**: なし

**理由**: 
- `router.put('/:propertyNumber')` は `req.body` をそのまま `PropertyListingService.update()` に渡すため、`report_memo` を自動的に処理できる

## データモデル

### property_listings テーブル

**新規カラム**: `report_memo`

```sql
-- マイグレーション: 20260402_add_report_memo_to_property_listings.sql
ALTER TABLE property_listings
ADD COLUMN IF NOT EXISTS report_memo TEXT;

COMMENT ON COLUMN property_listings.report_memo IS '報告メモ（報告ページ専用、スプレッドシート同期対象外）';
```

**カラム仕様**:
- **型**: TEXT
- **NULL許可**: YES
- **デフォルト値**: NULL
- **インデックス**: 不要（検索対象外）
- **スプレッドシート同期**: 対象外

**既存の報告関連カラム**:
- `report_date` (DATE) - 報告日
- `report_completed` (TEXT) - 報告完了（Y/N）
- `report_assignee` (TEXT) - 報告担当（イニシャル）
- `suumo_url` (TEXT) - SUUMO URL
- `report_memo` (TEXT) - 報告メモ（新規）

### データベーススキーマ図

```
property_listings
├── id (UUID, PK)
├── property_number (TEXT, UNIQUE)
├── ...（他の物件情報）
├── report_date (DATE)
├── report_completed (TEXT)
├── report_assignee (TEXT)
├── suumo_url (TEXT)
├── report_memo (TEXT) ← 新規追加
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

## Correctness Properties

*プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いのことです。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しとなります。*

### Property 1: 報告メモのラウンドトリップ

*任意の* 物件番号と任意のメモテキストに対して、report_memo をデータベースに保存してから取得した場合、保存した値と同じ値が返されるべきである

**Validates: Requirements 2.7, 3.1, 5.1, 5.2, 5.3**

### Property 2: 複数フィールドの同時保存

*任意の* 物件番号に対して、report_date、report_completed、report_assignee、suumo_url、report_memo を同時に更新した場合、全てのフィールドがデータベースに正しく保存されるべきである

**Validates: Requirements 3.2**

### Property 3: スプレッドシート同期の除外

*任意の* 物件番号に対して、report_memo を更新した場合、スプレッドシートの該当行には report_memo が書き込まれないべきである

**Validates: Requirements 4.1, 4.3, 4.5**

### Property 4: スプレッドシート同期後の保持

*任意の* 物件番号に対して、report_memo をデータベースに保存してからスプレッドシート→データベース同期を実行した場合、report_memo の値が変更されずに保持されるべきである

**Validates: Requirements 4.4**

### Property 5: 最大長制限なし

*任意の* 長いテキスト（10,000文字以上）に対して、report_memo として保存した場合、エラーなく保存され、取得時に完全なテキストが返されるべきである

**Validates: Requirements 5.5**

## エラーハンドリング

### データベースエラー

**シナリオ1: マイグレーション未実行**
- **エラー**: `column "report_memo" does not exist`
- **対応**: マイグレーションを実行する
- **ユーザーへの表示**: 「保存に失敗しました」（一般的なエラーメッセージ）

**シナリオ2: データベース接続エラー**
- **エラー**: Supabase接続失敗
- **対応**: 自動リトライ（既存のエラーハンドリング）
- **ユーザーへの表示**: 「保存に失敗しました」

### API エラー

**シナリオ3: 物件が存在しない**
- **エラー**: `Property listing not found`
- **HTTPステータス**: 404
- **対応**: エラーメッセージを表示
- **ユーザーへの表示**: 「物件データの取得に失敗しました」

**シナリオ4: 不正なリクエスト**
- **エラー**: バリデーションエラー
- **HTTPステータス**: 400
- **対応**: エラーメッセージを表示
- **ユーザーへの表示**: 「保存に失敗しました」

### フロントエンドエラー

**シナリオ5: ネットワークエラー**
- **エラー**: ネットワーク接続失敗
- **対応**: エラーメッセージを表示
- **ユーザーへの表示**: 「保存に失敗しました」

**シナリオ6: NULL値の扱い**
- **動作**: report_memo が NULL の場合、空文字列として表示
- **保存時**: 空文字列は NULL として保存
- **エラーなし**: NULL値は正常な状態として扱う

## テスト戦略

### ユニットテスト

ユニットテストは特定の例とエッジケースに焦点を当てます：

**データベーススキーマテスト**:
- report_memo カラムが存在することを確認（要件1.1）
- report_memo カラムの型がTEXTであることを確認（要件1.2）
- report_memo カラムがNULL許可であることを確認（要件1.3）
- report_memo カラムのデフォルト値がNULLであることを確認（要件1.4）
- 既存レコードの report_memo がNULLであることを確認（要件6.1）

**エッジケーステスト**:
- report_memo が NULL の場合、空のテキストフィールドが表示される（要件2.8, 6.2）
- report_memo が NULL の場合、APIが正常に返す（要件6.3）
- report_memo が空文字列の場合、NULLとして保存される（要件5.4）

**統合テスト**:
- column-mapping.json に report_memo のマッピングが存在しないことを確認（要件4.2）

### プロパティベーステスト

プロパティベーステストは全ての入力に対して成り立つべき普遍的な性質を検証します：

**設定**:
- 最小実行回数: 100回（ランダム化のため）
- 使用ライブラリ: fast-check（TypeScript/JavaScript用）

**Property 1: 報告メモのラウンドトリップ**
```typescript
// Feature: property-listing-report-memo, Property 1: 報告メモのラウンドトリップ
fc.assert(
  fc.asyncProperty(
    fc.string({ minLength: 0, maxLength: 1000 }), // ランダムなメモテキスト
    async (memoText) => {
      const propertyNumber = 'TEST_PROPERTY_001';
      
      // 保存
      await api.put(`/api/property-listings/${propertyNumber}`, {
        report_memo: memoText || null,
      });
      
      // 取得
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      
      // 検証: 保存した値と取得した値が一致する
      const expected = memoText || null;
      expect(response.data.report_memo).toBe(expected);
    }
  ),
  { numRuns: 100 }
);
```

**Property 2: 複数フィールドの同時保存**
```typescript
// Feature: property-listing-report-memo, Property 2: 複数フィールドの同時保存
fc.assert(
  fc.asyncProperty(
    fc.record({
      report_date: fc.date().map(d => d.toISOString().split('T')[0]),
      report_completed: fc.constantFrom('Y', 'N'),
      report_assignee: fc.string({ minLength: 1, maxLength: 10 }),
      suumo_url: fc.webUrl(),
      report_memo: fc.string({ minLength: 0, maxLength: 500 }),
    }),
    async (reportData) => {
      const propertyNumber = 'TEST_PROPERTY_002';
      
      // 全フィールドを同時に保存
      await api.put(`/api/property-listings/${propertyNumber}`, reportData);
      
      // 取得
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      
      // 検証: 全フィールドが正しく保存されている
      expect(response.data.report_date).toBe(reportData.report_date);
      expect(response.data.report_completed).toBe(reportData.report_completed);
      expect(response.data.report_assignee).toBe(reportData.report_assignee);
      expect(response.data.suumo_url).toBe(reportData.suumo_url);
      expect(response.data.report_memo).toBe(reportData.report_memo || null);
    }
  ),
  { numRuns: 100 }
);
```

**Property 3: スプレッドシート同期の除外**
```typescript
// Feature: property-listing-report-memo, Property 3: スプレッドシート同期の除外
fc.assert(
  fc.asyncProperty(
    fc.string({ minLength: 1, maxLength: 500 }),
    async (memoText) => {
      const propertyNumber = 'TEST_PROPERTY_003';
      
      // report_memo を保存
      await api.put(`/api/property-listings/${propertyNumber}`, {
        report_memo: memoText,
      });
      
      // スプレッドシートの該当行を取得
      const sheetRow = await getSpreadsheetRow(propertyNumber);
      
      // 検証: スプレッドシートに report_memo が存在しない
      // （column-mapping.json にマッピングがないため、どのカラムにも書き込まれない）
      const allValues = Object.values(sheetRow);
      expect(allValues).not.toContain(memoText);
    }
  ),
  { numRuns: 100 }
);
```

**Property 4: スプレッドシート同期後の保持**
```typescript
// Feature: property-listing-report-memo, Property 4: スプレッドシート同期後の保持
fc.assert(
  fc.asyncProperty(
    fc.string({ minLength: 1, maxLength: 500 }),
    async (memoText) => {
      const propertyNumber = 'TEST_PROPERTY_004';
      
      // report_memo を保存
      await api.put(`/api/property-listings/${propertyNumber}`, {
        report_memo: memoText,
      });
      
      // スプレッドシート→データベース同期を実行
      await triggerSpreadsheetToDbSync(propertyNumber);
      
      // 再取得
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      
      // 検証: report_memo の値が変更されていない
      expect(response.data.report_memo).toBe(memoText);
    }
  ),
  { numRuns: 100 }
);
```

**Property 5: 最大長制限なし**
```typescript
// Feature: property-listing-report-memo, Property 5: 最大長制限なし
fc.assert(
  fc.asyncProperty(
    fc.string({ minLength: 10000, maxLength: 20000 }), // 長いテキスト
    async (longText) => {
      const propertyNumber = 'TEST_PROPERTY_005';
      
      // 長いテキストを保存
      await api.put(`/api/property-listings/${propertyNumber}`, {
        report_memo: longText,
      });
      
      // 取得
      const response = await api.get(`/api/property-listings/${propertyNumber}`);
      
      // 検証: 完全なテキストが返される
      expect(response.data.report_memo).toBe(longText);
      expect(response.data.report_memo.length).toBe(longText.length);
    }
  ),
  { numRuns: 100 }
);
```

### テスト実装の注意事項

**fast-checkの設定**:
- インストール: `npm install --save-dev fast-check @types/fast-check`
- テストフレームワーク: Jest（既存）
- 最小実行回数: 100回

**テストデータのクリーンアップ**:
- テスト用物件（TEST_PROPERTY_001-005）は各テストの前後でクリーンアップする
- `beforeEach` でテストデータを初期化
- `afterEach` でテストデータを削除

**スプレッドシート同期のモック**:
- Property 3, 4 ではスプレッドシート同期をモックまたは実際に実行する
- 実際のスプレッドシートを使用する場合、テスト専用シートを用意する

### テストカバレッジ目標

- ユニットテスト: 90%以上
- プロパティベーステスト: 全5プロパティを実装
- 統合テスト: 既存機能への影響がないことを確認

## エラーハンドリング

