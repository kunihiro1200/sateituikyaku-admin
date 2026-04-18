# property-list-send-history-label-fix バグ修正デザイン

## Overview

物件リスト詳細画面のサイドバーに表示される `SellerSendHistory` コンポーネントのセクションラベルが誤っている。
現在は「売主への送信履歴」と表示されているが、正しくは「売主・物件の送信履歴」であるべき。

修正対象は `frontend/frontend/src/components/SellerSendHistory.tsx` の112行目付近にある
`Typography` コンポーネント内のテキストリテラル1箇所のみ。
ロジック・スタイル・データ取得処理への変更は一切不要。

## Glossary

- **Bug_Condition (C)**: `SellerSendHistory` コンポーネントがレンダリングされたとき、セクションラベルが「売主への送信履歴」と表示される状態
- **Property (P)**: セクションラベルが「売主・物件の送信履歴」と表示されること
- **Preservation**: 送信履歴の一覧表示・空メッセージ表示・詳細モーダル表示など、ラベル以外の既存動作が変わらないこと
- **SellerSendHistory**: `frontend/frontend/src/components/SellerSendHistory.tsx` に定義されたコンポーネント。物件番号を受け取り、売主向け送信履歴（seller_email / seller_sms / seller_gmail）を一覧表示する
- **refreshTrigger**: 親コンポーネントから渡される数値 prop。値が変わると履歴を再取得する

## Bug Details

### Bug Condition

コンポーネントがレンダリングされると、セクションラベルとして「売主への送信履歴」という誤ったテキストが表示される。
正しいラベルは「売主・物件の送信履歴」であり、送信履歴が売主だけでなく物件にも関連することを示す必要がある。

**Formal Specification:**
```
FUNCTION isBugCondition(renderedOutput)
  INPUT: renderedOutput - SellerSendHistory コンポーネントのレンダリング結果
  OUTPUT: boolean

  RETURN renderedOutput に「売主への送信履歴」というテキストが含まれる
         AND renderedOutput に「売主・物件の送信履歴」というテキストが含まれない
END FUNCTION
```

### Examples

- **バグあり**: 物件リスト詳細画面のサイドバーを開くと「売主への送信履歴」と表示される → ユーザーが送信対象を誤解する
- **修正後**: 同じ画面を開くと「売主・物件の送信履歴」と表示される → 正しい対象範囲を伝えられる
- **エッジケース**: 送信履歴が0件の場合でも、セクションラベルは「売主・物件の送信履歴」と表示される（「送信履歴はありません」メッセージと共存）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 送信履歴データ（seller_email / seller_sms / seller_gmail）の一覧表示
- 送信履歴が0件の場合の「送信履歴はありません」メッセージ表示
- 履歴アイテムクリック時の詳細モーダル表示
- `propertyNumber` または `refreshTrigger` 変更時の再取得処理
- ローディング中のスピナー表示
- エラー時のアラート表示
- 各履歴アイテムのスタイル・レイアウト

**スコープ:**
セクションラベルのテキスト1箇所のみを変更する。
それ以外のすべての入力・状態・動作はこの修正の影響を受けない。

## Hypothesized Root Cause

1. **テキストリテラルの誤記**: `SellerSendHistory.tsx` の112行目付近の `Typography` コンポーネント内に
   「売主への送信履歴」というテキストがハードコードされており、正しい表記「売主・物件の送信履歴」に
   更新されていなかった。

   ```tsx
   // 現在（誤り）
   <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
     売主への送信履歴
   </Typography>

   // 修正後（正しい）
   <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
     売主・物件の送信履歴
   </Typography>
   ```

2. **他の箇所への影響なし**: このテキストは他のファイルから参照されておらず、
   ロジックや状態管理とは無関係なため、1行の変更で修正が完結する。

## Correctness Properties

Property 1: Bug Condition - セクションラベルの正確な表示

_For any_ `SellerSendHistory` コンポーネントのレンダリングにおいて（`propertyNumber` の値に関わらず）、
修正後のコンポーネントは「売主・物件の送信履歴」というテキストを含むセクションラベルを表示し、
「売主への送信履歴」というテキストを含まない SHALL。

**Validates: Requirements 2.1**

Property 2: Preservation - ラベル以外の既存動作の維持

_For any_ `propertyNumber` および `refreshTrigger` の組み合わせに対して、
修正後のコンポーネントは送信履歴の一覧表示・空メッセージ・詳細モーダル・ローディング・エラー表示など
セクションラベル以外のすべての動作において、修正前のコンポーネントと同一の結果を生成する SHALL。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/SellerSendHistory.tsx`

**Function/Component**: `SellerSendHistory` (return JSX)

**Specific Changes**:

1. **テキストリテラルの変更**: 112行目付近の `Typography` コンポーネント内のテキストを変更する

   ```tsx
   // 変更前
   売主への送信履歴

   // 変更後
   売主・物件の送信履歴
   ```

   変更箇所は1行のみ。それ以外のコード（props、スタイル、ロジック）は一切変更しない。

## Testing Strategy

### Validation Approach

テキストリテラル1箇所の変更であるため、テスト戦略はシンプルに保つ。
修正前のコードでバグ条件が成立することを確認し、修正後に正しいラベルが表示されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで「売主への送信履歴」が表示され、バグ条件が成立することを確認する。

**Test Plan**: `SellerSendHistory` コンポーネントをレンダリングし、セクションラベルのテキストを検査する。
修正前のコードでは `isBugCondition` が `true` を返すことを確認する。

**Test Cases**:
1. **ラベルテキスト確認**: コンポーネントをレンダリングし、「売主への送信履歴」が存在することを確認（修正前は成功、修正後は失敗）
2. **正しいラベル不在確認**: 「売主・物件の送信履歴」が存在しないことを確認（修正前は成功、修正後は失敗）

**Expected Counterexamples**:
- 修正前: `getByText('売主への送信履歴')` が要素を返す
- 修正前: `queryByText('売主・物件の送信履歴')` が `null` を返す

### Fix Checking

**Goal**: 修正後のコンポーネントで正しいラベルが表示されることを検証する。

**Pseudocode:**
```
FOR ALL propertyNumber WHERE SellerSendHistory renders DO
  result := render(<SellerSendHistory propertyNumber={propertyNumber} />)
  ASSERT result contains「売主・物件の送信履歴」
  ASSERT result does NOT contain「売主への送信履歴」
END FOR
```

### Preservation Checking

**Goal**: ラベル以外の動作が修正前後で変わらないことを検証する。

**Pseudocode:**
```
FOR ALL (propertyNumber, refreshTrigger, historyData) DO
  original := render(<SellerSendHistory_original ... />)
  fixed    := render(<SellerSendHistory_fixed ... />)
  ASSERT original.除くラベル部分 = fixed.除くラベル部分
END FOR
```

**Testing Approach**: ラベル変更はレンダリングロジックに影響しないため、
既存の動作テストをそのまま実行して全て通ることを確認する。

**Test Cases**:
1. **履歴一覧の表示**: 複数の履歴アイテムが正しくレンダリングされることを確認
2. **空履歴メッセージ**: 履歴が0件のとき「送信履歴はありません」が表示されることを確認
3. **詳細モーダル**: アイテムクリック時にモーダルが開くことを確認

### Unit Tests

- 修正後のコンポーネントで「売主・物件の送信履歴」ラベルが表示されることを確認
- 修正後のコンポーネントで「売主への送信履歴」ラベルが表示されないことを確認
- 送信履歴データが存在する場合の一覧表示が変わらないことを確認

### Property-Based Tests

- 任意の `propertyNumber`（文字列）に対してラベルが常に「売主・物件の送信履歴」であることを検証
- 任意の履歴データ配列に対して、ラベル以外のレンダリング結果が修正前後で同一であることを検証

### Integration Tests

- 物件リスト詳細画面を開き、サイドバーに「売主・物件の送信履歴」が表示されることを確認
- 送信履歴アイテムをクリックして詳細モーダルが正常に開くことを確認
