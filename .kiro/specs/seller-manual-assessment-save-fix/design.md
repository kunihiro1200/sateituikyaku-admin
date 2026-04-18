# 手入力査定額保存バグ修正 Bugfix Design

## Overview

売主管理システムの通話モードページ（`/sellers/:id/call`）の「手入力査定額」セクションで2つのバグが発生している。

**バグ1（UI復元失敗）**: 手入力査定額を保存後に「完了」ボタンを押すと、`loadAllData()` が再実行され、`setIsManualValuation(false)` と `setEditedManualValuationAmount1/2/3('')` が無条件に実行されるため、DBに保存済みの値がUIに復元されない。

**バグ2（スプシ同期欠落）**: `column-mapping.json` の `databaseToSpreadsheet` セクションで `valuation_amount_1/2/3` が `査定額1（自動計算）v`（BC/BD/BE列）にのみマッピングされており、CB/CC/CD列（「査定額1/2/3」）へのマッピングが存在しないため、手入力査定額保存時にCB/CC/CD列が更新されない。

修正方針は最小限の変更に留める：
- `loadAllData()` に DBの `valuationAmount1/2/3` と `fixedAssetTaxRoadPrice` を参照した条件分岐を追加
- `column-mapping.json` の `databaseToSpreadsheet` に `valuation_amount_1/2/3` → `査定額1/2/3` のエントリを追加

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 手入力査定額が保存済みの状態で `loadAllData()` が呼ばれる、または手入力査定額を保存する
- **Property (P)**: 期待される正しい動作 — UIに保存済み手入力査定額が復元される、かつスプシCB/CC/CD列が更新される
- **Preservation**: 修正によって変えてはいけない既存の動作
- **loadAllData()**: `frontend/frontend/src/pages/CallModePage.tsx` 内の関数。ページ初期化・完了ボタン押下後に売主データをAPIから取得してUIに反映する
- **isManualValuation**: 手入力モードかどうかを示すReact state。`true` のとき手入力査定額が使用される
- **databaseToSpreadsheet**: `backend/src/config/column-mapping.json` 内のセクション。DBカラム名 → スプシ列名のマッピングを定義する
- **ColumnMapper.mapToSheet()**: `backend/src/services/ColumnMapper.ts` 内のメソッド。`databaseToSpreadsheet` マッピングに従ってDBデータをスプシ行形式に変換する
- **valuationAmount1/2/3**: DBの `valuation_amount_1/2/3`（円単位）に対応するフロントエンド側のキャメルケース名

## Bug Details

### Bug Condition

バグ1は `loadAllData()` が呼ばれるたびに発現する（完了ボタン押下後の再読み込みを含む）。
バグ2は `handleSaveManualValuation()` が `updateSeller()` を呼び出してスプシ同期が実行されるたびに発現する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { trigger: 'loadAllData' | 'saveManualValuation', sellerData: SellerData }
  OUTPUT: boolean

  IF input.trigger = 'loadAllData'
    RETURN input.sellerData.valuationAmount1 IS NOT NULL
           AND input.sellerData.fixedAssetTaxRoadPrice IS NULL
           -- 手入力査定額が保存済みなのに isManualValuation=false にリセットされる
  END IF

  IF input.trigger = 'saveManualValuation'
    RETURN true
    -- 保存時は常にCB/CC/CD列が更新されないバグが発現する
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **バグ1の例**: 査定額1=3000万円を保存 → 完了ボタン押下 → `loadAllData()` 実行 → `setIsManualValuation(false)` / `setEditedManualValuationAmount1('')` が無条件実行 → UIが空欄に戻る（期待: 3000万円が表示されたまま）
- **バグ2の例**: 査定額1=3000万円を保存 → スプシ同期実行 → BC列（査定額1（自動計算）v）のみ更新 → CB列（査定額1）は更新されない（期待: CB列も3000万円に更新される）
- **バグ1エッジケース**: 手入力査定額が未保存（`valuationAmount1 = null`）の状態で完了ボタン → `setIsManualValuation(false)` は正しい動作（バグ非発現）
- **バグ2エッジケース**: 査定額1のみ入力（査定額2/3は空）の場合 → CB列のみ更新、CC/CD列は空文字で更新される（期待動作）

## Expected Behavior

### Preservation Requirements

**変えてはいけない動作:**
- 手入力査定額が未保存の状態で「完了」ボタンを押した場合、査定額フィールドは空欄のまま維持される
- 固定資産税路線価を入力して「完了」ボタンを押した場合（自動計算モード）、査定額1/2/3が自動計算されてDBおよびスプシに保存される
- `SellerService.updateSeller()` がスプシ同期を実行する際、BC/BD/BE列（「査定額1（自動計算）v」）への更新は維持される
- 手入力査定額をクリアした場合、`isManualValuation` が `false` に戻り、手入力フィールドが空欄になる
- 手入力査定額を保存する際、`valuationAmount1/2/3`（円単位）がDBに保存され、`fixedAssetTaxRoadPrice` が `null` にクリアされる

**スコープ:**
手入力査定額の保存・復元に関係しない操作（マウスクリック、他フィールドの編集、ステータス変更など）はこの修正の影響を受けない。

## Hypothesized Root Cause

### バグ1の根本原因

`loadAllData()` 内の以下のコード（約1786行目）が問題：

```typescript
// 常に自動計算モードとして扱う
// （手入力査定額は将来的にmanualValuationAmount1を使用）
setIsManualValuation(false);          // ← 無条件にfalseにリセット
setEditedManualValuationAmount1('');  // ← 無条件に空文字にリセット
setEditedManualValuationAmount2('');
setEditedManualValuationAmount3('');
```

コメントに「将来的に実装予定」とあり、手入力査定額の復元ロジックが未実装のまま残っている。
DBには `valuationAmount1/2/3` として保存されているが、`fixedAssetTaxRoadPrice` が `null` かどうかで手入力か自動計算かを判別できる（手入力保存時に `fixedAssetTaxRoadPrice` を `null` にクリアする処理が `handleSaveManualValuation()` に存在する）。

### バグ2の根本原因

`column-mapping.json` の `databaseToSpreadsheet` セクション：

```json
"valuation_amount_1": "査定額1（自動計算）v",  // BC列のみ
"valuation_amount_2": "査定額2（自動計算）v",  // BD列のみ
"valuation_amount_3": "査定額3（自動計算）v",  // BE列のみ
```

CB/CC/CD列（「査定額1」「査定額2」「査定額3」）へのマッピングが存在しない。
`ColumnMapper.mapToSheet()` は `databaseToSpreadsheet` を1対1でイテレートするため、マッピングがなければ該当列は更新されない。

## Correctness Properties

Property 1: Bug Condition - 手入力査定額のUI復元

_For any_ `loadAllData()` 呼び出しにおいて、DBから取得した `valuationAmount1` が存在し かつ `fixedAssetTaxRoadPrice` が `null` である場合（手入力モード）、修正後の `loadAllData()` は `setIsManualValuation(true)` を設定し、`setEditedManualValuationAmount1/2/3` に万円単位の値を復元しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - スプシCB/CC/CD列への同期

_For any_ `SellerService.updateSeller()` 呼び出しにおいて `valuationAmount1/2/3` が更新される場合、修正後のスプシ同期処理はCB列（査定額1）・CC列（査定額2）・CD列（査定額3）も更新しなければならない。

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation - 手入力未保存時の動作維持

_For any_ `loadAllData()` 呼び出しにおいて、DBから取得した `valuationAmount1` が `null` である場合（手入力未保存）、修正後の `loadAllData()` は `setIsManualValuation(false)` を設定し、手入力フィールドを空欄のまま維持しなければならない（既存動作と同一）。

**Validates: Requirements 3.1**

Property 4: Preservation - BC/BD/BE列への既存同期維持

_For any_ `SellerService.updateSeller()` 呼び出しにおいて `valuationAmount1/2/3` が更新される場合、修正後のスプシ同期処理はBC列（査定額1（自動計算）v）・BD列・BE列への更新を引き続き行わなければならない。

**Validates: Requirements 3.2, 3.3**

## Fix Implementation

### Changes Required

#### ファイル1: `frontend/frontend/src/pages/CallModePage.tsx`

**関数**: `loadAllData()` 内の査定額初期化ブロック（約1785〜1789行目）

**変更内容**:
1. **条件分岐の追加**: `valuationAmount1` が存在し かつ `fixedAssetTaxRoadPrice` が `null` の場合を手入力モードと判定
2. **手入力値の復元**: `setIsManualValuation(true)` を設定し、万円単位に変換した値を各 state にセット
3. **自動計算モードの維持**: それ以外の場合は既存の `setIsManualValuation(false)` / 空文字セットを維持

```typescript
// 修正後のイメージ（pseudocode）
const hasManualValuation = sellerData.valuationAmount1 != null
                           && sellerData.fixedAssetTaxRoadPrice == null;

if (hasManualValuation) {
  setIsManualValuation(true);
  setEditedManualValuationAmount1(
    String(Math.round(sellerData.valuationAmount1 / 10000))
  );
  setEditedManualValuationAmount2(
    sellerData.valuationAmount2
      ? String(Math.round(sellerData.valuationAmount2 / 10000))
      : ''
  );
  setEditedManualValuationAmount3(
    sellerData.valuationAmount3
      ? String(Math.round(sellerData.valuationAmount3 / 10000))
      : ''
  );
} else {
  setIsManualValuation(false);
  setEditedManualValuationAmount1('');
  setEditedManualValuationAmount2('');
  setEditedManualValuationAmount3('');
}
```

#### ファイル2: `backend/src/config/column-mapping.json`

**セクション**: `databaseToSpreadsheet`

**変更内容**:
- `valuation_amount_1` → `査定額1` のエントリを追加（CB列）
- `valuation_amount_2` → `査定額2` のエントリを追加（CC列）
- `valuation_amount_3` → `査定額3` のエントリを追加（CD列）

**注意**: `ColumnMapper.mapToSheet()` は同一DBカラムを複数のスプシ列にマッピングできない（`for...of Object.entries()` で1対1処理）。そのため、`mapToSheet()` 内の査定額特殊処理ブロックを拡張し、`valuation_amount_1/2/3` の場合は BC/BD/BE列 と CB/CC/CD列 の両方に書き込む処理を追加する。

```typescript
// ColumnMapper.mapToSheet() 内の修正後イメージ（pseudocode）
if (dbColumn === 'valuation_amount_1' || dbColumn === 'valuation_amount_2' || dbColumn === 'valuation_amount_3') {
  const numVal = typeof value === 'number' ? value : parseFloat(String(value));
  const manEn = isNaN(numVal) ? '' : Math.round(numVal / 10000);
  sheetRow[sheetColumn] = manEn;  // BC/BD/BE列（既存）

  // CB/CC/CD列にも同じ値を書き込む
  const manualColumnMap: Record<string, string> = {
    'valuation_amount_1': '査定額1',
    'valuation_amount_2': '査定額2',
    'valuation_amount_3': '査定額3',
  };
  sheetRow[manualColumnMap[dbColumn]] = manEn;  // CB/CC/CD列（追加）
  continue;
}
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書いて根本原因を確認し、次に修正後のコードで正しい動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグが発現することを確認し、根本原因分析を検証する。

**Test Plan**: `loadAllData()` の初期化ロジックと `ColumnMapper.mapToSheet()` に対してユニットテストを書き、未修正コードで実行して失敗を観察する。

**Test Cases**:
1. **手入力査定額復元テスト**: `valuationAmount1=30000000, fixedAssetTaxRoadPrice=null` のデータで `loadAllData()` を呼び出し、`isManualValuation` が `false` のままであることを確認（未修正コードで失敗）
2. **スプシCB列同期テスト**: `valuation_amount_1=30000000` のデータで `ColumnMapper.mapToSheet()` を呼び出し、返り値に `査定額1` キーが存在しないことを確認（未修正コードで失敗）
3. **スプシCC/CD列同期テスト**: 同様に `査定額2`・`査定額3` キーが存在しないことを確認（未修正コードで失敗）
4. **手入力未保存エッジケース**: `valuationAmount1=null` のデータで `loadAllData()` を呼び出し、`isManualValuation` が `false` であることを確認（未修正コードで成功 → バグ非発現を確認）

**Expected Counterexamples**:
- `isManualValuation` が `true` にならない（`setIsManualValuation(false)` が無条件実行されるため）
- `mapToSheet()` の返り値に `査定額1/2/3` キーが含まれない（マッピングが存在しないため）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する入力に対して期待動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**具体的なアサーション:**
- `valuationAmount1=30000000, fixedAssetTaxRoadPrice=null` → `isManualValuation=true`, `editedManualValuationAmount1='3000'`
- `mapToSheet({ valuation_amount_1: 30000000 })` → `{ '査定額1（自動計算）v': 3000, '査定額1': 3000 }`

### Preservation Checking

**Goal**: バグ条件が成立しない入力に対して、修正前後で動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様な入力パターンを自動生成することで、手動テストでは見落としがちなエッジケースを網羅できる。

**Test Cases**:
1. **手入力未保存の保存維持**: `valuationAmount1=null` → `isManualValuation=false`, 空欄維持（修正前後で同一）
2. **自動計算モードの維持**: `valuationAmount1=30000000, fixedAssetTaxRoadPrice=50000` → `isManualValuation=false`（自動計算モードは変わらない）
3. **BC/BD/BE列の既存同期維持**: `mapToSheet({ valuation_amount_1: 30000000 })` → `査定額1（自動計算）v: 3000` が引き続き含まれる
4. **手入力クリア後の動作維持**: クリア操作後に `loadAllData()` → `isManualValuation=false`, 空欄

### Unit Tests

- `loadAllData()` の査定額初期化ロジックを分離してテスト（手入力あり・なし・自動計算の3パターン）
- `ColumnMapper.mapToSheet()` に `valuation_amount_1/2/3` を渡したときの返り値を検証
- `handleSaveManualValuation()` 保存後の state 変化を検証

### Property-Based Tests

- ランダムな `valuationAmount1/2/3` と `fixedAssetTaxRoadPrice` の組み合わせを生成し、`isManualValuation` の判定ロジックが正しいことを検証
- ランダムな査定額（0〜10億円）で `mapToSheet()` を呼び出し、BC/BD/BE列とCB/CC/CD列の両方に万円単位の値が書き込まれることを検証
- 非バグ入力（`valuationAmount1=null` など）で修正前後の動作が同一であることを検証

### Integration Tests

- 通話モードページで手入力査定額を保存 → 完了ボタン → UIに値が残っていることを確認
- 手入力査定額を保存後、スプシのCB/CC/CD列が更新されていることを確認
- 自動計算モードで完了ボタンを押した後、BC/BD/BE列が引き続き更新されることを確認
