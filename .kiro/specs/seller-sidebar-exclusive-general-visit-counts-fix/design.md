# 売主サイドバー「専任」「一般」「訪問後他決」カテゴリのカウント数不一致修正 デザイン

## Overview

売主リストのサイドバーで「専任」「一般」「訪問後他決」の3つのカテゴリにおいて、サイドバーに表示されるカウント数と、カテゴリをクリックして一覧を開いたときのカウント数が一致していない問題を修正します。

この問題は、フロントエンドのフィルター関数が「次電日が今日以前ではない」という条件を使用しているため、次電日が今日の売主を含んでしまっていることが原因です。GASとバックエンドは「次電日が今日ではない」という条件で一致していますが、フロントエンドだけが異なる条件を使用しています。

昨日修正した「未訪問他決」カテゴリと全く同じパターンの問題です。

## Glossary

- **Bug_Condition (C)**: フロントエンドのフィルター関数が `isTodayOrBefore(nextCallDate)` を否定しているため、次電日が今日の売主を含んでしまう条件
- **Property (P)**: フロントエンドのフィルター関数が、GASとバックエンドと同じ「次電日が今日ではない」という条件を使用すること
- **Preservation**: 他のカテゴリ（「当日TEL分」「未訪問他決」など）のカウントとフィルタリング結果が正しく一致し続けること
- **isExclusive**: `frontend/frontend/src/utils/sellerStatusFilters.ts` の専任カテゴリ判定関数
- **isGeneral**: `frontend/frontend/src/utils/sellerStatusFilters.ts` の一般カテゴリ判定関数
- **isVisitOtherDecision**: `frontend/frontend/src/utils/sellerStatusFilters.ts` の訪問後他決カテゴリ判定関数
- **isTodayOrBefore**: 日付が今日以前かどうかを判定する関数（JST基準、文字列比較）
- **getTodayJSTString**: 日本時間（JST）で今日の日付文字列を取得する関数（YYYY-MM-DD形式）
- **normalizeDateString**: 日付文字列を正規化する関数（YYYY-MM-DD形式に変換）

## Bug Details

### Bug Condition

バグは、フロントエンドのフィルター関数（`isExclusive`、`isGeneral`、`isVisitOtherDecision`）が `isTodayOrBefore(nextCallDate)` を否定して「次電日が今日以前ではない」という条件を使用しているときに発生します。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean
  
  LET nextCallDate = seller.nextCallDate OR seller.next_call_date
  LET todayStr = getTodayJSTString()
  LET normalizedNextCallDate = normalizeDateString(nextCallDate)
  
  // バグ条件: 次電日が今日の場合
  RETURN normalizedNextCallDate = todayStr
         AND (seller.status IN ("専任媒介", "他決→専任", "リースバック（専任）", "一般媒介", "他決→追客", "他決→追客不要", "一般→他決", "他社買取"))
         AND seller.exclusiveOtherDecisionMeeting ≠ "完了"
END FUNCTION
```

### Examples

**例1: 専任カテゴリ（次電日が今日）**
- 売主番号: AA13501
- 状況（当社）: "専任媒介"
- 次電日: "2026-04-03"（今日）
- 専任他決打合せ: ""（空欄）
- **期待される動作**: サイドバーのカウントに含まれない、フィルタリング結果にも含まれない
- **実際の動作**: サイドバーのカウントには含まれないが、フィルタリング結果には含まれる（不一致）

**例2: 一般カテゴリ（次電日が今日）**
- 売主番号: AA13502
- 状況（当社）: "一般媒介"
- 次電日: "2026-04-03"（今日）
- 契約年月: "2025-07-01"
- 専任他決打合せ: ""（空欄）
- **期待される動作**: サイドバーのカウントに含まれない、フィルタリング結果にも含まれない
- **実際の動作**: サイドバーのカウントには含まれないが、フィルタリング結果には含まれる（不一致）

**例3: 訪問後他決カテゴリ（次電日が今日）**
- 売主番号: AA13503
- 状況（当社）: "他決→追客"
- 次電日: "2026-04-03"（今日）
- 営担: "Y"
- 専任他決打合せ: ""（空欄）
- **期待される動作**: サイドバーのカウントに含まれない、フィルタリング結果にも含まれない
- **実際の動作**: サイドバーのカウントには含まれないが、フィルタリング結果には含まれる（不一致）

**例4: 次電日が明日（正常動作）**
- 売主番号: AA13504
- 状況（当社）: "専任媒介"
- 次電日: "2026-04-04"（明日）
- 専任他決打合せ: ""（空欄）
- **期待される動作**: サイドバーのカウントに含まれる、フィルタリング結果にも含まれる
- **実際の動作**: サイドバーのカウントに含まれる、フィルタリング結果にも含まれる（一致）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のカテゴリ（「当日TEL分」「未訪問他決」など）のカウント数とフィルタリング結果が正しく一致し続けること
- 「専任」「一般」「訪問後他決」カテゴリの基本条件（専任他決打合せ、状況、営担など）が変更されないこと
- GASとバックエンドのカウントロジックが変更されないこと

**Scope:**
次電日が今日ではない売主（次電日が空、または次電日が今日より前/後）は、この修正の影響を受けません。これには以下が含まれます：
- 次電日が空の売主
- 次電日が昨日以前の売主
- 次電日が明日以降の売主

## Hypothesized Root Cause

バグ修正要件書に記載されている根本原因の分析に基づき、以下の原因が特定されています：

1. **フロントエンドの条件が間違っている**: フロントエンドの3つのフィルター関数（`isExclusive`、`isGeneral`、`isVisitOtherDecision`）が `isTodayOrBefore(nextCallDate)` を否定しているため、「次電日が今日以前ではない」= 「次電日が今日より後」という条件になり、今日を含んでしまっている

2. **GASとバックエンドの条件は正しい**:
   - **GAS**: `nextCallDate !== todayStr`（次電日が今日ではない）
   - **バックエンド**: `.gt('next_call_date', todayJST)`（次電日が今日より大きい = 今日を除外）

3. **フロントエンドだけが異なる条件を使用**: フロントエンドだけが `isTodayOrBefore(nextCallDate)` を使用しているため、GASとバックエンドと条件が一致していない

## Correctness Properties

Property 1: Bug Condition - 次電日が今日の売主を除外

_For any_ 売主において、次電日が今日の場合、フロントエンドのフィルター関数（`isExclusive`、`isGeneral`、`isVisitOtherDecision`）は false を返し、その売主をカウントとフィルタリング結果から除外すること。これにより、GASとバックエンドのカウントと一致する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 他のカテゴリの動作

_For any_ 売主において、次電日が今日ではない場合（次電日が空、または次電日が今日より前/後）、フロントエンドのフィルター関数は元の動作を維持し、他のカテゴリ（「当日TEL分」「未訪問他決」など）のカウントとフィルタリング結果が正しく一致し続けること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると、以下の変更が必要です：

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function 1**: `isExclusive`（専任カテゴリ判定）

**Specific Changes**:
1. **次電日の条件を修正**: `isTodayOrBefore(nextCallDate)` を使用する代わりに、`normalizeDateString(nextCallDate) === todayStr` で今日を除外する
   - 修正前: `if (isTodayOrBefore(nextCallDate)) { return false; }`
   - 修正後: `if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) { return false; }`

**Function 2**: `isGeneral`（一般カテゴリ判定）

**Specific Changes**:
1. **次電日の条件を修正**: `isTodayOrBefore(nextCallDate)` を使用する代わりに、`normalizeDateString(nextCallDate) === todayStr` で今日を除外する
   - 修正前: `if (isTodayOrBefore(nextCallDate)) { return false; }`
   - 修正後: `if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) { return false; }`

**Function 3**: `isVisitOtherDecision`（訪問後他決カテゴリ判定）

**Specific Changes**:
1. **次電日の条件を修正**: `isTodayOrBefore(nextCallDate)` を使用する代わりに、`normalizeDateString(nextCallDate) === todayStr` で今日を除外する
   - 修正前: `if (isTodayOrBefore(nextCallDate)) { return false; }`
   - 修正後: `if (!normalizedNextCallDate || normalizedNextCallDate === todayStr) { return false; }`

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する反例を表面化させ、次に修正が正しく動作し、既存の動作を保持することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、バグを実証する反例を表面化させる。根本原因分析を確認または反証する。反証した場合は、再仮説が必要。

**Test Plan**: 次電日が今日の売主をテストデータとして作成し、フロントエンドのフィルター関数が true を返すこと（バグ）を確認する。修正前のコードで実行して、失敗を観察し、根本原因を理解する。

**Test Cases**:
1. **専任カテゴリ（次電日が今日）**: 次電日が今日の専任媒介売主を作成し、`isExclusive` が true を返すことを確認（修正前のコードで失敗）
2. **一般カテゴリ（次電日が今日）**: 次電日が今日の一般媒介売主を作成し、`isGeneral` が true を返すことを確認（修正前のコードで失敗）
3. **訪問後他決カテゴリ（次電日が今日）**: 次電日が今日の他決→追客売主を作成し、`isVisitOtherDecision` が true を返すことを確認（修正前のコードで失敗）
4. **次電日が明日**: 次電日が明日の専任媒介売主を作成し、`isExclusive` が true を返すことを確認（修正前のコードで成功）

**Expected Counterexamples**:
- 次電日が今日の売主が、フロントエンドのフィルター関数で true を返す（バグ）
- 可能な原因: `isTodayOrBefore(nextCallDate)` を否定しているため、今日を含んでしまう

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result_exclusive := isExclusive_fixed(seller)
  result_general := isGeneral_fixed(seller)
  result_visitOtherDecision := isVisitOtherDecision_fixed(seller)
  ASSERT result_exclusive = false
  ASSERT result_general = false
  ASSERT result_visitOtherDecision = false
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT isExclusive_original(seller) = isExclusive_fixed(seller)
  ASSERT isGeneral_original(seller) = isGeneral_fixed(seller)
  ASSERT isVisitOtherDecision_original(seller) = isVisitOtherDecision_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストは、保存チェックに推奨されます。理由：
- 入力ドメイン全体で多くのテストケースを自動的に生成する
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないという強力な保証を提供する

**Test Plan**: 修正前のコードで、次電日が今日ではない売主の動作を観察し、その動作をキャプチャするプロパティベーステストを作成する。

**Test Cases**:
1. **次電日が空の売主**: 次電日が空の売主が、修正前と修正後で同じ結果を返すことを確認
2. **次電日が昨日以前の売主**: 次電日が昨日以前の売主が、修正前と修正後で同じ結果を返すことを確認
3. **次電日が明日以降の売主**: 次電日が明日以降の売主が、修正前と修正後で同じ結果を返すことを確認
4. **他のカテゴリ**: 「当日TEL分」「未訪問他決」などの他のカテゴリが、修正前と修正後で同じ結果を返すことを確認

### Unit Tests

- 次電日が今日の売主をテストデータとして作成し、フィルター関数が false を返すことを確認
- 次電日が明日の売主をテストデータとして作成し、フィルター関数が true を返すことを確認
- 次電日が空の売主をテストデータとして作成し、フィルター関数が false を返すことを確認
- エッジケース（次電日が昨日、次電日が1年後など）をテスト

### Property-Based Tests

- ランダムな売主データを生成し、次電日が今日の売主がフィルター関数で false を返すことを検証
- ランダムな売主データを生成し、次電日が今日ではない売主が修正前と修正後で同じ結果を返すことを検証
- 多くのシナリオで、他のカテゴリのフィルター関数が正しく動作し続けることをテスト

### Integration Tests

- ブラウザで売主リストページを開き、サイドバーのカウント数を確認
- 「専任」カテゴリをクリックし、フィルタリング結果の件数がサイドバーのカウント数と一致することを確認
- 「一般」カテゴリをクリックし、フィルタリング結果の件数がサイドバーのカウント数と一致することを確認
- 「訪問後他決」カテゴリをクリックし、フィルタリング結果の件数がサイドバーのカウント数と一致することを確認
- 次電日が今日の売主が、フィルタリング結果に含まれないことを確認
