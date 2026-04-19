# 業務依頼サイト登録タブ入力時スクロールバグ Bugfix Design

## Overview

業務依頼画面のサイト登録タブにおいて、フィールドに値を入力するたびに画面が保存ボタン方向へ自動スクロールするバグの修正設計。

根本原因は `WorkTaskDetailModal` コンポーネント内で `SiteRegistrationSection` が内部関数コンポーネントとして定義されており、`handleFieldChange` が呼ばれるたびに `editedData` state が更新され、`SiteRegistrationSection` が毎回新しいコンポーネントインスタンスとして再マウントされることにある。

再マウントが発生すると、MUI の `DialogContent` がスクロール位置をリセットし、`DialogActions` に配置された保存ボタン方向へスクロールが発生する。

修正方針：`SiteRegistrationSection`（および同様に内部定義されている `MediationSection`、`ContractSettlementSection`、`JudicialScrivenerSection`）をモーダルコンポーネントの外部に切り出すか、`React.memo` を使用して不要な再マウントを防止する。最小変更として、`DialogContent` に `key` を固定し、スクロール位置を保持する方法も有効。

## Glossary

- **Bug_Condition (C)**: サイト登録タブでフィールドへの入力が発生する条件 — `handleFieldChange` が呼ばれ `editedData` state が更新される場合
- **Property (P)**: フィールド入力後もスクロール位置が変化しない期待動作
- **Preservation**: 他タブの動作、保存機能、タブ表示、保存後フィードバックは変更しない
- **WorkTaskDetailModal**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx` の業務詳細モーダルコンポーネント
- **SiteRegistrationSection**: モーダル内部で定義されたサイト登録タブのコンポーネント関数。`useCwCounts()` フックを内部で呼び出している
- **handleFieldChange**: フィールド値変更時に `editedData` state を更新する関数。呼び出しのたびに再レンダリングを引き起こす
- **editedData**: 編集中のフィールド値を保持する state。更新のたびに `SiteRegistrationSection` の再マウントを引き起こす
- **DialogContent**: MUI の Dialog コンテンツ領域。子コンポーネントが再マウントされるとスクロール位置がリセットされる

## Bug Details

### Bug Condition

`SiteRegistrationSection` が `WorkTaskDetailModal` の render 関数内でインライン定義されているため、`editedData` state が更新されるたびに新しい関数参照が生成される。React はこれを別のコンポーネント型として扱い、既存の DOM ツリーをアンマウントして再マウントする。この再マウントにより `DialogContent` のスクロール位置がリセットされ、保存ボタン（`DialogActions`）方向へスクロールが発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input — ユーザーのフィールド操作イベント
  OUTPUT: boolean

  RETURN input.tab == 'サイト登録'
         AND input.eventType IN ['onChange', 'onClick']
         AND SiteRegistrationSection is defined inside WorkTaskDetailModal render
         AND editedData state is updated by handleFieldChange(input.field, input.value)
END FUNCTION
```

### Examples

- **例1（バグあり）**: サイト登録タブで「サイト備考」テキストフィールドに文字を入力 → `handleFieldChange` が呼ばれ `editedData` が更新 → `SiteRegistrationSection` が再マウント → `DialogContent` のスクロール位置がリセット → 保存ボタン方向へスクロール
- **例2（バグあり）**: 「CWの方へ依頼メール（サイト登録）」の Y/N ボタンをクリック → 同様に再マウントが発生しスクロール
- **例3（バグあり）**: 「サイト登録依頼者」のボタン選択をクリック → 同様に再マウントが発生しスクロール
- **エッジケース（バグなし）**: 媒介契約タブ・契約決済タブでのフィールド入力 → `SiteRegistrationSection` は表示されていないため再マウントの影響を受けない（ただし同様の問題が潜在的に存在する）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 保存ボタンを押した時のフィールド値保存機能は変更しない
- 媒介契約タブ・契約決済タブ・司法書士タブの動作は変更しない
- タブの表示・切り替え動作は変更しない
- 保存完了・エラーの Snackbar フィードバックは変更しない
- 締日超過警告ダイアログの動作は変更しない
- 物件一覧行追加未入力警告ダイアログの動作は変更しない

**Scope:**
フィールド入力時のスクロール動作のみを修正する。フィールドの表示内容、バリデーション、保存ロジック、API 呼び出しは一切変更しない。

## Hypothesized Root Cause

根本原因は確定済み：

1. **インライン関数コンポーネント定義**: `SiteRegistrationSection`、`MediationSection`、`ContractSettlementSection`、`JudicialScrivenerSection` が `WorkTaskDetailModal` の render 関数内でインライン定義されている。React は毎回の再レンダリングでこれらを新しいコンポーネント型として扱い、再マウントを引き起こす

2. **state 更新による再レンダリング連鎖**: `handleFieldChange` → `setEditedData` → `WorkTaskDetailModal` 再レンダリング → `SiteRegistrationSection` 再マウント → `DialogContent` スクロール位置リセット

3. **DialogContent のスクロール位置非保持**: MUI の `DialogContent` は子コンポーネントが再マウントされるとスクロール位置を保持しない

4. **useCwCounts フックの再実行**: `SiteRegistrationSection` 内で `useCwCounts()` が呼ばれているため、再マウントのたびに Supabase へのクエリが再実行される（パフォーマンス問題も併発）

## Correctness Properties

Property 1: Bug Condition - フィールド入力時のスクロール非発生

_For any_ サイト登録タブでのフィールド入力操作（テキスト入力、ボタン選択、日付選択）において、修正後の `WorkTaskDetailModal` は `DialogContent` のスクロール位置を変化させず、ユーザーが入力中のフィールドの位置を維持する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非バグ条件下での動作保持

_For any_ 入力操作がサイト登録タブのフィールド変更でない場合（保存ボタン押下、タブ切り替え、他タブでの操作）、修正後のコードは修正前と同一の動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

**Root Cause**: `SiteRegistrationSection` がモーダルの render 関数内でインライン定義されているため、state 更新のたびに再マウントが発生する

**Specific Changes**:

1. **`SiteRegistrationSection` の切り出し**: `WorkTaskDetailModal` 内部のインライン定義から、モーダルの外部コンポーネントまたは `useCallback` でメモ化した関数に変更する

   最小変更アプローチ（推奨）：`DialogContent` に `key` を固定値で設定し、再マウントを防ぐのではなく、`SiteRegistrationSection` を `WorkTaskDetailModal` の外部に定義して props 経由でデータを渡す

2. **`useCwCounts` の移動**: `SiteRegistrationSection` 内の `useCwCounts()` 呼び出しを `WorkTaskDetailModal` のトップレベルに移動し、props として渡す（フックのルール違反も解消）

3. **内部コンポーネントの外部化パターン**:
   ```typescript
   // 修正前（バグあり）
   export default function WorkTaskDetailModal(...) {
     const SiteRegistrationSection = () => { // ← 毎回新しい型
       const cwCounts = useCwCounts(); // ← フックのルール違反
       return <Box>...</Box>;
     };
     return <Dialog>...<SiteRegistrationSection /></Dialog>;
   }

   // 修正後（バグなし）
   // オプション1: WorkTaskDetailModal の外部に定義
   // オプション2: DialogContent の overflowY と scroll 制御を修正
   ```

4. **最小変更オプション（スクロール位置の明示的保持）**: `SiteRegistrationSection` の再マウントを防ぐ代わりに、`DialogContent` の ref を使用してスクロール位置を保存・復元する

   ```typescript
   const dialogContentRef = useRef<HTMLDivElement>(null);
   const scrollPositionRef = useRef<number>(0);

   // handleFieldChange の前後でスクロール位置を保持
   const handleFieldChange = (field: string, value: any) => {
     scrollPositionRef.current = dialogContentRef.current?.scrollTop ?? 0;
     setEditedData(prev => ({ ...prev, [field]: value }));
   };

   // useEffect でスクロール位置を復元
   useEffect(() => {
     if (dialogContentRef.current) {
       dialogContentRef.current.scrollTop = scrollPositionRef.current;
     }
   });
   ```

   **推奨**: オプション1（外部化）の方が根本的な解決策であり、パフォーマンスも改善される

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでスクロールバグを再現し根本原因を確認、次に修正後のコードでスクロール非発生と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでフィールド入力時に `SiteRegistrationSection` が再マウントされることを確認し、スクロール位置がリセットされることを実証する。

**Test Plan**: `SiteRegistrationSection` のマウント・アンマウントをモニタリングするテストを作成し、`handleFieldChange` 呼び出し後に再マウントが発生することを確認する。

**Test Cases**:
1. **再マウント検出テスト**: `SiteRegistrationSection` に `useEffect` でマウント検出を追加し、`handleFieldChange` 呼び出し後に再マウントが発生することを確認（未修正コードで検出される）
2. **スクロール位置リセットテスト**: `DialogContent` の `scrollTop` を設定後に `handleFieldChange` を呼び出し、`scrollTop` が 0 にリセットされることを確認（未修正コードで失敗）
3. **useCwCounts 再実行テスト**: `handleFieldChange` 呼び出しのたびに Supabase クエリが再実行されることを確認（未修正コードで検出される）

**Expected Counterexamples**:
- `SiteRegistrationSection` が `handleFieldChange` 呼び出しのたびにアンマウント・再マウントされる
- `DialogContent` の `scrollTop` が毎回 0 にリセットされる

### Fix Checking

**Goal**: 修正後のコードでフィールド入力時にスクロール位置が変化しないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  initialScrollTop := dialogContent.scrollTop
  handleFieldChange(input.field, input.value)
  ASSERT dialogContent.scrollTop == initialScrollTop
END FOR
```

### Preservation Checking

**Goal**: 修正前後で保存機能、タブ切り替え、フィードバック表示が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT WorkTaskDetailModal_original(input) = WorkTaskDetailModal_fixed(input)
END FOR
```

**Testing Approach**: 保存ボタン押下、タブ切り替え、Snackbar 表示の動作が修正前後で同一であることをユニットテストで確認する。

**Test Cases**:
1. **保存機能保持テスト**: `handleSave` が修正前後で同じ API 呼び出しを行うことを確認
2. **タブ切り替え保持テスト**: `handleTabChange` が修正前後で同じ動作をすることを確認
3. **Snackbar 表示保持テスト**: 保存成功・失敗時の Snackbar が修正前後で同様に表示されることを確認

### Unit Tests

- `handleFieldChange` 呼び出し後に `SiteRegistrationSection` が再マウントされないことをテスト
- `DialogContent` のスクロール位置がフィールド入力後も保持されることをテスト
- `useCwCounts` が `handleFieldChange` 呼び出しのたびに再実行されないことをテスト

### Property-Based Tests

- ランダムなフィールド・値の組み合わせで `handleFieldChange` を呼び出し、スクロール位置が常に保持されることを確認
- 複数回連続してフィールドを変更した場合でもスクロール位置が保持されることを確認

### Integration Tests

- サイト登録タブを開き、複数フィールドに値を入力してもスクロールが発生しないことを確認
- フィールド入力後に保存ボタンを押し、正常に保存されることを確認
- タブを切り替えて戻った後もフィールド入力時にスクロールが発生しないことを確認
