# 売主査定額メールエリア優先度バグ修正 設計ドキュメント

## 概要

通話モードページ（CallModePage）の査定額メール送信機能にバグがある。
`handleShowValuationEmailConfirm` 関数内でメール本文の面積値（「土地〇〇㎡、建物〇〇㎡で算出しております」の部分）を生成する際、
「土地面積（当社調べ）」（`landAreaVerified`）や「建物面積（当社調べ）」（`buildingAreaVerified`）に値が入力されていても、
通常の `landArea` / `buildingArea` がそのまま使用されてしまっている。

**影響範囲**: `frontend/frontend/src/pages/CallModePage.tsx` の `handleShowValuationEmailConfirm` 関数（約2660行目）

**修正方針**: 面積値取得時に `landAreaVerified` / `buildingAreaVerified` を優先し、なければ `landArea` / `buildingArea` にフォールバックする。

---

## 用語集

- **Bug_Condition (C)**: バグが発生する条件 — `property.landAreaVerified` または `property.buildingAreaVerified` に値が存在するにもかかわらず、メール本文に `landArea` / `buildingArea` が使用される場合
- **Property (P)**: 期待される動作 — 「当社調べ」フィールドの値が優先されてメール本文の面積表示に使用される
- **Preservation（保持）**: 修正によって変更してはならない既存の動作 — 「当社調べ」フィールドが空の場合に通常フィールドを使ったメール本文生成
- **handleShowValuationEmailConfirm**: `frontend/frontend/src/pages/CallModePage.tsx` の関数。査定額メール送信確認ダイアログを表示する際にメール本文を生成する
- **propInfo**: `CallModePage` 内の `useMemo` で計算されるオブジェクト。`property` または `seller` の直接フィールドから面積情報を集約する。`landAreaVerified` / `buildingAreaVerified` を含む
- **landAreaVerified / buildingAreaVerified**: `PropertyInfo` 型の「土地（当社調べ）」「建物（当社調べ）」フィールド。DBカラム名は `land_area_verified` / `building_area_verified`

---

## バグ詳細

### バグ条件

`handleShowValuationEmailConfirm` 関数内で、メール本文の面積値を取得する際に
`property.landAreaVerified` / `property.buildingAreaVerified` の存在チェックが行われていない。
そのため、「当社調べ」フィールドに値があっても常に `property.landArea` / `property.buildingArea` が使用される。

**形式的仕様:**
```
FUNCTION isBugCondition(property)
  INPUT: property of type PropertyInfo
  OUTPUT: boolean

  RETURN (property.landAreaVerified IS NOT NULL AND property.landAreaVerified != '')
         OR (property.buildingAreaVerified IS NOT NULL AND property.buildingAreaVerified != '')
END FUNCTION
```

### 具体例

**土地（当社調べ）に値がある場合（バグ発生）:**
- `property.landAreaVerified` = 165.3（土地（当社調べ）に値あり）
- `property.landArea` = 150.0（通常の土地面積）
- `property.buildingAreaVerified` = null
- `property.buildingArea` = 90.0

**現在の動作（バグあり）:**
```
※土地150.0㎡、建物90.0㎡で算出しております。
```
→ `landAreaVerified=165.3` が無視され、`landArea=150.0` が使われる

**期待される動作（修正後）:**
```
※土地165.3㎡、建物90.0㎡で算出しております。
```
→ `landAreaVerified=165.3` が優先される

**「当社調べ」フィールドがない場合（バグなし）:**
- `property.landAreaVerified` = null
- `property.buildingAreaVerified` = null
- → `landArea` / `buildingArea` がそのまま使用される（変化なし）

---

## 期待される動作

### 保持要件

**変更しない動作:**
- 「土地（当社調べ）」「建物（当社調べ）」の両方がnull/undefinedの場合、通常の `landArea` / `buildingArea` をメール本文に使用する
- 査定額の計算ロジック（`editedValuationAmount1` / `2` / `3`）は変更しない
- メール件名・本文の他の部分（査定額表示、会社情報など）は変更しない
- SMS送信、売主情報保存、査定額計算など、査定額メール送信以外の操作は影響を受けない

**スコープ:**
バグ条件に該当しない入力（「当社調べ」フィールドが空の場合）は
この修正によって完全に影響を受けない。

---

## 根本原因の仮説

コードを調査した結果、根本原因は以下の通り：

**`frontend/frontend/src/pages/CallModePage.tsx` の `handleShowValuationEmailConfirm` 関数（約2660行目）:**

```typescript
// 土地面積と建物面積を取得（バグあり）
const landArea = property.landArea || '未設定';
const buildingArea = property.buildingArea || '未設定';
```

`propInfo` オブジェクトには `landAreaVerified` / `buildingAreaVerified` が正しく含まれているが、
`handleShowValuationEmailConfirm` 関数内では `property` オブジェクトから直接 `landArea` / `buildingArea` を取得しており、
`landAreaVerified` / `buildingAreaVerified` の優先チェックが実装されていない。

なお、`propInfo` は `useMemo` で計算されており、`property.landAreaVerified` / `property.buildingAreaVerified` を含んでいる。
また、バックエンドの計算ロジック（`ValuationCalculatorService`）は `buildingAreaVerified || buildingArea` という優先順位を正しく実装済みである。
今回のバグはフロントエンドのメール本文生成部分のみの問題。

---

## 正確性プロパティ

Property 1: バグ条件 — 「当社調べ」フィールドの優先使用

_For any_ `property` において、`property.landAreaVerified` または `property.buildingAreaVerified` に値が存在する場合（isBugCondition が true）、
修正後の `handleShowValuationEmailConfirm` 関数は「当社調べ」フィールドの値を優先してメール本文の面積表示に使用し、
正しい面積値を含むメール本文を生成する。

**Validates: Requirements 2.1, 2.2**

Property 2: 保持 — 「当社調べ」フィールドがない場合の動作保持

_For any_ `property` において、`property.landAreaVerified` と `property.buildingAreaVerified` が
どちらもnull/undefinedである場合（isBugCondition が false）、
修正後の `handleShowValuationEmailConfirm` 関数は修正前と同じメール本文を生成し、
通常の `landArea` / `buildingArea` を使った既存の動作を保持する。

**Validates: Requirements 3.1, 3.2**

---

## 修正実装

### 変更が必要なファイル

**ファイル**: `frontend/frontend/src/pages/CallModePage.tsx`

**関数**: `handleShowValuationEmailConfirm`

**具体的な変更:**

1. **`landAreaVerified` の優先チェックを追加**: `property.landAreaVerified` があればそれを使用し、なければ `property.landArea` にフォールバック
2. **`buildingAreaVerified` の優先チェックを追加**: `property.buildingAreaVerified` があればそれを使用し、なければ `property.buildingArea` にフォールバック

**修正前:**
```typescript
// 土地面積と建物面積を取得
const landArea = property.landArea || '未設定';
const buildingArea = property.buildingArea || '未設定';
```

**修正後:**
```typescript
// 土地面積と建物面積を取得（「当社調べ」フィールドを優先）
const landArea = property.landAreaVerified || property.landArea || '未設定';
const buildingArea = property.buildingAreaVerified || property.buildingArea || '未設定';
```

**注意**: `propInfo` オブジェクトには既に `landAreaVerified` / `buildingAreaVerified` が含まれているが、
`handleShowValuationEmailConfirm` 関数内では `property` オブジェクトを直接参照しているため、
`property.landAreaVerified` / `property.buildingAreaVerified` を参照する形で修正する。

---

## テスト戦略

### 検証アプローチ

テスト戦略は2フェーズで実施する：
まず修正前のコードでバグを再現するカウンター例を確認し、
次に修正後のコードで正しい動作と既存動作の保持を検証する。

### 探索的バグ条件チェック

**目標**: 修正前のコードでバグを実証するカウンター例を確認する。根本原因分析を確認または反証する。

**テスト計画**: `handleShowValuationEmailConfirm` 関数に対して、
`property.landAreaVerified` または `property.buildingAreaVerified` に値がある物件データを使ってテストを実行する。
修正前のコードでテストを実行して失敗を観察し、根本原因を理解する。

**テストケース:**
1. **土地（当社調べ）のみ設定**: `landAreaVerified=165.3`, `landArea=150.0`, `buildingAreaVerified=null` の場合、メール本文に `165.3` が含まれることを確認（修正前は失敗）
2. **建物（当社調べ）のみ設定**: `buildingAreaVerified=99.2`, `buildingArea=90.0`, `landAreaVerified=null` の場合、メール本文に `99.2` が含まれることを確認（修正前は失敗）
3. **両方設定**: `landAreaVerified=165.3`, `buildingAreaVerified=99.2` の場合、両方がメール本文に含まれることを確認（修正前は失敗）
4. **「当社調べ」なし**: `landAreaVerified=null`, `buildingAreaVerified=null` の場合、`landArea` / `buildingArea` がメール本文に含まれることを確認（修正前後で同じ動作）

**期待されるカウンター例:**
- 「当社調べ」フィールドに値があるにもかかわらず、通常フィールドの値がメール本文に表示される
- 原因: `handleShowValuationEmailConfirm` 内で `landAreaVerified` / `buildingAreaVerified` の優先チェックが実装されていない

### 修正チェック

**目標**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**疑似コード:**
```
FOR ALL property WHERE isBugCondition(property) DO
  result := handleShowValuationEmailConfirm_fixed(property)
  ASSERT result.emailBody CONTAINS (property.landAreaVerified OR property.landArea)
  ASSERT result.emailBody CONTAINS (property.buildingAreaVerified OR property.buildingArea)
END FOR
```

### 保持チェック

**目標**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**疑似コード:**
```
FOR ALL property WHERE NOT isBugCondition(property) DO
  ASSERT handleShowValuationEmailConfirm_original(property) = handleShowValuationEmailConfirm_fixed(property)
END FOR
```

**テストアプローチ**: プロパティベーステストを推奨する。理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストでは見逃しがちなエッジケースを検出できる
- バグ条件に該当しない全ての入力に対して動作が変わらないことを強く保証できる

**テストケース:**
1. **「当社調べ」なし（両方null）**: 修正前後でメール本文の面積表示が同じであることを確認
2. **「当社調べ」なし（両方undefined）**: 修正前後でメール本文の面積表示が同じであることを確認
3. **面積値が未設定**: `landArea=null`, `buildingArea=null`, `landAreaVerified=null` の場合、「未設定」が表示されることを確認

### ユニットテスト

- `landAreaVerified` に値がある場合にメール本文で優先されることのテスト
- `buildingAreaVerified` に値がある場合にメール本文で優先されることのテスト
- 両方nullの場合に `landArea` / `buildingArea` が使われることのテスト（保持）
- 全てnullの場合に「未設定」が表示されることのテスト

### プロパティベーステスト

- ランダムな `landAreaVerified` / `buildingAreaVerified` の値を生成し、「当社調べ」フィールドがメール本文に優先されることを検証
- ランダムな `landArea` / `buildingArea` の値を生成し、「当社調べ」フィールドがnullの場合に通常フィールドが使われることを検証（保持）
- 多数のシナリオにわたって修正前後のメール本文が一致することを検証（バグ条件外）

### 統合テスト

- 実際の物件データ（`landAreaVerified` あり）を使った査定額メール確認ダイアログ表示テスト
- 修正後も `landAreaVerified` がない物件の査定額メール本文が正しく生成されることを確認
- 査定額メール送信以外の操作（SMS送信、売主情報保存など）が影響を受けないことを確認
