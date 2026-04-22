# 設計書: business-detail-spreadsheet-link

## 概要

`WorkTaskDetailModal` のヘッダーに「スプシ」ボタンを追加する。
タブインデックスが2（契約決済）または3（売主、買主詳細）のときのみ表示し、
クリックすると `spreadsheet_url` の台帳シート（gid=78322744）を新しいタブで開く。

フロントエンドのみの変更（バックエンド・DB変更なし）。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/components/WorkTaskDetailModal.tsx` | スプシボタンの追加 |
| `frontend/frontend/src/utils/spreadsheetUrl.ts` | URL生成ユーティリティ関数（新規作成） |

### 変更しないもの

- バックエンド（`backend/`）
- データベーススキーマ
- `WorkTaskData` インターフェース（`spreadsheet_url` は既存フィールド）

---

## コンポーネントとインターフェース

### ユーティリティ関数: `buildLedgerSheetUrl`

```typescript
// frontend/frontend/src/utils/spreadsheetUrl.ts

/** 台帳シートのgid（全案件共通の固定値） */
export const LEDGER_SHEET_GID = '78322744';

/**
 * spreadsheet_url から台帳シートへの遷移URLを生成する。
 *
 * 処理手順:
 * 1. ?gid=... クエリパラメータを除去
 * 2. #gid=... ハッシュを除去
 * 3. /edit で終わるベースURLを確保
 * 4. #gid=78322744 を付加
 *
 * @param spreadsheetUrl - work_tasks.spreadsheet_url の値
 * @returns 台帳シートへの遷移URL。解析不能な場合は元のURLをそのまま返す。
 */
export function buildLedgerSheetUrl(spreadsheetUrl: string): string {
  try {
    // ハッシュを除去してからURLオブジェクトを生成
    const withoutHash = spreadsheetUrl.split('#')[0];
    const url = new URL(withoutHash);

    // ?gid= クエリパラメータを除去
    url.searchParams.delete('gid');

    // パスが /edit で終わるように正規化
    let basePath = url.pathname;
    if (!basePath.endsWith('/edit')) {
      // /edit/xxx のような余分なパスを除去
      const editIndex = basePath.indexOf('/edit');
      if (editIndex !== -1) {
        basePath = basePath.substring(0, editIndex + 5); // '/edit' まで
      }
    }

    return `${url.origin}${basePath}${url.search}#gid=${LEDGER_SHEET_GID}`;
  } catch {
    // URL解析失敗時はそのまま返す（要件4.5）
    return spreadsheetUrl;
  }
}
```

### スプシボタンコンポーネント（インライン実装）

`WorkTaskDetailModal` の `DialogTitle` 内ヘッダー行に追加する。

```tsx
{/* スプシボタン: タブ2（契約決済）またはタブ3（売主、買主詳細）のときのみ表示 */}
{(tabIndex === 2 || tabIndex === 3) && (
  <Button
    variant="outlined"
    size="small"
    disabled={!getValue('spreadsheet_url')}
    onClick={() => {
      const url = getValue('spreadsheet_url');
      if (url) {
        window.open(buildLedgerSheetUrl(url), '_blank', 'noopener,noreferrer');
      }
    }}
    sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
  >
    スプシ
  </Button>
)}
```

---

## データモデル

既存の `WorkTaskData` インターフェースの `spreadsheet_url: string` フィールドを使用する。
スキーマ変更なし。

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: タブインデックスによるボタン表示制御

*For any* タブインデックス値に対して、スプシボタンの表示状態は `(tabIndex === 2 || tabIndex === 3)` と等しくなければならない。

**Validates: Requirements 1.1, 1.2**

### Property 2: spreadsheet_url の有無によるボタン活性制御

*For any* `spreadsheet_url` の値に対して、ボタンの disabled 状態は `!spreadsheet_url` と等しくなければならない（null・空文字のとき disabled=true、有効な文字列のとき disabled=false）。

**Validates: Requirements 2.1, 2.2**

### Property 3: URL生成の冪等性（gid付加の一意性）

*For any* 有効な Google スプレッドシート URL（`#gid=` あり・なし・`?gid=` あり・なし の任意の組み合わせ）に対して、`buildLedgerSheetUrl` を適用した結果は常に `#gid=78322744` で終わり、かつ `#gid=` が1つだけ含まれる。

**Validates: Requirements 3.2, 3.3, 4.1, 4.2, 4.3, 4.4**

### Property 4: URL生成の冪等性（二重適用）

*For any* 有効な Google スプレッドシート URL に対して、`buildLedgerSheetUrl` を2回適用した結果は1回適用した結果と等しい（冪等性）。

**Validates: Requirements 3.2, 3.3**

---

## エラーハンドリング

| ケース | 対応 |
|-------|------|
| `spreadsheet_url` が null / 空文字 | ボタンを disabled 表示。クリック不可。 |
| `spreadsheet_url` が Google スプレッドシート以外のURL | `buildLedgerSheetUrl` が元のURLをそのまま返す。新しいタブで開く。 |
| `spreadsheet_url` が URL として解析不能な文字列 | `buildLedgerSheetUrl` の try-catch で元の文字列をそのまま返す。 |
| `window.open` がブロックされた場合 | ブラウザのポップアップブロック通知に委ねる（追加対応なし）。 |

---

## テスト戦略

### ユニットテスト（`buildLedgerSheetUrl`）

`buildLedgerSheetUrl` はピュア関数なので、ユニットテストで網羅的に検証する。

**例示テスト（具体的なケース）**:

| 入力 | 期待出力 |
|-----|---------|
| `https://docs.google.com/spreadsheets/d/ABC/edit` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744` |
| `https://docs.google.com/spreadsheets/d/ABC/edit#gid=99999` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744` |
| `https://docs.google.com/spreadsheets/d/ABC/edit?gid=99999#gid=99999` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744` |
| `not-a-url` | `not-a-url`（フォールバック） |

**プロパティテスト（fast-check を使用）**:

Property 3 と Property 4 を fast-check でテストする。

```typescript
// fast-check を使用（最低100回実行）
// Feature: business-detail-spreadsheet-link, Property 3: URL生成の冪等性（gid付加の一意性）
fc.assert(
  fc.property(
    validSpreadsheetUrlArbitrary, // 任意の有効なスプレッドシートURL
    (url) => {
      const result = buildLedgerSheetUrl(url);
      const gidCount = (result.match(/#gid=/g) || []).length;
      return result.endsWith(`#gid=${LEDGER_SHEET_GID}`) && gidCount === 1;
    }
  ),
  { numRuns: 100 }
);

// Feature: business-detail-spreadsheet-link, Property 4: URL生成の冪等性（二重適用）
fc.assert(
  fc.property(
    validSpreadsheetUrlArbitrary,
    (url) => {
      const once = buildLedgerSheetUrl(url);
      const twice = buildLedgerSheetUrl(once);
      return once === twice;
    }
  ),
  { numRuns: 100 }
);
```

`validSpreadsheetUrlArbitrary` は以下のパターンを生成する:
- `https://docs.google.com/spreadsheets/d/{ID}/edit`
- `https://docs.google.com/spreadsheets/d/{ID}/edit#gid={任意のgid}`
- `https://docs.google.com/spreadsheets/d/{ID}/edit?gid={任意のgid}#gid={任意のgid}`

### コンポーネントテスト

Property 1・2 は React Testing Library でテストする。

```typescript
// Feature: business-detail-spreadsheet-link, Property 1: タブインデックスによるボタン表示制御
// tabIndex 0,1 → ボタン非表示、tabIndex 2,3 → ボタン表示
// Feature: business-detail-spreadsheet-link, Property 2: spreadsheet_url の有無によるボタン活性制御
// spreadsheet_url あり → enabled、なし → disabled
```

### 手動確認

- ヘッダーの同一行配置（要件1.3）
- 新しいタブで開くこと（要件3.1）
- 実際のスプレッドシートURLで台帳シートに遷移すること
