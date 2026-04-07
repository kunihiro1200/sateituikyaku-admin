# 買主内覧カレンダー送信バグ修正 設計書

## Overview

買主リストの内覧ページで「📅 カレンダーで開く」ボタンを押した際に、後続担当（営業担当）のGoogleカレンダーに予定を送信せず、送信者自身のカレンダーに予定が作成されてしまうバグを修正する。

売主の訪問予約機能では、営担（visitAssignee）のメールアドレスを取得して`&src=<email>`パラメータをGoogleカレンダーURLに追加することで、営担のカレンダーに予定を送信している。買主の内覧ページでも同じ仕組みを実装する必要がある。

## Glossary

- **Bug_Condition (C)**: カレンダー送信時に後続担当のメールアドレスが指定されていない状態
- **Property (P)**: 後続担当のメールアドレスを`&src=<email>`パラメータで指定し、後続担当のカレンダーに予定を送信する
- **Preservation**: 売主の訪問予約機能のカレンダー送信、内覧日・時間・後続担当の表示、カレンダー送信ボタンの表示条件は変更しない
- **handleCalendarButtonClick**: `BuyerViewingResultPage.tsx`の関数で、Googleカレンダー新規イベント作成URLを開く処理
- **follow_up_assignee**: 買主テーブルの後続担当フィールド（イニシャル形式、例: "Y", "林"）
- **visitAssignee**: 売主テーブルの営担フィールド（フルネームまたはイニシャル）
- **employees**: 従業員マスタテーブル（name, initials, emailを含む）

## Bug Details

### Bug Condition

バグは、買主リストの内覧ページで「📅 カレンダーで開く」ボタンを押した際に発生する。`handleCalendarButtonClick`関数がGoogleカレンダーURLを生成する際に、後続担当のメールアドレスを`&src=<email>`パラメータとして追加していないため、送信者自身のカレンダーに予定が作成される。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyer: Buyer, calendarUrl: string }
  OUTPUT: boolean
  
  RETURN input.buyer.follow_up_assignee IS NOT NULL
         AND input.calendarUrl DOES NOT CONTAIN "&src="
         AND userClickedCalendarButton()
END FUNCTION
```

### Examples

- **例1**: 買主7187の内覧日が2026-04-10、後続担当が"Y"の場合、カレンダー送信ボタンを押すと送信者のカレンダーに予定が作成される（期待: Yさんのカレンダーに送信）
- **例2**: 買主5641の内覧日が2026-04-15、後続担当が"林"の場合、カレンダー送信ボタンを押すと送信者のカレンダーに予定が作成される（期待: 林さんのカレンダーに送信）
- **例3**: 買主9999の内覧日が2026-04-20、後続担当がNULLの場合、カレンダー送信ボタンを押すと送信者のカレンダーに予定が作成される（期待: 送信者のカレンダーに送信、これは正常）
- **エッジケース**: 後続担当のイニシャルが従業員マスタに存在しない場合、エラーメッセージを表示する（期待: 「後続担当（〇〇）が従業員マスタに見つかりません」）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 売主リストの通話モードページで訪問日のカレンダー送信をする際、営担（visitAssignee）のカレンダーに正しく送信される動作は変更しない
- 内覧日・時間・後続担当が設定されている場合、カレンダー送信ボタンが表示される動作は変更しない
- カレンダー送信後にGoogleカレンダーを開く際、送信者のGoogleカレンダーが開かれる動作は変更しない

**Scope:**
後続担当が設定されていない（NULL）場合は、従来通り送信者のカレンダーに予定を作成する。この動作は変更しない。

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **後続担当のメールアドレス取得処理がない**: `handleCalendarButtonClick`関数で、`buyer.follow_up_assignee`から従業員マスタを検索してメールアドレスを取得する処理が実装されていない

2. **&srcパラメータの追加処理がない**: GoogleカレンダーURLに`&src=<email>`パラメータを追加する処理が実装されていない

3. **従業員マスタの取得処理がない**: `BuyerViewingResultPage.tsx`で従業員マスタ（employees）を取得する処理が実装されていない

4. **売主の訪問予約機能との実装の違い**: 売主の`CallModePage.tsx`では営担のメールアドレスを取得して`&src`パラメータを追加しているが、買主の`BuyerViewingResultPage.tsx`では同じ処理が実装されていない

## Correctness Properties

Property 1: Bug Condition - 後続担当のカレンダーに送信

_For any_ 買主で後続担当（follow_up_assignee）が設定されており、内覧日・時間が入力されている場合、「📅 カレンダーで開く」ボタンを押すと、修正後のhandleCalendarButtonClick関数は後続担当のメールアドレスを従業員マスタから取得し、`&src=<email>`パラメータをGoogleカレンダーURLに追加して、後続担当のカレンダーに予定を送信する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 売主の訪問予約機能の動作

_For any_ 売主で訪問日・営担が設定されている場合、修正後も通話モードページのカレンダー送信機能は営担のカレンダーに正しく予定を送信し、内覧日・時間・後続担当の表示、カレンダー送信ボタンの表示条件は変更されない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

売主の訪問予約機能（`CallModePage.tsx`）の実装を参考に、買主の内覧ページ（`BuyerViewingResultPage.tsx`）に同じ仕組みを実装する。

**File**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

**Function**: `handleCalendarButtonClick`

**Specific Changes**:
1. **従業員マスタの取得**: ページ読み込み時に従業員マスタ（employees）を取得する処理を追加
   - `/api/employees`エンドポイントから従業員一覧を取得
   - `useState`で`employees`を管理

2. **後続担当のメールアドレス取得**: `handleCalendarButtonClick`関数内で、`buyer.follow_up_assignee`から従業員マスタを検索してメールアドレスを取得
   - `employees.find()`で`initials`または`name`が一致する従業員を検索
   - 見つかった従業員の`email`を取得

3. **&srcパラメータの追加**: GoogleカレンダーURLに`&src=<email>`パラメータを追加
   - `const srcParam = assignedEmail ? `&src=${encodeURIComponent(assignedEmail)}` : '';`
   - `window.open(\`https://calendar.google.com/calendar/render?${params.toString()}${srcParam}\`, '_blank');`

4. **エラーハンドリング**: 後続担当のイニシャルが従業員マスタに存在しない場合、エラーメッセージを表示
   - `setSnackbar({ open: true, message: '後続担当（〇〇）が従業員マスタに見つかりません', severity: 'error' });`

5. **成功メッセージの更新**: カレンダー送信後のメッセージを「後続担当（〇〇）のGoogleカレンダーに内覧予約を登録しました」に変更
   - `handleCalendarConfirm`関数内で、後続担当の名前を含むメッセージを表示

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従う：まず、未修正コードでバグを再現する探索的テストを実行し、次に修正後のコードで正しく動作することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。根本原因分析が正しいか確認し、間違っている場合は再仮説を立てる。

**Test Plan**: 買主リストの内覧ページで、後続担当が設定されている買主のカレンダー送信ボタンを押し、送信者のカレンダーに予定が作成されることを確認する。未修正コードで実行してバグを観察する。

**Test Cases**:
1. **買主7187のカレンダー送信**: 後続担当が"Y"の場合、カレンダー送信ボタンを押すと送信者のカレンダーに予定が作成される（未修正コードで失敗）
2. **買主5641のカレンダー送信**: 後続担当が"林"の場合、カレンダー送信ボタンを押すと送信者のカレンダーに予定が作成される（未修正コードで失敗）
3. **後続担当がNULLの場合**: 後続担当がNULLの場合、カレンダー送信ボタンを押すと送信者のカレンダーに予定が作成される（未修正コードで成功、これは正常）
4. **後続担当が従業員マスタに存在しない場合**: 後続担当のイニシャルが従業員マスタに存在しない場合、エラーメッセージが表示される（未修正コードでは何も起きない）

**Expected Counterexamples**:
- GoogleカレンダーURLに`&src=`パラメータが含まれていない
- 後続担当のカレンダーに予定が送信されず、送信者のカレンダーに予定が作成される
- Possible causes: 後続担当のメールアドレス取得処理がない、&srcパラメータの追加処理がない

### Fix Checking

**Goal**: バグ条件を満たす全ての入力に対して、修正後の関数が期待される動作をすることを検証する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := handleCalendarButtonClick_fixed(buyer)
  ASSERT result.calendarUrl CONTAINS "&src=" + assignedEmail
  ASSERT result.message CONTAINS "後続担当（" + assignedName + "）のGoogleカレンダーに内覧予約を登録しました"
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての入力に対して、修正後の関数が元の関数と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleCalendarButtonClick_original(input) = handleCalendarButtonClick_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは保存チェックに推奨される。なぜなら：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動ユニットテストが見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 未修正コードで売主の訪問予約機能、内覧日・時間・後続担当の表示、カレンダー送信ボタンの表示条件の動作を観察し、その動作をキャプチャするProperty-based testを書く。

**Test Cases**:
1. **売主の訪問予約機能の保存**: 未修正コードで売主の通話モードページのカレンダー送信が正しく動作することを確認し、修正後も同じ動作をすることをテストで検証
2. **内覧日・時間・後続担当の表示の保存**: 未修正コードで内覧日・時間・後続担当が正しく表示されることを確認し、修正後も同じ表示をすることをテストで検証
3. **カレンダー送信ボタンの表示条件の保存**: 未修正コードでカレンダー送信ボタンが正しい条件で表示されることを確認し、修正後も同じ条件で表示されることをテストで検証

### Unit Tests

- 後続担当が設定されている場合、従業員マスタから正しくメールアドレスを取得できることをテスト
- 後続担当のイニシャルが従業員マスタに存在しない場合、エラーメッセージが表示されることをテスト
- 後続担当がNULLの場合、&srcパラメータが追加されないことをテスト
- GoogleカレンダーURLに&srcパラメータが正しく追加されることをテスト

### Property-Based Tests

- ランダムな買主データを生成し、後続担当が設定されている場合は&srcパラメータが追加されることを検証
- ランダムな従業員マスタを生成し、後続担当のイニシャルから正しくメールアドレスを取得できることを検証
- 多くのシナリオで売主の訪問予約機能が引き続き正しく動作することをテスト

### Integration Tests

- 買主リストの内覧ページで、後続担当が設定されている買主のカレンダー送信ボタンを押し、後続担当のカレンダーに予定が送信されることをテスト
- 売主リストの通話モードページで、営担が設定されている売主のカレンダー送信ボタンを押し、営担のカレンダーに予定が送信されることをテスト
- カレンダー送信後、成功メッセージが正しく表示されることをテスト
