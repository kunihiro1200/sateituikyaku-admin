# 設計書: business-detail-tab-spreadsheet-link

## 概要

`WorkTaskDetailModal` の「媒介契約」タブ（tabIndex=0）および「サイト登録」タブ（tabIndex=1）のヘッダーに「スプシ」ボタンを追加する。

- tabIndex=0 → 「媒介依頼」シート（gid=1819926492）を新しいタブで開く
- tabIndex=1 → 「athome」シート（gid=1725934947）を新しいタブで開く

既存の tabIndex=2・3 のスプシボタン（台帳シート gid=78322744）と同じスタイル・パターンで実装する。
フロントエンドのみの変更（バックエンド・DB変更なし）。

---

## アーキテクチャ

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/utils/spreadsheetUrl.ts` | 汎用関数 `buildSheetUrl` と新定数を追加 |
| `frontend/frontend/src/components/WorkTaskDetailModal.tsx` | tabIndex=0・1 のスプシボタン表示条件を追加 |

### 変更しないもの

- バックエンド（`backend/`）
- データベーススキーマ
- `WorkTaskData` インターフェース（`spreadsheet_url` は既存フィールド）
- 既存の `buildLedgerSheetUrl` 関数の外部インターフェース

---

## コンポーネントとインターフェース

### `spreadsheetUrl.ts` への追加

既存の `buildLedgerSheetUrl` と同じURL正規化ロジックを持つ汎用関数 `buildSheetUrl` を追加する。
`buildLedgerSheetUrl` はこの汎用関数を呼び出す形にリファクタリングする。

```typescript
// frontend/frontend/src/utils/spreadsheetUrl.ts

/** 台帳シートのgid（全案件共通の固定値） */
export const LEDGER_SHEET_GID = '78322744';

/** 媒介依頼シートのgid */
export const MEDIATION_REQUEST_SHEET_GID = '1819926492';

/** athomeシートのgid */
export const ATHOME_SHEET_GID = '1725934947';

/**
 * spreadsheet_url から指定したgidのシートへの遷移URLを生成する汎用関数。
 *
 * 処理手順:
 * 1. #gid=... ハッシュを除去してURLオブジェクトを生成
 * 2. ?gid=... クエリパラメータを除去
 * 3. /edit で終わるベースURLを確保
 * 4. #gid={gid} を付加
 *
 * @param spreadsheetUrl - work_tasks.spreadsheet_url の値
 * @param gid - 遷移先シートのgid
 * @returns 指定シートへの遷移URL。解析不能な場合は元のURLをそのまま返す。
 */
export function buildSheetUrl(spreadsheetUrl: string, gid: string): string {
  try {
    const withoutHash = spreadsheetUrl.split('#')[0];
    const url = new URL(withoutHash);
    url.searchParams.delete('gid');
    let basePath = url.pathname;
    if (!basePath.endsWith('/edit')) {
      const editIndex = basePath.indexOf('/edit');
      if (editIndex !== -1) {
        basePath = basePath.substring(0, editIndex + 5);
      }
    }
    const search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
    return `${url.origin}${basePath}${search}#gid=${gid}`;
  } catch {
    return spreadsheetUrl;
  }
}

/**
 * spreadsheet_url から台帳シートへの遷移URLを生成する。
 * buildSheetUrl の LEDGER_SHEET_GID 固定版。
 */
export function buildLedgerSheetUrl(spreadsheetUrl: string): string {
  return buildSheetUrl(spreadsheetUrl, LEDGER_SHEET_GID);
}
```

### `WorkTaskDetailModal.tsx` の変更

tabIndex=0・1 のときもスプシボタンを表示するよう条件を拡張する。
tabIndex に応じて適切な gid を選択する。

```tsx
{/* スプシボタン: tabIndex=0（媒介契約）または tabIndex=1（サイト登録）のとき */}
{(tabIndex === 0 || tabIndex === 1) && (
  <Button
    variant="outlined"
    size="small"
    disabled={!getValue('spreadsheet_url')}
    onClick={() => {
      const url = getValue('spreadsheet_url');
      if (url) {
        const gid = tabIndex === 0 ? MEDIATION_REQUEST_SHEET_GID : ATHOME_SHEET_GID;
        window.open(buildSheetUrl(url, gid), '_blank', 'noopener,noreferrer');
      }
    }}
    sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}
  >
    スプシ
  </Button>
)}

{/* 既存: スプシボタン: tabIndex=2（契約決済）または tabIndex=3（売主、買主詳細）のとき */}
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

### Property 1: tabIndex=0・1 のときスプシボタンが表示される

*For any* tabIndex 値（0〜3）に対して、スプシボタン（tabIndex=0・1 用）の表示状態は `(tabIndex === 0 || tabIndex === 1)` と等しくなければならない。

**Validates: Requirements 1.1, 2.1**

### Property 2: spreadsheet_url の有無によるdisabled制御

*For any* `spreadsheet_url` の値に対して、スプシボタンの disabled 状態は `!spreadsheet_url` と等しくなければならない（null・空文字のとき disabled=true、非空文字列のとき disabled=false）。

**Validates: Requirements 3.1, 3.2**

### Property 3: tabIndexに応じた正しいgidのURL生成

*For any* 有効なスプレッドシートURL に対して、tabIndex=0 のとき生成されるURLは `#gid=1819926492` で終わり、tabIndex=1 のとき生成されるURLは `#gid=1725934947` で終わらなければならない。

**Validates: Requirements 1.3, 2.3, 4.1**

### Property 4: URL生成の冪等性（二重適用）

*For any* 有効なGoogleスプレッドシートURL（`#gid=` あり・なし・`?gid=` あり・なし の任意の組み合わせ）と任意のgid文字列に対して、`buildSheetUrl(url, gid)` を2回適用した結果は1回適用した結果と等しい（冪等性）。

**Validates: Requirements 4.2, 4.3, 4.4**

---

## エラーハンドリング

| ケース | 対応 |
|-------|------|
| `spreadsheet_url` が null / 空文字 | ボタンを disabled 表示。クリック不可。 |
| `spreadsheet_url` が URL として解析不能な文字列 | `buildSheetUrl` の try-catch で元の文字列をそのまま返す。 |
| `spreadsheet_url` が Google スプレッドシート以外のURL | `buildSheetUrl` が元のURLをそのまま返す。新しいタブで開く。 |
| `window.open` がブロックされた場合 | ブラウザのポップアップブロック通知に委ねる（追加対応なし）。 |

---

## テスト戦略

### ユニットテスト（`buildSheetUrl`）

`buildSheetUrl` はピュア関数なので、ユニットテストで網羅的に検証する。

**例示テスト（具体的なケース）**:

| 入力URL | gid | 期待出力 |
|--------|-----|---------|
| `https://docs.google.com/spreadsheets/d/ABC/edit` | `1819926492` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=1819926492` |
| `https://docs.google.com/spreadsheets/d/ABC/edit#gid=99999` | `1819926492` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=1819926492` |
| `https://docs.google.com/spreadsheets/d/ABC/edit?gid=99999` | `1725934947` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=1725934947` |
| `not-a-url` | `1819926492` | `not-a-url`（フォールバック） |
| `https://docs.google.com/spreadsheets/d/ABC/edit` | `78322744` | `https://docs.google.com/spreadsheets/d/ABC/edit#gid=78322744`（既存互換） |

**プロパティテスト（fast-check を使用）**:

Property 3・4 を fast-check でテストする。

```typescript
// fast-check を使用（最低100回実行）

// Feature: business-detail-tab-spreadsheet-link, Property 3: tabIndexに応じた正しいgidのURL生成
fc.assert(
  fc.property(
    validSpreadsheetUrlArbitrary,
    (url) => {
      const result0 = buildSheetUrl(url, MEDIATION_REQUEST_SHEET_GID);
      const result1 = buildSheetUrl(url, ATHOME_SHEET_GID);
      return (
        result0.endsWith(`#gid=${MEDIATION_REQUEST_SHEET_GID}`) &&
        result1.endsWith(`#gid=${ATHOME_SHEET_GID}`)
      );
    }
  ),
  { numRuns: 100 }
);

// Feature: business-detail-tab-spreadsheet-link, Property 4: URL生成の冪等性（二重適用）
fc.assert(
  fc.property(
    validSpreadsheetUrlArbitrary,
    fc.constantFrom(MEDIATION_REQUEST_SHEET_GID, ATHOME_SHEET_GID, LEDGER_SHEET_GID),
    (url, gid) => {
      const once = buildSheetUrl(url, gid);
      const twice = buildSheetUrl(once, gid);
      return once === twice;
    }
  ),
  { numRuns: 100 }
);
```

`validSpreadsheetUrlArbitrary` は以下のパターンを生成する:
- `https://docs.google.com/spreadsheets/d/{ID}/edit`
- `https://docs.google.com/spreadsheets/d/{ID}/edit#gid={任意のgid}`
- `https://docs.google.com/spreadsheets/d/{ID}/edit?gid={任意のgid}`
- `https://docs.google.com/spreadsheets/d/{ID}/edit?gid={任意のgid}#gid={任意のgid}`

### コンポーネントテスト

Property 1・2 は React Testing Library でテストする。

```typescript
// Feature: business-detail-tab-spreadsheet-link, Property 1: tabIndex=0・1のときスプシボタンが表示される
// tabIndex=0,1 → ボタン表示、tabIndex=2,3 → 既存ボタン（別条件）
// Feature: business-detail-tab-spreadsheet-link, Property 2: spreadsheet_urlの有無によるdisabled制御
// spreadsheet_url あり → enabled、null/空文字 → disabled
```

### 手動確認

- ヘッダーの同一行配置（要件5.2）
- 新しいタブで開くこと（要件1.2、2.2）
- 実際のスプレッドシートURLで各シートに正しく遷移すること
