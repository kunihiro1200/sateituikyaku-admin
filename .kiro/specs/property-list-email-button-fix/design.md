# property-list-email-button-fix Bugfix Design

## Overview

物件詳細ページに2つのバグが存在する。

1. `GmailDistributionButton.tsx` のボタンラベルが「公開前、値下げメール配信」になっているが、正しくは「公開前、値下げメール」であるべき。
2. `PriceSection.tsx` の `useEffect` が `/api/property-listings/{propertyNumber}/scheduled-notifications` を呼び出しているが、このエンドポイントはバックエンドに存在しないため 404 エラーが発生し続ける。

修正方針は以下の通り：
- ボタンラベルを1文字変更（「配信」を削除）
- 存在しないエンドポイントへの API 呼び出しを `useEffect` から削除し、`scheduledNotifications` のデフォルト値を空配列のまま使用する

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 物件詳細ページが表示されたとき、または `GmailDistributionButton` が描画されたとき
- **Property (P)**: 修正後の期待される正しい動作 — 404 エラーが発生せず、ボタンラベルが「公開前、値下げメール」と表示される
- **Preservation**: 修正によって変更してはならない既存の動作 — メール配信フロー、Chat 送信ボタンのスタイル制御
- **PriceSection**: `frontend/frontend/src/components/PriceSection.tsx` — 物件の価格情報を表示するコンポーネント。`scheduledNotifications` を使って Chat 送信ボタンのスタイルを制御する
- **GmailDistributionButton**: `frontend/frontend/src/components/GmailDistributionButton.tsx` — メール配信ボタンコンポーネント
- **scheduledNotifications**: `PriceSection` 内の状態変数。Chat 送信ボタンのアニメーション制御に使用される（空配列の場合はアニメーションが有効になる）

## Bug Details

### Bug Condition

バグは以下の2つの条件で発現する：

**バグ1（ラベル）**: `GmailDistributionButton` が描画されるたびに、ボタンテキストが「公開前、値下げメール配信」と表示される。

**バグ2（404エラー）**: `PriceSection` が `propertyNumber` を受け取ってマウントされるたびに、存在しない API エンドポイントへのリクエストが発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { component: string, propertyNumber: string }
  OUTPUT: boolean

  IF input.component = 'GmailDistributionButton'
    RETURN buttonLabel(input) = '公開前、値下げメール配信'
  END IF

  IF input.component = 'PriceSection'
    RETURN input.propertyNumber IS NOT EMPTY
           AND apiEndpointExists('/api/property-listings/' + input.propertyNumber + '/scheduled-notifications') = false
           AND apiCallIsMade('/api/property-listings/' + input.propertyNumber + '/scheduled-notifications') = true
  END IF

  RETURN false
END FUNCTION
```

### Examples

- **バグ1**: 物件詳細ページを開く → ボタンに「公開前、値下げメール配信」と表示される（期待値: 「公開前、値下げメール」）
- **バグ2**: 物件番号 `P001` の詳細ページを開く → `GET /api/property-listings/P001/scheduled-notifications` が呼ばれ 404 エラーが発生する（期待値: エラーなし）
- **バグ2（エッジケース）**: `propertyNumber` が空文字の場合 → `useEffect` の早期リターンにより API 呼び出しは発生しない（修正前後で動作は同じ）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 「公開前、値下げメール」ボタンをクリックするとテンプレート選択モーダルが開く
- `distribution-buyers-enhanced` API が正常に呼び出され、買主データが取得される
- メール配信完了後に成功・失敗のスナックバーメッセージが表示される
- `PriceSection` の Chat 送信ボタンのスタイル制御（`isPriceChanged && scheduledNotifications.length === 0` の条件）が正しく動作する

**スコープ:**
`scheduledNotifications` の API 呼び出しを削除しても、`scheduledNotifications` のデフォルト値は空配列 `[]` のままであるため、`scheduledNotifications.length === 0` は常に `true` となり、Chat 送信ボタンのスタイル制御ロジックは変わらない。

## Hypothesized Root Cause

1. **ラベルの単純な誤記**: `GmailDistributionButton.tsx` のボタンテキストに「配信」が余分に含まれている。要件定義と実装が一致していなかった。

2. **未実装のエンドポイントへの呼び出し**: `PriceSection.tsx` が `scheduled-notifications` エンドポイントを呼び出しているが、`backend/src/routes/propertyListings.ts` にこのエンドポイントが実装されていない。おそらく将来の機能として UI 側だけ先に実装されたが、バックエンドの実装が行われなかった。

3. **エラーハンドリングの不足**: `useEffect` 内の `catch` ブロックで `setScheduledNotifications([])` を設定しているため、UI の動作自体は壊れていないが、コンソールエラーが発生し続ける。

## Correctness Properties

Property 1: Bug Condition - ボタンラベルと404エラーの修正

_For any_ 物件詳細ページの表示において、バグ条件が成立する（`isBugCondition` が true を返す）入力に対して、修正後のコンポーネントは以下を満たす：
- `GmailDistributionButton` のボタンラベルが「公開前、値下げメール」と表示される
- `PriceSection` のマウント時に `/api/property-listings/{propertyNumber}/scheduled-notifications` への API 呼び出しが発生しない

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - メール配信フローと Chat 送信ボタンの動作保持

_For any_ バグ条件が成立しない入力（ボタンクリック、Chat 送信ボタン操作など）において、修正後のコードは元のコードと同じ動作を保持する。具体的には、メール配信フロー（テンプレート選択 → 買主フィルタ → 確認 → 送信）および Chat 送信ボタンのスタイル制御が変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File 1**: `frontend/frontend/src/components/GmailDistributionButton.tsx`

**変更箇所**: ボタンのテキスト

**具体的な変更:**
1. **ラベル変更**: `公開前、値下げメール配信` → `公開前、値下げメール`

---

**File 2**: `frontend/frontend/src/components/PriceSection.tsx`

**変更箇所**: `useEffect` 内の `scheduled-notifications` API 呼び出し

**具体的な変更:**
1. **API 呼び出しの削除**: `useEffect` 内の `fetchScheduledNotifications` 関数と呼び出しを削除する
2. **関連状態の整理**: `loadingNotifications` 状態も不要になるため削除する（`scheduledNotifications` の初期値 `[]` はそのまま保持）
3. **import の整理**: `useEffect` が他の用途で使われていないか確認し、不要であれば削除する

**注意**: `scheduledNotifications` 変数自体は Chat 送信ボタンのスタイル制御に使用されているため、削除しない。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを確認し、根本原因分析を検証する。

**Test Plan**: コンポーネントをレンダリングして、ボタンラベルと API 呼び出しの有無を確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **ラベルテスト**: `GmailDistributionButton` をレンダリングし、ボタンテキストが「公開前、値下げメール」であることを確認（未修正コードでは失敗する）
2. **API 呼び出しテスト**: `PriceSection` をレンダリングし、`/scheduled-notifications` への API 呼び出しが発生しないことを確認（未修正コードでは失敗する）
3. **エラーなしテスト**: `PriceSection` のマウント後に `console.error` が呼ばれないことを確認（未修正コードでは失敗する）

**Expected Counterexamples**:
- ボタンテキストが「公開前、値下げメール配信」と表示される
- `api.get('/api/property-listings/P001/scheduled-notifications')` が呼ばれる

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後のコードが期待される動作を示すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := render_fixed_component(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後のコードが元のコードと同じ動作を示すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT original_component(input) = fixed_component(input)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由：
- `isPriceChanged` と `scheduledNotifications.length` の組み合わせを自動生成して、スタイル制御ロジックが変わらないことを確認できる
- メール配信フローの各ステップを多様な入力で検証できる

**Test Cases**:
1. **メール配信フロー保持**: ボタンクリック → テンプレート選択モーダルが開くことを確認
2. **Chat 送信ボタンスタイル保持**: `isPriceChanged=true` かつ `scheduledNotifications=[]` のとき、アニメーションスタイルが適用されることを確認
3. **買主データ取得保持**: `distribution-buyers-enhanced` API が正常に呼び出されることを確認

### Unit Tests

- `GmailDistributionButton` のボタンラベルが「公開前、値下げメール」であることを確認
- `PriceSection` マウント時に `scheduled-notifications` API が呼ばれないことを確認
- `PriceSection` マウント時に `console.error` が呼ばれないことを確認

### Property-Based Tests

- `isPriceChanged` と `scheduledNotifications.length` のランダムな組み合わせで、Chat 送信ボタンのスタイル制御ロジックが正しく動作することを確認
- 様々な `propertyNumber` 値（空文字、通常値、特殊文字）で `PriceSection` をレンダリングし、API 呼び出しが発生しないことを確認

### Integration Tests

- 物件詳細ページ全体をレンダリングし、コンソールエラーが発生しないことを確認
- メール配信ボタンのクリックからメール送信完了までのフロー全体が正常に動作することを確認
