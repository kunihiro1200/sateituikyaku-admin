# デザインドキュメント：買主番号スプレッドシート採番

## Overview

本機能は、買主リスト新規作成時の買主番号採番ロジックを変更する。
現在の実装（DBの `buyers` テーブルの最大値+1）を廃止し、Googleスプレッドシートの `連番` シート B2 セルの値を参照して採番するように変更する。

これにより、スプレッドシート側で管理している連番とDBの買主番号の整合性が保たれる。

### 変更対象

- `backend/src/services/BuyerService.ts` の `generateBuyerNumber()` メソッド
- 設定値は環境変数で外部化する

### 変更しない対象

- `GET /api/buyers/next-buyer-number` エンドポイント（インターフェースは変更なし）
- `POST /api/buyers` エンドポイント（インターフェースは変更なし）
- フロントエンド（`NewBuyerPage.tsx`）

---

## Architecture

### 現在のアーキテクチャ

```
POST /api/buyers
  └─ BuyerService.create()
       └─ BuyerService.generateBuyerNumber()
            └─ Supabase: SELECT MAX(buyer_number) FROM buyers
```

### 変更後のアーキテクチャ

```
POST /api/buyers
  └─ BuyerService.create()
       └─ BuyerService.generateBuyerNumber()
            └─ BuyerNumberSpreadsheetClient.getNextBuyerNumber()
                 └─ GoogleSheetsClient.readRange("B2")
                      └─ Google Sheets API: 採番スプレッドシート / 連番シート / B2セル
```

### 採番スプレッドシートの設定

| 項目 | 値 | 環境変数 |
|------|-----|---------|
| スプレッドシートID | `19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs` | `BUYER_NUMBER_SPREADSHEET_ID` |
| シート名 | `連番` | `BUYER_NUMBER_SHEET_NAME`（デフォルト: `連番`） |
| 参照セル | `B2` | `BUYER_NUMBER_CELL`（デフォルト: `B2`） |

### 採番ロジック

```
次の買主番号 = parseInt(B2セルの値) + 1
```

---

## Components and Interfaces

### 新規コンポーネント：BuyerNumberSpreadsheetClient

**ファイル**: `backend/src/services/BuyerNumberSpreadsheetClient.ts`

**責務**: 採番スプレッドシートへのアクセスをカプセル化し、次の買主番号を返す。

```typescript
export class BuyerNumberSpreadsheetClient {
  private sheetsClient: GoogleSheetsClient;
  private cell: string;

  constructor(sheetsClient: GoogleSheetsClient, cell: string) { ... }

  /**
   * 採番スプレッドシートから次の買主番号を取得する
   * B2セルの値 + 1 を返す
   * @throws Error スプレッドシートアクセス失敗時
   * @throws Error セルの値が数値でない場合
   * @throws Error セルの値が空欄の場合
   */
  async getNextBuyerNumber(): Promise<string> { ... }
}
```

### 変更コンポーネント：BuyerService.generateBuyerNumber()

**変更前**:
```typescript
private async generateBuyerNumber(): Promise<string> {
  // DBの最大値+1
  const { data } = await this.supabase
    .from('buyers')
    .select('buyer_number')
    .order('buyer_number', { ascending: false })
    .limit(1);
  ...
}
```

**変更後**:
```typescript
private async generateBuyerNumber(): Promise<string> {
  // スプレッドシートのB2セル+1
  const client = await this.initBuyerNumberClient();
  return client.getNextBuyerNumber();
}
```

### 既存コンポーネント：GoogleSheetsClient（変更なし）

`readRange(range: string)` メソッドを使用して B2 セルの値を取得する。

```typescript
// 使用例
const rows = await sheetsClient.readRange('B2');
// rows[0] は B2 セルの値を含む SheetRow オブジェクト
```

---

## Data Models

### 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `BUYER_NUMBER_SPREADSHEET_ID` | ✅ 必須 | なし | 採番スプレッドシートのID |
| `BUYER_NUMBER_SHEET_NAME` | 任意 | `連番` | 採番シート名 |
| `BUYER_NUMBER_CELL` | 任意 | `B2` | 参照セルのアドレス |

### GoogleSheetsClient の設定オブジェクト（採番用）

```typescript
const config: GoogleSheetsConfig = {
  spreadsheetId: process.env.BUYER_NUMBER_SPREADSHEET_ID!,
  sheetName: process.env.BUYER_NUMBER_SHEET_NAME || '連番',
  serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
};
```

既存の `initSyncServices()` で使用しているサービスアカウント認証情報を再利用する。

### セル値の型変換

```
B2セルの生の値（文字列）→ parseInt() → 数値 → +1 → String() → 買主番号（文字列）
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: B2セルの値+1が次の買主番号になる

*For any* 整数値 n（n >= 0）がスプレッドシートの B2 セルに格納されている場合、`getNextBuyerNumber()` は文字列 `String(n + 1)` を返す。

**Validates: Requirements 1.2**

### Property 2: 数値でない入力値はエラーをスローする

*For any* 数値として解釈できない文字列（空文字列、アルファベット、記号、空白のみの文字列を含む）が B2 セルに格納されている場合、`getNextBuyerNumber()` はエラーをスローする。

**Validates: Requirements 2.2, 2.3**

---

## Error Handling

### エラーケース一覧

| エラー条件 | エラーメッセージ | 動作 |
|-----------|---------------|------|
| `BUYER_NUMBER_SPREADSHEET_ID` 未設定 | `BUYER_NUMBER_SPREADSHEET_ID is not set` | 初期化時またはアクセス時にエラーをスロー |
| スプレッドシートへのアクセス失敗 | `Failed to access buyer number spreadsheet: <詳細>` | エラーをスロー、買主作成を中断 |
| B2 セルの値が空欄 | `Buyer number cell B2 is empty` | エラーをスロー、買主作成を中断 |
| B2 セルの値が数値でない | `Buyer number cell value is not a valid number: <値>` | エラーをスロー、買主作成を中断 |

### エラーログ

全てのエラーは `console.error` でログ出力する。

```typescript
// 例
console.error('[BuyerNumberSpreadsheetClient] Failed to get next buyer number:', error);
```

### エラー伝播

`BuyerNumberSpreadsheetClient.getNextBuyerNumber()` がスローしたエラーは、`BuyerService.generateBuyerNumber()` を経由して `BuyerService.create()` まで伝播し、最終的に `POST /api/buyers` エンドポイントが 500 エラーを返す。

---

## Testing Strategy

### デュアルテストアプローチ

本機能のテストは**ユニットテスト**と**プロパティベーステスト**の両方で実施する。

#### ユニットテスト（具体的な例・エッジケース・統合確認）

**ファイル**: `backend/src/services/__tests__/BuyerNumberSpreadsheetClient.test.ts`

テスト対象:
- B2 セルの値が `"4370"` の場合、`"4371"` を返すこと
- B2 セルの値が `"0"` の場合、`"1"` を返すこと（エッジケース）
- B2 セルの値が空文字列の場合、エラーをスローすること（エッジケース: 要件 2.3）
- B2 セルの値が `"abc"` の場合、エラーをスローすること
- スプレッドシートへのアクセスが失敗した場合、エラーをスローすること（要件 2.1）
- `BUYER_NUMBER_SPREADSHEET_ID` が未設定の場合、エラーをスローすること（要件 3.4）
- 環境変数 `BUYER_NUMBER_SHEET_NAME` が設定されている場合、その値が使われること（要件 3.2）
- 環境変数 `BUYER_NUMBER_SHEET_NAME` が未設定の場合、デフォルト値 `連番` が使われること（要件 3.2）
- 環境変数 `BUYER_NUMBER_CELL` が設定されている場合、その値が使われること（要件 3.3）
- 環境変数 `BUYER_NUMBER_CELL` が未設定の場合、デフォルト値 `B2` が使われること（要件 3.3）

#### プロパティベーステスト（普遍的なプロパティの検証）

**ファイル**: `backend/src/services/__tests__/BuyerNumberSpreadsheetClient.property.test.ts`

**使用ライブラリ**: `fast-check`（TypeScript/JavaScript 向けプロパティベーステストライブラリ）

**最小実行回数**: 各プロパティにつき 100 回以上

```typescript
// プロパティテストの設定例
fc.assert(
  fc.property(fc.integer({ min: 0, max: 99999 }), async (n) => {
    // B2セルの値がnの場合、n+1が返ること
    mockSheetsClient.readRange.mockResolvedValue([{ /* B2 = String(n) */ }]);
    const result = await client.getNextBuyerNumber();
    return result === String(n + 1);
  }),
  { numRuns: 100 }
);
```

**プロパティテスト一覧**:

| タグ | プロパティ |
|------|-----------|
| `Feature: buyer-number-spreadsheet-generation, Property 1: B2セルの値+1が次の買主番号になる` | 任意の非負整数 n に対して、B2=n のとき結果は String(n+1) |
| `Feature: buyer-number-spreadsheet-generation, Property 2: 数値でない入力値はエラーをスローする` | 数値として解釈できない任意の文字列に対してエラーがスローされる |

### テスト実行方法

```bash
# ユニットテスト
cd backend && npx jest BuyerNumberSpreadsheetClient --run

# プロパティベーステスト
cd backend && npx jest BuyerNumberSpreadsheetClient.property --run
```
