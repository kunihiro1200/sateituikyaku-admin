# property-email-reply-to-default-fix Bugfix Design

## Overview

物件リスト詳細画面（PropertyListingDetailPage）のEmail送信ダイアログで、返信先（Reply-To）のデフォルト値が物件担当者のメールアドレスに設定されないバグを修正する。

根本原因は、`handleOpenEmailDialog` / `handleSelectPropertyEmailTemplate` が呼ばれた時点で `jimuStaff.find()` を直接実行しているが、`jimuStaff` は非同期取得のため空配列のまま `find()` が実行され、常に `undefined` → 空欄になることにある。

修正方針は `PropertyReportPage` と同様に、`emailDialog.open` が `true` になったときに `useEffect` で `replyTo` を設定する方式に変更する。

## Glossary

- **Bug_Condition (C)**: `handleOpenEmailDialog` または `handleSelectPropertyEmailTemplate` が呼ばれた時点で `jimuStaff` が空配列であり、`find()` が `undefined` を返す条件
- **Property (P)**: `emailDialog.open` が `true` かつ `jimuStaff.length > 0` のとき、`sales_assignee` に対応するスタッフのメールアドレスが `replyTo` に設定されること
- **Preservation**: 既存のマウスクリック操作・テンプレート選択・送信完了後リセット等の動作が変更後も継続すること
- **handleOpenEmailDialog**: `PropertyListingDetailPage.tsx` の関数。メール送信ダイアログを開く際に呼ばれる
- **handleSelectPropertyEmailTemplate**: `PropertyListingDetailPage.tsx` の関数。テンプレートを選択してダイアログを開く際に呼ばれる
- **jimuStaff**: 事務ありスタッフ一覧。`/api/employees/jimu-staff` から非同期取得される
- **emailDialog.open**: メール送信ダイアログの開閉状態を管理するフラグ
- **replyTo**: 返信先メールアドレスの選択状態

## Bug Details

### Bug Condition

バグは `handleOpenEmailDialog` または `handleSelectPropertyEmailTemplate` が呼ばれた時点で `jimuStaff` がまだ空配列の場合に発生する。これらの関数内で `jimuStaff.find()` を直接実行しているため、非同期取得が完了していない場合は常に `undefined` が返り、返信先が空欄になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { dialogOpenEvent: 'handleOpenEmailDialog' | 'handleSelectPropertyEmailTemplate', jimuStaffAtCallTime: Array }
  OUTPUT: boolean

  RETURN input.dialogOpenEvent IN ['handleOpenEmailDialog', 'handleSelectPropertyEmailTemplate']
         AND input.jimuStaffAtCallTime.length === 0
         AND replyTo IS SET TO ''
END FUNCTION
```

### Examples

- **例1（バグあり）**: ページ読み込み直後にメール送信ボタンを押す → `jimuStaff` が空配列 → `find()` が `undefined` → 返信先が空欄
- **例2（バグあり）**: テンプレートメニューからテンプレートを選択する → 同様に `jimuStaff` が空配列 → 返信先が空欄
- **例3（正常）**: `jimuStaff` 取得完了後にダイアログを開く → `find()` が正しく動作 → 返信先に担当者メールが設定される（ただし現状はタイミング依存で不安定）
- **エッジケース**: `sales_assignee` に対応するスタッフが `jimuStaff` に存在しない場合 → 返信先は空欄のまま（正常動作）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- ユーザーが返信先ドロップダウンで別のスタッフを手動選択した場合、その選択が使用されること
- `sales_assignee` に対応するスタッフが `jimuStaff` に存在しない場合、返信先が空欄のままであること
- メール送信完了またはキャンセル時に `replyTo` がリセットされること
- `handleSelectPropertyEmailTemplate` でテンプレートを選択した際、テンプレートの件名・本文が正しく設定されること

**スコープ:**
メール送信ダイアログの返信先デフォルト設定ロジック以外は一切変更しない。具体的には以下は影響を受けない:
- メール送信ダイアログのUI構造
- テンプレート選択・プレースホルダー置換ロジック
- 送信処理（`handleSendEmail`）
- `jimuStaff` の取得ロジック（`fetchJimuStaff`）

## Hypothesized Root Cause

バグの根本原因は以下の通り:

1. **非同期取得タイミングの問題**: `jimuStaff` は `useEffect` 内の `fetchJimuStaff()` で非同期取得されるが、`handleOpenEmailDialog` / `handleSelectPropertyEmailTemplate` はその完了を待たずに `jimuStaff.find()` を実行している

2. **同期的な参照**: ダイアログを開く関数内で `jimuStaff` を直接参照しているため、関数呼び出し時点の `jimuStaff` の値（空配列）が使われる

3. **`PropertyReportPage` との実装差異**: `PropertyReportPage` では `sendConfirmDialogOpen` が `true` になったタイミングで `useEffect` を使って `replyTo` を設定しており、`jimuStaff` が後から取得されても正しく動作する。`PropertyListingDetailPage` にはこのパターンが適用されていない

## Correctness Properties

Property 1: Bug Condition - emailDialog.open時の返信先デフォルト設定

_For any_ 状態において `emailDialog.open` が `true` かつ `jimuStaff.length > 0` である場合、修正後の実装は `data.sales_assignee` に対応する `jimuStaff` のメールアドレスを `replyTo` のデフォルト値として設定しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非ダイアログ操作の動作保持

_For any_ 操作において `emailDialog.open` が `false` である場合、または返信先ドロップダウンでユーザーが手動選択した場合、修正後の実装は元の実装と同一の動作を保持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

**Specific Changes**:

1. **`handleOpenEmailDialog` から `replyTo` 設定ロジックを削除**:
   ```typescript
   // 削除する行
   const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);
   setReplyTo(matchedStaff?.email || '');
   ```

2. **`handleSelectPropertyEmailTemplate` から `replyTo` 設定ロジックを削除**:
   ```typescript
   // 削除する行
   const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);
   setReplyTo(matchedStaff?.email || '');
   ```

3. **`emailDialog.open` を監視する `useEffect` を追加**（`PropertyReportPage` と同パターン）:
   ```typescript
   // emailDialog.open が true になったとき、sales_assignee に対応するスタッフのメールをデフォルト設定
   useEffect(() => {
     if (emailDialog.open && jimuStaff.length > 0) {
       const matchedStaff = jimuStaff.find((s) => s.initials === data?.sales_assignee);
       setReplyTo(matchedStaff?.email || '');
     }
   }, [emailDialog.open, jimuStaff, data?.sales_assignee]);
   ```

**追加場所**: `PropertyReportPage` の参考実装と同様に、`fetchJimuStaff` 関数の近くに配置する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される: まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `jimuStaff` が空配列の状態で `handleOpenEmailDialog` を呼び出し、`replyTo` が空欄のままであることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **jimuStaff空配列テスト**: `jimuStaff = []` の状態で `handleOpenEmailDialog` を呼び出す → `replyTo` が空欄のまま（未修正コードで失敗）
2. **jimuStaff取得後テスト**: `jimuStaff` に有効なスタッフが存在する状態で `handleOpenEmailDialog` を呼び出す → `replyTo` が設定されるべきだが、タイミング依存で不安定（未修正コードで不安定）
3. **テンプレート選択テスト**: `jimuStaff = []` の状態で `handleSelectPropertyEmailTemplate` を呼び出す → `replyTo` が空欄のまま（未修正コードで失敗）
4. **エッジケーステスト**: `sales_assignee` が `jimuStaff` に存在しないイニシャルの場合 → `replyTo` が空欄（正常動作）

**Expected Counterexamples**:
- `jimuStaff` が空配列の場合、`replyTo` が設定されない
- 原因: ダイアログを開く関数内で同期的に `jimuStaff.find()` を実行しているため

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待通りの動作をすることを検証する。

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition(state) DO
  // emailDialog.openをtrueに設定
  // jimuStaffが取得済みになるまで待機
  result := useEffect triggered by (emailDialog.open, jimuStaff)
  ASSERT replyTo === matchedStaff.email
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が元の関数と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL state WHERE NOT isBugCondition(state) DO
  ASSERT original_behavior(state) === fixed_behavior(state)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由:
- 多様なスタッフ構成・`sales_assignee` の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存動作が変更されていないことを強く保証できる

**Test Cases**:
1. **手動選択保持テスト**: ユーザーがドロップダウンで別スタッフを選択した後、その選択が維持されることを確認
2. **リセット動作テスト**: 送信完了・キャンセル後に `replyTo` が空欄にリセットされることを確認
3. **テンプレート内容保持テスト**: `handleSelectPropertyEmailTemplate` でテンプレートの件名・本文が正しく設定されることを確認
4. **対応スタッフなしテスト**: `sales_assignee` に対応するスタッフが存在しない場合、`replyTo` が空欄のままであることを確認

### Unit Tests

- `emailDialog.open` が `true` になったとき `useEffect` が `replyTo` を正しく設定することをテスト
- `jimuStaff` が空配列の場合は `replyTo` が設定されないことをテスト
- `sales_assignee` に対応するスタッフが存在しない場合は `replyTo` が空欄のままであることをテスト

### Property-Based Tests

- ランダムな `jimuStaff` 配列と `sales_assignee` の組み合わせを生成し、`emailDialog.open` が `true` になったとき正しいメールアドレスが設定されることを検証
- ランダムなユーザー操作シナリオを生成し、手動選択が `useEffect` によって上書きされないことを検証
- 多様な `sales_assignee` 値（存在するイニシャル・存在しないイニシャル・空文字列）に対して正しい動作を検証

### Integration Tests

- ページ読み込み直後（`jimuStaff` 取得前）にダイアログを開き、取得完了後に `replyTo` が正しく設定されることを確認
- テンプレート選択からダイアログ表示までのフロー全体で `replyTo` が正しく設定されることを確認
- 送信完了後に再度ダイアログを開いた場合、`replyTo` が再度正しくデフォルト設定されることを確認
