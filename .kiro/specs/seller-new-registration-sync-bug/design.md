# 売主新規登録スプレッドシート同期バグ 設計ドキュメント

## Overview

売主新規登録時（`NewSellerPage.tsx`）に入力したフィールドの一部が、スプレッドシートに同期されない問題を修正する。

`backend/src/services/SellerService.supabase.ts` の `createSeller` メソッド内の `appendRow` 呼び出しで渡しているオブジェクトに、次電日・訪問日・営業担当・確度・状況（当社）・コメント・査定情報・追客情報など多数のフィールドが含まれていない。

`appendRow` は `GoogleSheetsClient.objectToRow` を通じてスプレッドシートのヘッダー名をキーとしてマッピングするため、渡されなかったフィールドは空文字列になる。

修正方針は最小限：`appendRow` に渡すオブジェクトに欠落フィールドを追加するだけでよい。

---

## Glossary

- **Bug_Condition (C)**: `appendRow` に含まれないフィールドが1つ以上入力されている `CreateSellerRequest` の状態
- **Property (P)**: `appendRow` 呼び出し後、スプレッドシートの該当列に入力値が書き込まれること
- **Preservation**: 既存の同期済みフィールド（売主番号・名前・住所・電話番号・メール・物件所在地・反響日付・サイト）が引き続き正しく同期されること
- **createSeller**: `backend/src/services/SellerService.supabase.ts` の `createSeller` メソッド。売主をDBに保存し、スプレッドシートに行を追加する
- **appendRow**: `GoogleSheetsClient` のメソッド。スプレッドシートのヘッダー名をキーとするオブジェクトを受け取り、最終行に追加する
- **objectToRow**: `GoogleSheetsClient` の内部メソッド。ヘッダー配列の順序でオブジェクトの値を並べる。キーが存在しない場合は空文字列になる

---

## Bug Details

### Bug Condition

`createSeller` の `appendRow` 呼び出しで渡しているオブジェクトに、フォームで入力可能な多数のフィールドが含まれていない。`objectToRow` はヘッダーに対応するキーが存在しない場合に空文字列を返すため、スプレッドシートの該当列が空欄になる。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type CreateSellerRequest
  OUTPUT: boolean

  RETURN X.nextCallDate IS NOT NULL
      OR X.visitDate IS NOT NULL
      OR X.visitAssignee IS NOT NULL
      OR X.confidence IS NOT NULL
      OR X.status IS NOT NULL
      OR X.comments IS NOT NULL
      OR X.valuationAmount1 IS NOT NULL
      OR X.valuationMethod IS NOT NULL
      OR X.contactMethod IS NOT NULL
      OR X.preferredContactTime IS NOT NULL
      OR X.assignedTo IS NOT NULL
      OR X.visitTime IS NOT NULL
      OR X.visitNotes IS NOT NULL
      OR X.valuationAssignee IS NOT NULL
      OR X.valuationAmount2 IS NOT NULL
      OR X.valuationAmount3 IS NOT NULL
END FUNCTION
```

### Examples

- 次電日「2026-05-01」を入力して登録 → スプレッドシートの「次電日」列が空欄（期待値: `2026-05-01`）
- 営担「Y」を選択して登録 → スプレッドシートの「営担」列が空欄（期待値: `Y`）
- 確度「A」を選択して登録 → スプレッドシートの「確度」列が空欄（期待値: `A`）
- 状況（当社）「追客中」を選択して登録 → スプレッドシートの「状況（当社）」列が空欄（期待値: `追客中`）
- コメント「テスト」を入力して登録 → スプレッドシートの「コメント」列が空欄（期待値: `テスト`）
- 査定額1「1500」を入力して登録 → スプレッドシートの「査定額1」列が空欄（期待値: `1500`）
- 担当社員「Y」を入力して登録 → スプレッドシートの「1番電話」列が空欄（期待値: `Y`）
- 全フィールドが空欄で登録 → バグ条件を満たさないため、既存フィールドのみ同期される（正常動作）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 売主番号（`売主番号`列）は引き続き正しく同期される
- 名前（`名前(漢字のみ）`列）は引き続き正しく同期される
- 依頼者住所（`依頼者住所(物件所在と異なる場合）`列）は引き続き正しく同期される
- 電話番号（`電話番号\nハイフン不要`列）は引き続き正しく同期される
- メールアドレス（`メールアドレス`列）は引き続き正しく同期される
- 物件所在地（`物件所在地`列）は引き続き正しく同期される
- 種別（`種別`列）は引き続き正しく同期される
- 反響日付（`反響日付`列）は引き続き正しく同期される
- サイト（`サイト`列）は引き続き正しく同期される
- データベース（`sellers`テーブル・`properties`テーブル）への保存は引き続き正しく行われる
- 連番シートC2の更新は引き続き正しく行われる

**Scope:**
`appendRow` に渡すオブジェクトへのフィールド追加のみを行う。既存フィールドのキー名・値の変換ロジックは変更しない。

---

## Hypothesized Root Cause

`createSeller` メソッドが実装された際、`appendRow` に渡すオブジェクトに基本フィールド（売主番号・名前・住所・電話番号・メール・物件所在地・反響情報）のみが含まれ、後から `NewSellerPage.tsx` に追加されたフィールド（次電日・訪問情報・査定情報・追客情報・ステータス情報）が `appendRow` 呼び出しに反映されなかった。

具体的には以下の状況が考えられる：

1. **フィールドの追加漏れ**: `NewSellerPage.tsx` にフィールドが追加された際、`createSeller` の `appendRow` 呼び出しが更新されなかった
2. **`CreateSellerRequest` 型の不一致**: `CreateSellerRequest` 型に定義されていないフィールド（`status`・`confidence`・`comments`・`visitDate` 等）がフロントエンドから送信されているが、バックエンドの型定義に含まれていないため `(data as any).xxx` でアクセスしている箇所もある
3. **段階的な機能追加**: 初期実装では最小限のフィールドのみ同期し、その後フォームにフィールドが追加されたが `appendRow` の更新が漏れた

---

## Correctness Properties

Property 1: Bug Condition - 欠落フィールドのスプレッドシート同期

_For any_ `CreateSellerRequest` において `isBugCondition` が true を返す入力（次電日・訪問日・営担・確度・状況（当社）・コメント・査定情報・追客情報のいずれかが非 null）に対して、修正後の `createSeller` は `appendRow` にそれらのフィールドを含むオブジェクトを渡し、スプレッドシートの該当列に入力値が書き込まれること。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation - 既存フィールドの同期維持

_For any_ `CreateSellerRequest` において `isBugCondition` が false を返す入力（全ての追加フィールドが null）に対して、修正後の `createSeller` は修正前と同じ `appendRow` の動作を維持し、既存フィールド（売主番号・名前・住所・電話番号・メール・物件所在地・反響日付・サイト）が引き続き正しく同期されること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `createSeller`（`appendRow` 呼び出し箇所）

**Specific Changes**:

現在の `appendRow` 呼び出し（`seller-spreadsheet-column-mapping.md` のカラム名に従う）：

```typescript
// 現在（欠落フィールドあり）
await sellerListClient.appendRow({
  '売主番号': sellerNumber || '',
  '名前(漢字のみ）': data.name || '',
  '依頼者住所(物件所在と異なる場合）': data.address || '',
  '電話番号\nハイフン不要': data.phoneNumber || '',
  'メールアドレス': data.email || '',
  '物件所在地': data.property?.address || '',
  '種別': data.property?.propertyType || '',
  '反響日付': (data.inquiryDate instanceof Date ? data.inquiryDate.toISOString().split('T')[0] : data.inquiryDate) || '',
  'サイト': data.inquirySource || '',
});
```

修正後（欠落フィールドを追加）：

```typescript
// 修正後（全フィールドを含む）
await sellerListClient.appendRow({
  // 既存フィールド（変更なし）
  '売主番号': sellerNumber || '',
  '名前(漢字のみ）': data.name || '',
  '依頼者住所(物件所在と異なる場合）': data.address || '',
  '電話番号\nハイフン不要': data.phoneNumber || '',
  'メールアドレス': data.email || '',
  '物件所在地': data.property?.address || '',
  '種別': data.property?.propertyType || '',
  '反響日付': (data.inquiryDate instanceof Date ? data.inquiryDate.toISOString().split('T')[0] : data.inquiryDate) || '',
  'サイト': data.inquirySource || '',
  // 追加フィールド
  '次電日': (data as any).nextCallDate || '',
  '訪問日 \nY/M/D': (data as any).visitDate || '',
  '訪問時間': (data as any).visitTime || '',
  '営担': (data as any).visitAssignee || '',
  '訪問メモ': (data as any).visitNotes || '',
  '確度': (data as any).confidence || (data as any).confidenceLevel || '',
  '状況（当社）': (data as any).status || '',
  'コメント': (data as any).comments || '',
  '査定額1': (data as any).valuationAmount1 ? String((data as any).valuationAmount1) : '',
  '査定額2': (data as any).valuationAmount2 ? String((data as any).valuationAmount2) : '',
  '査定額3': (data as any).valuationAmount3 ? String((data as any).valuationAmount3) : '',
  '査定方法': (data as any).valuationMethod || '',
  '査定担当': (data as any).valuationAssignee || '',
  '連絡方法': (data as any).contactMethod || '',
  '連絡取りやすい日、時間帯': (data as any).preferredContactTime || '',
  '1番電話': (data as any).assignedTo || '',
});
```

**注意事項**:
- `data.inquirySource` は既存コードで使用されているが、`CreateSellerRequest` 型では `inquirySource` として定義されている。`サイト` フィールドは既存のまま維持する
- `(data as any)` を使用しているのは `CreateSellerRequest` 型に未定義のフィールドが多数あるため。型定義の更新は本バグ修正のスコープ外とする
- 査定額はフロントエンドから万円単位の数値として送信されるため、スプレッドシートにも万円単位でそのまま書き込む（`appendRow` は `RAW` モードで書き込むため）

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後のコードで正しく同期されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `appendRow` に欠落フィールドが渡されていないことを確認し、根本原因を特定する。

**Test Plan**: `createSeller` を呼び出し、`appendRow` に渡されるオブジェクトをモックで検査する。欠落フィールドが空文字列になることを確認する。

**Test Cases**:
1. **次電日テスト**: `nextCallDate: '2026-05-01'` を含む `CreateSellerRequest` で `createSeller` を呼び出し、`appendRow` の引数に `'次電日': '2026-05-01'` が含まれないことを確認（未修正コードで失敗）
2. **営担テスト**: `visitAssignee: 'Y'` を含む `CreateSellerRequest` で `createSeller` を呼び出し、`appendRow` の引数に `'営担': 'Y'` が含まれないことを確認（未修正コードで失敗）
3. **状況（当社）テスト**: `status: '追客中'` を含む `CreateSellerRequest` で `createSeller` を呼び出し、`appendRow` の引数に `'状況（当社）': '追客中'` が含まれないことを確認（未修正コードで失敗）
4. **査定額テスト**: `valuationAmount1: 1500` を含む `CreateSellerRequest` で `createSeller` を呼び出し、`appendRow` の引数に `'査定額1': '1500'` が含まれないことを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `appendRow` に渡されるオブジェクトに追加フィールドのキーが存在しない
- `objectToRow` がヘッダーに対応するキーを見つけられず空文字列を返す

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全入力に対してスプレッドシートの該当列に正しい値が書き込まれることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := createSeller_fixed(X)
  ASSERT appendRow に渡されたオブジェクトに X の各フィールドが含まれる
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、既存フィールドの同期が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT createSeller_original(X) の appendRow 引数 = createSeller_fixed(X) の appendRow 引数
END FOR
```

**Testing Approach**: プロパティベーステストで多様な入力を生成し、既存フィールドが常に正しく同期されることを確認する。

**Test Cases**:
1. **売主番号保持テスト**: 修正後も `'売主番号'` キーが正しく渡されることを確認
2. **名前保持テスト**: 修正後も `'名前(漢字のみ）'` キーが正しく渡されることを確認
3. **物件所在地保持テスト**: 修正後も `'物件所在地'` キーが正しく渡されることを確認
4. **反響日付保持テスト**: 修正後も `'反響日付'` キーが正しく渡されることを確認

### Unit Tests

- `appendRow` に渡されるオブジェクトに全フィールドが含まれることをテスト
- 各フィールドが空の場合に空文字列が渡されることをテスト
- 査定額が数値から文字列に変換されることをテスト
- 既存フィールドのキー名・値が変わらないことをテスト

### Property-Based Tests

- ランダムな `CreateSellerRequest` を生成し、`appendRow` に渡されるオブジェクトに全フィールドが含まれることを検証
- 既存フィールドのキー名が修正前後で変わらないことを検証
- 空値（null/undefined）が空文字列に変換されることを検証

### Integration Tests

- 実際の `createSeller` 呼び出しで、スプレッドシートに全フィールドが書き込まれることを確認
- 全フィールドを入力した売主登録後、スプレッドシートの該当行を確認
- 既存フィールドのみ入力した売主登録後、既存フィールドが正しく同期されることを確認
