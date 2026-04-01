# Implementation Plan

## Phase 1: Bug Condition Exploration（最優先）

### 1. Write bug condition exploration test

- **Property 1: Bug Condition** - 営業担当「外す」が空欄扱いされるバグ
- **CRITICAL**: Write this property-based test BEFORE implementing the fix
- **GOAL**: Surface counterexamples that demonstrate the bug exists
- **Scoped PBT Approach**: Scope the property to concrete failing case(s) to ensure reproducibility

#### 1.1 AA9484テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-bug-exploration.ts`
- **目的**: 営担が「外す」の売主（AA9484）が「未訪問他決」に分類されることを確認（バグの実証）
- **テストケース**:
  - 営業担当: 「外す」
  - 状況（当社）: 「他決→追客」
  - 次電日: 今日ではない
  - 専任他決打合せ: 「完了」ではない
- **期待される結果**: 「未訪問他決」に分類される（バグ）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
- Document counterexamples found to understand root cause
- Mark task complete when test is written, run, and failure is documented
- _Requirements: 1.1, 1.2, 1.3, 1.4_

#### 1.2 GAS判定テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-bug-exploration.ts`（同じファイルに追加）
- **目的**: `isVisitAssigneeValid` が「外す」の場合に `false` を返すことを確認（バグの実証）
- **テストケース**:
  - 営業担当: 「外す」
  - 期待される結果: `isVisitAssigneeValid = false`（バグ）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
- _Requirements: 1.1_

#### 1.3 バックエンド同期テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-bug-exploration.ts`（同じファイルに追加）
- **目的**: 「外す」が `null` に変換されることを確認（バグの実証）
- **テストケース**:
  - スプレッドシートの営業担当: 「外す」
  - 期待される結果: データベースに `null` として保存される（バグ）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
- _Requirements: 1.2_

#### 1.4 フロントエンドフィルタテストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-bug-exploration.ts`（同じファイルに追加）
- **目的**: `hasVisitAssignee()` が「外す」の場合に `false` を返すことを確認（バグの実証）
- **テストケース**:
  - 営業担当: 「外す」
  - 期待される結果: `hasVisitAssignee() = false`（バグ）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
- _Requirements: 1.4_

---

## Phase 2: Preservation Property Tests（修正前に実行）

### 2. Write preservation property tests (BEFORE implementing fix)

- **Property 2: Preservation** - 他の値（空欄、null、有効なイニシャル）の動作が変更されないことを検証
- **IMPORTANT**: Follow observation-first methodology
- **Observe behavior on UNFIXED code for non-buggy inputs**
- Write property-based tests capturing observed behavior patterns from Preservation Requirements
- Property-based testing generates many test cases for stronger guarantees
- Verify tests PASS on UNFIXED code
- **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
- Mark task complete when tests are written, run, and passing on unfixed code

#### 2.1 空欄保存テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`
- **目的**: 営担が空欄（`''`）の売主が引き続き「未訪問他決」に分類されることを検証
- **テストケース**:
  - 営業担当: `''`（空欄）
  - 状況（当社）: 「他決→追客」
  - 次電日: 今日ではない
  - 専任他決打合せ: 「完了」ではない
- **期待される結果**: 「未訪問他決」に分類される（正しい）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test PASSES (this confirms baseline behavior)
- _Requirements: 3.1_

#### 2.2 null保存テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`（同じファイルに追加）
- **目的**: 営担が `null` の売主が引き続き「未訪問他決」に分類されることを検証
- **テストケース**:
  - 営業担当: `null`
  - 状況（当社）: 「他決→追客」
  - 次電日: 今日ではない
  - 専任他決打合せ: 「完了」ではない
- **期待される結果**: 「未訪問他決」に分類される（正しい）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test PASSES (this confirms baseline behavior)
- _Requirements: 3.2_

#### 2.3 有効なイニシャル保存テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`（同じファイルに追加）
- **目的**: 営担が有効なイニシャル（`'Y'`, `'I'`, `'K'`等）の売主が引き続き「訪問後他決」に分類されることを検証
- **テストケース**:
  - 営業担当: `'Y'`（有効なイニシャル）
  - 状況（当社）: 「他決→追客」
  - 次電日: 今日ではない
  - 専任他決打合せ: 「完了」ではない
- **期待される結果**: 「訪問後他決」に分類される（正しい）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test PASSES (this confirms baseline behavior)
- _Requirements: 3.3_

#### 2.4 他の条件保存テストスクリプトを作成

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`（同じファイルに追加）
- **目的**: サイドバーカテゴリの他の条件（状況、次電日、専任他決打合せ等）が引き続き正しく判定されることを検証
- **テストケース**:
  - 営業担当: 「外す」
  - 状況（当社）: 「追客中」（他決以外）
  - 次電日: 今日
- **期待される結果**: 「当日TEL分」に分類される（正しい）
- **Run test on UNFIXED code**
- **EXPECTED OUTCOME**: Test PASSES (this confirms baseline behavior)
- _Requirements: 3.4_

---

## Phase 3: Fix Implementation

### 3. Fix for 営業担当「外す」有効値修正

#### 3.1 Implement the fix

##### 3.1.1 GAS（gas_complete_code.js）の695行目を修正

- **ファイル**: `gas_complete_code.js`
- **行番号**: 695行目
- **修正内容**: `&& visitAssignee !== '外す'` を削除
- **修正前**: `var isVisitAssigneeValid = visitAssignee && visitAssignee !== '' && visitAssignee !== '外す';`
- **修正後**: `var isVisitAssigneeValid = visitAssignee && visitAssignee !== '';`
- _Bug_Condition: isBugCondition(input) where input.visit_assignee = '外す'_
- _Expected_Behavior: expectedBehavior(result) from design - 「外す」を有効な値として扱う_
- _Preservation: Preservation Requirements from design - 空欄、null、有効なイニシャルの扱いは変更しない_
- _Requirements: 2.1_

##### 3.1.2 バックエンド（EnhancedAutoSyncService.ts）の797行目を修正

- **ファイル**: `backend/src/services/EnhancedAutoSyncService.ts`
- **行番号**: 797行目
- **修正内容**: `rawSheetVisitAssignee === '外す'` の条件を削除
- **修正前**: `const sheetVisitAssignee = (rawSheetVisitAssignee === '外す' || rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);`
- **修正後**: `const sheetVisitAssignee = (rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);`
- _Bug_Condition: isBugCondition(input) where input.visit_assignee = '外す'_
- _Expected_Behavior: expectedBehavior(result) from design - 「外す」を `null` に変換しない_
- _Preservation: Preservation Requirements from design - 空欄は `null` に変換する_
- _Requirements: 2.2_

##### 3.1.3 バックエンド（EnhancedAutoSyncService.ts）の1293行目、1594行目を修正

- **ファイル**: `backend/src/services/EnhancedAutoSyncService.ts`
- **行番号**: 1293行目、1594行目
- **修正内容**: `visitAssignee === '外す'` の条件を削除
- **修正前**: `if (visitAssignee === '外す' || visitAssignee === '') { updateData.visit_assignee = null; }`
- **修正後**: `if (visitAssignee === '') { updateData.visit_assignee = null; }`
- _Bug_Condition: isBugCondition(input) where input.visit_assignee = '外す'_
- _Expected_Behavior: expectedBehavior(result) from design - 「外す」を `null` に変換しない_
- _Preservation: Preservation Requirements from design - 空欄は `null` に変換する_
- _Requirements: 2.2_

##### 3.1.4 バックエンド（SellerService.supabase.ts）の1051行目、1099行目を修正

- **ファイル**: `backend/src/services/SellerService.supabase.ts`
- **行番号**: 1051行目、1099行目
- **修正内容**: `.neq('visit_assignee', '外す')` を削除
- **修正前**: `.neq('visit_assignee', '外す')`
- **修正後**: （この行を削除）
- _Bug_Condition: isBugCondition(input) where input.visit_assignee = '外す'_
- _Expected_Behavior: expectedBehavior(result) from design - 「外す」の売主をサイドバーカウントに含める_
- _Preservation: Preservation Requirements from design - 空欄、null、有効なイニシャルの売主のカウントは変更しない_
- _Requirements: 2.3_

##### 3.1.5 フロントエンド（sellerStatusFilters.ts）の203行目を修正

- **ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`
- **行番号**: 203行目
- **修正内容**: `|| visitAssignee.trim() === '外す'` を削除
- **修正前**: `if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') { return false; }`
- **修正後**: `if (!visitAssignee || visitAssignee.trim() === '') { return false; }`
- _Bug_Condition: isBugCondition(input) where input.visit_assignee = '外す'_
- _Expected_Behavior: expectedBehavior(result) from design - `hasVisitAssignee()` が `true` を返す_
- _Preservation: Preservation Requirements from design - 空欄の場合は `false` を返す_
- _Requirements: 2.4_

##### 3.1.6 フロントエンド（sellerStatusFilters.ts）の678行目、922行目、938行目、989行目を修正

- **ファイル**: `frontend/frontend/src/utils/sellerStatusFilters.ts`
- **行番号**: 678行目、922行目、938行目、989行目
- **修正内容**: `&& visitAssignee.trim() !== '外す'` を削除
- **修正前**: `if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') { ... }`
- **修正後**: `if (!visitAssignee || visitAssignee.trim() === '') { ... }`
- _Bug_Condition: isBugCondition(input) where input.visit_assignee = '外す'_
- _Expected_Behavior: expectedBehavior(result) from design - 「外す」を有効な値として扱う_
- _Preservation: Preservation Requirements from design - 空欄の扱いは変更しない_
- _Requirements: 2.4_

#### 3.2 Verify bug condition exploration test now passes

- **Property 1: Expected Behavior** - 営業担当「外す」を有効な値として扱う
- **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
- The test from task 1 encodes the expected behavior
- When this test passes, it confirms the expected behavior is satisfied
- Run bug condition exploration test from step 1
- **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
- _Requirements: Expected Behavior Properties from design - 2.1, 2.2, 2.3, 2.4_

##### 3.2.1 AA9484テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-fix-checking.ts`
- **目的**: 修正後、営担が「外す」の売主（AA9484）が「訪問後他決」に分類されることを確認
- **テストケース**:
  - 営業担当: 「外す」
  - 状況（当社）: 「他決→追客」
  - 次電日: 今日ではない
  - 専任他決打合せ: 「完了」ではない
- **期待される結果**: 「訪問後他決」に分類される（修正後）
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
- _Requirements: 2.1, 2.2, 2.3, 2.4_

##### 3.2.2 GAS判定テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-fix-checking.ts`（同じファイルに追加）
- **目的**: 修正後、`isVisitAssigneeValid` が「外す」の場合に `true` を返すことを確認
- **テストケース**:
  - 営業担当: 「外す」
  - 期待される結果: `isVisitAssigneeValid = true`（修正後）
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
- _Requirements: 2.1_

##### 3.2.3 バックエンド同期テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-fix-checking.ts`（同じファイルに追加）
- **目的**: 修正後、「外す」が保持されることを確認
- **テストケース**:
  - スプレッドシートの営業担当: 「外す」
  - 期待される結果: データベースに「外す」として保存される（修正後）
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
- _Requirements: 2.2_

##### 3.2.4 フロントエンドフィルタテストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-fix-checking.ts`（同じファイルに追加）
- **目的**: 修正後、`hasVisitAssignee()` が「外す」の場合に `true` を返すことを確認
- **テストケース**:
  - 営業担当: 「外す」
  - 期待される結果: `hasVisitAssignee() = true`（修正後）
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
- _Requirements: 2.4_

#### 3.3 Verify preservation tests still pass

- **Property 2: Preservation** - 他の値（空欄、null、有効なイニシャル）の動作が変更されないことを検証
- **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
- Run preservation property tests from step 2
- **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
- Confirm all tests still pass after fix (no regressions)

##### 3.3.1 空欄保存テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`
- **目的**: 修正後も、営担が空欄（`''`）の売主が引き続き「未訪問他決」に分類されることを確認
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)
- _Requirements: 3.1_

##### 3.3.2 null保存テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`
- **目的**: 修正後も、営担が `null` の売主が引き続き「未訪問他決」に分類されることを確認
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)
- _Requirements: 3.2_

##### 3.3.3 有効なイニシャル保存テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`
- **目的**: 修正後も、営担が有効なイニシャル（`'Y'`, `'I'`, `'K'`等）の売主が引き続き「訪問後他決」に分類されることを確認
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)
- _Requirements: 3.3_

##### 3.3.4 他の条件保存テストスクリプトを再実行

- **テストファイル**: `backend/test-visit-assignee-hazusu-preservation.ts`
- **目的**: 修正後も、サイドバーカテゴリの他の条件（状況、次電日、専任他決打合せ等）が引き続き正しく判定されることを確認
- **Run test on FIXED code**
- **EXPECTED OUTCOME**: Test PASSES (confirms no regressions)
- _Requirements: 3.4_

---

## Phase 4: Deployment

### 4. Checkpoint - Ensure all tests pass

- Ensure all tests pass, ask the user if questions arise.

#### 4.1 GASを手動実行して `seller_sidebar_counts` テーブルを更新

- **目的**: GASの `syncSellerList` を手動実行して、サイドバーカウントを更新
- **手順**:
  1. Google スプレッドシートを開く
  2. 「拡張機能」→「Apps Script」を選択
  3. `syncSellerList` 関数を選択
  4. 「実行」ボタンをクリック
  5. ログを確認（「実行ログ」タブ）
  6. `seller_sidebar_counts` テーブルに新しいカウントが反映されたか確認

#### 4.2 バックエンドをデプロイ

- **手順**:
  ```bash
  git add backend/src/services/EnhancedAutoSyncService.ts
  git add backend/src/services/SellerService.supabase.ts
  git commit -m "fix: 営業担当「外す」を有効な値として扱う（バックエンド）"
  git push origin main
  ```
- **確認**: Vercelで自動デプロイが成功したか確認

#### 4.3 フロントエンドをデプロイ

- **手順**:
  ```bash
  git add frontend/frontend/src/utils/sellerStatusFilters.ts
  git commit -m "fix: 営業担当「外す」を有効な値として扱う（フロントエンド）"
  git push origin main
  ```
- **確認**: Vercelで自動デプロイが成功したか確認

#### 4.4 本番環境でAA9484が「訪問後他決」に分類されることを確認

- **手順**:
  1. 本番環境の売主リストページを開く
  2. サイドバーの「訪問後他決」カテゴリを確認
  3. AA9484が含まれていることを確認
  4. サイドバーの「未訪問他決」カテゴリを確認
  5. AA9484が含まれていないことを確認
