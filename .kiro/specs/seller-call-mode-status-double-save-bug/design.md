# 売主通話モード ステータス2回保存バグ 修正設計

## Overview

通話モードページ（`/sellers/:id/call`）のステータスセクションで「ステータスを更新」ボタンを1回押しても保存が完了せず、2回押さないと保存されないバグを修正する。

根本原因は、`loadAllData()` のキャッシュヒット時のバックグラウンド更新処理にある。キャッシュヒット時、メインの初期化処理（`setEditedStatus`、`setEditedConfidence`、`setEditedNextCallDate`、`setEditedPinrichStatus`、`setStatusChanged(false)` 等）は正常に実行される。しかし、バックグラウンドで非同期に走る最新データ取得処理（`setSeller(freshData)`）が `seller` stateを更新し、`[seller, fetchSidebarSellers]` に依存するuseEffectが再実行される。このuseEffectは `fetchSidebarSellers` を呼び出し、その中で `seller.visitAssignee` 等を参照するが、これ自体は `statusChanged` に影響しない。

より正確な根本原因は、`handleSaveCallMemo` 関数内で `await loadAllData()` を呼び出している点にある。`loadAllData()` はキャッシュヒット時に `setEditedStatus(sellerData.status)` 等を呼び出すが、これらのset関数は現在の `editedStatus` と同じ値を設定する場合でも、Reactのstate更新として処理される。その後、バックグラウンドで `setSeller(freshData)` が呼ばれ、`seller` stateが変化する。`seller` stateの変化は `[seller, fetchSidebarSellers]` useEffectを再実行させるが、このuseEffectは `statusChanged` を変更しない。

**実際の根本原因（コード分析による確定）**：

`handleUpdateStatus` 実行後、`setStatusChanged(false)` が呼ばれる。しかし、`handleUpdateStatus` の直前または直後に `handleSaveCallMemo` が呼ばれた場合、`handleSaveCallMemo` 内の `await loadAllData()` がキャッシュヒットし、バックグラウンド更新で `setSeller(freshData)` が呼ばれる。この `setSeller` 呼び出しにより `seller` stateが変化し、`[seller, fetchSidebarSellers]` useEffectが再実行される。`fetchSidebarSellers` は `seller.visitAssignee` を参照するが、これは `statusChanged` に影響しない。

**最終的な根本原因**：キャッシュヒット時のバックグラウンド更新（1327-1337行）で `setSeller(freshData)` のみが呼ばれ、`setEditedStatus`、`setEditedConfidence`、`setEditedNextCallDate`、`setEditedPinrichStatus` が呼ばれない。これにより、`seller.status` と `editedStatus` が乖離した状態になる。その後、何らかのトリガー（ページ操作等）で `editedStatus` が `seller.status` と比較され、差異があると `statusChanged` が `true` に設定される可能性がある。

ただし、現在のコードでは `statusChanged` は `useEffect` で自動計算されておらず、手動で `setStatusChanged(true)` を呼ぶ形式のため、上記の乖離だけでは `statusChanged` が `true` に戻らない。

**Git履歴調査が必要な点**：実際のバグ再現条件を確定するため、Git履歴でキャッシュ機能の追加コミットと、`handleSaveCallMemo` での `loadAllData()` 呼び出しが追加されたコミットを確認する必要がある。

## Glossary

- **Bug_Condition (C)**: ステータスセクションのフィールドを変更して「ステータスを更新」ボタンを1回押した後、`statusChanged` フラグが `false` にリセットされた後に再び `true` に設定される条件
- **Property (P)**: 「ステータスを更新」ボタンを1回押した後、`statusChanged` が `false` のまま維持され、ボタンが無効化（グレー）状態を保つ
- **Preservation**: 既存のフィールド変更検知（`statusChanged=true`）、ページ初回ロード時の初期化、保存中のローディング表示、バリデーションエラー処理が変更されない
- **handleUpdateStatus**: `frontend/frontend/src/pages/CallModePage.tsx` の関数。ステータスセクションの保存処理を担当
- **statusChanged**: ステータスセクションのフィールドが変更されたかどうかを追跡するReact state。`true` の時に保存ボタンがオレンジ色のパルスアニメーション状態で有効化される
- **loadAllData**: ページ初回ロード時に売主データを取得してstateを初期化する関数。キャッシュヒット時はバックグラウンドで最新データを非同期取得する
- **キャッシュヒット**: `pageDataCache` に売主データが存在する場合（一覧ページから遷移した場合等）に発生する。この時、バックグラウンドで最新データを取得して `setSeller(freshData)` を呼ぶ

## Bug Details

### Bug Condition

バグは、ユーザーがステータスセクションのフィールドを変更して「ステータスを更新」ボタンを1回押した後に発生する。`handleUpdateStatus` が `setStatusChanged(false)` を呼んで保存ボタンを無効化するが、その後何らかの処理が `statusChanged` を再び `true` に設定する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: 'saveStatus', context: PageContext }
  OUTPUT: boolean

  RETURN input.action = 'saveStatus'
         AND handleUpdateStatus が setStatusChanged(false) を呼んだ
         AND その後 statusChanged が true に戻る
         AND ユーザーはフィールドを変更していない
END FUNCTION
```

### Examples

- **例1（バグあり）**: ユーザーが「状況（当社）」を「追客中」→「訪問済み」に変更 → 「ステータスを更新」を1回押す → APIが成功し `setStatusChanged(false)` が呼ばれる → 保存ボタンが一瞬グレーになる → 何らかの処理で `statusChanged` が再び `true` になる → 保存ボタンが再びオレンジ色のパルスアニメーション状態になる
- **例2（バグあり）**: ユーザーが「確度」を変更 → 「ステータスを更新」を1回押す → 同様に2回目の押下が必要になる
- **例3（正常）**: ユーザーが「ステータスを更新」を2回押す → 2回目の押下で保存が完了し、ボタンがグレーのまま維持される
- **エッジケース**: キャッシュなし（直接URLアクセス）の場合はバグが発生しない可能性がある

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- ユーザーがステータスセクションのフィールドを変更した時、`statusChanged` フラグが `true` に設定され、保存ボタンがオレンジ色のパルスアニメーション状態で有効化される
- ページを初回ロードした時、売主データを取得してステータスフィールドを初期化し、`statusChanged` フラグを `false` に設定する
- 保存処理中（`savingStatus=true`）の時、保存ボタンが無効化されてローディングインジケーターが表示される
- バリデーションエラーが発生した時（確度未入力、専任他決の必須フィールド未入力等）、エラーメッセージを表示してAPIを呼び出さない
- 保存が成功した後にユーザーが再度フィールドを変更した時、`statusChanged` フラグが `true` に設定され、保存ボタンが有効化される

**スコープ:**
ステータスセクション以外の操作（コメント保存、物件情報保存、訪問予約保存等）は、このバグ修正の影響を受けない。

## Hypothesized Root Cause

コード分析に基づく根本原因の仮説：

1. **キャッシュヒット時のバックグラウンド更新でのstate乖離**: `loadAllData()` のキャッシュヒット時（1327-1337行）、バックグラウンド更新で `setSeller(freshData)` のみが呼ばれ、`setEditedStatus`、`setEditedConfidence`、`setEditedNextCallDate`、`setEditedPinrichStatus` が呼ばれない。これにより `seller.status` と `editedStatus` が乖離する。
   - `handleUpdateStatus` 後に `setSavedStatus(editedStatus)` が呼ばれるが、バックグラウンド更新で `setSeller(freshData)` が呼ばれると `seller.status` が更新される
   - もし `seller.status` と `editedStatus` が異なる場合、何らかのロジックが `statusChanged` を `true` に設定する可能性がある

2. **`handleSaveCallMemo` での `loadAllData()` 呼び出し**: `handleSaveCallMemo` 内で `await loadAllData()` が呼ばれる（1955行付近）。`loadAllData()` はキャッシュヒット時に `setEditedStatus(sellerData.status)` 等を呼ぶが、これらは `setStatusChanged(false)` と同じバッチで処理される。しかし、バックグラウンド更新が非同期で走り、`setSeller(freshData)` が呼ばれる。

3. **`[seller, fetchSidebarSellers]` useEffectの再実行**: `setSeller(freshData)` により `seller` stateが変化し、このuseEffectが再実行される。`fetchSidebarSellers` 内で何らかの処理が `statusChanged` に影響する可能性がある（ただし、コード分析では直接的な影響は確認できなかった）。

4. **Git履歴で確認すべき点**: キャッシュ機能（`pageDataCache`）が追加されたコミット、および `handleSaveCallMemo` での `loadAllData()` 呼び出しが追加されたコミットを確認することで、バグの発生タイミングを特定できる。

## Correctness Properties

Property 1: Bug Condition - ステータス保存後のstatusChangedフラグ維持

_For any_ ステータスセクションのフィールドを変更して「ステータスを更新」ボタンを1回押した後、APIが成功した場合、修正後の `handleUpdateStatus` 関数は `statusChanged` フラグを `false` に設定し、その後ユーザーがフィールドを変更しない限り `statusChanged` が `true` に戻ることなく、保存ボタンが無効化（グレー）状態を維持する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - バックグラウンド更新によるstatusChangedへの非干渉

_For any_ キャッシュヒット時のバックグラウンド更新（`setSeller(freshData)` の呼び出し）が発生した場合、修正後のコードは `statusChanged` フラグを変更せず、保存ボタンの状態（有効/無効）を変化させない。

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

根本原因の仮説に基づく修正計画（Git履歴確認後に確定）：

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Specific Changes**:

1. **キャッシュヒット時のバックグラウンド更新でstatusChangedを保護する**:
   - バックグラウンド更新（1327-1337行）で `setSeller(freshData)` を呼ぶ際、`statusChanged` が `true` の場合は `setEditedStatus` 等を呼ばない
   - または、バックグラウンド更新後に `statusChanged` の状態を保持する

   ```typescript
   // 修正前（問題のある箇所）
   api.get(`/api/sellers/${id}`).then((freshResponse) => {
     const freshData = freshResponse.data;
     if (freshData && freshData.id) {
       pageDataCache.set(sellerDetailCacheKey(id!), freshData, 30 * 1000);
       setSeller(freshData);
       setUnreachableStatus(freshData.unreachableStatus || null);
       setEditableComments(freshData.comments || '');
       setSavedComments(freshData.comments || '');
     }
   }).catch(() => {});
   ```

   ```typescript
   // 修正後（statusChangedを保護）
   api.get(`/api/sellers/${id}`).then((freshResponse) => {
     const freshData = freshResponse.data;
     if (freshData && freshData.id) {
       pageDataCache.set(sellerDetailCacheKey(id!), freshData, 30 * 1000);
       setSeller(freshData);
       setUnreachableStatus(freshData.unreachableStatus || null);
       setEditableComments(freshData.comments || '');
       setSavedComments(freshData.comments || '');
       // statusChangedがfalseの場合のみ、ステータスフィールドを更新する
       // （ユーザーが編集中の場合は上書きしない）
       setEditedStatus(prev => {
         // statusChangedがtrueの場合（ユーザーが編集中）は変更しない
         // この判定はsetStatusChangedのクロージャ問題があるため、別の方法が必要
         return prev; // 暫定
       });
     }
   }).catch(() => {});
   ```

2. **`handleSaveCallMemo` での `loadAllData()` 呼び出しを削除または修正**:
   - `handleSaveCallMemo` 内の `await loadAllData()` を削除し、必要な状態のみを更新する
   - これにより、コメント保存後にステータスフィールドが再初期化されることを防ぐ

   ```typescript
   // 修正前
   await loadAllData();
   
   // 修正後（loadAllData()を削除し、必要な状態のみ更新）
   // コメントは既に setEditableComments(updatedComments) で更新済み
   // loadAllData() の呼び出しは不要
   ```

3. **バックグラウンド更新でのstatusChanged保護（根本的な修正）**:
   - `statusChanged` フラグを `useRef` で管理し、バックグラウンド更新から保護する
   - または、バックグラウンド更新時に `statusChanged` の現在値を確認してから更新する

**File**: `backend/src/routes/sellers.ts`（変更なし）

**File**: `backend/src/services/SellerService.supabase.ts`（変更なし）

バックエンドは正常に動作しており、修正はフロントエンドのみ。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `handleUpdateStatus` を呼び出した後に `statusChanged` が `true` に戻るシナリオをシミュレートするテストを書く。未修正コードで実行して失敗を確認し、根本原因を特定する。

**Test Cases**:
1. **キャッシュヒット後の保存テスト**: キャッシュに売主データを設定した状態でページをロードし、フィールドを変更して保存ボタンを押した後、`statusChanged` が `false` のまま維持されることを確認（未修正コードでは失敗する）
2. **バックグラウンド更新後の保存テスト**: `setSeller(freshData)` が呼ばれた後に `statusChanged` が変化しないことを確認（未修正コードでは失敗する可能性がある）
3. **コメント保存後のステータス保存テスト**: `handleSaveCallMemo` を呼び出した後に `statusChanged` が `false` のまま維持されることを確認（未修正コードでは失敗する可能性がある）
4. **直接URLアクセス時のテスト**: キャッシュなし（直接URLアクセス）の場合、バグが発生しないことを確認

**Expected Counterexamples**:
- 保存ボタンを1回押した後、`statusChanged` が `true` に戻る
- 可能性のある原因: キャッシュヒット時のバックグラウンド更新、`handleSaveCallMemo` での `loadAllData()` 呼び出し

### Fix Checking

**Goal**: 修正後のコードで、ステータス保存が1回の押下で完了することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleUpdateStatus_fixed(input)
  ASSERT statusChanged = false
  ASSERT 保存ボタンが無効化（グレー）状態
  ASSERT 「ステータスを更新しました」メッセージが表示される
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、既存の動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleUpdateStatus_original(input) = handleUpdateStatus_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様なフィールド変更パターンを自動生成できる
- エッジケース（空文字、特殊文字、境界値等）を自動的にカバーできる
- 既存動作の保持を強力に保証できる

**Test Cases**:
1. **フィールド変更後の保存ボタン有効化保持**: フィールドを変更した後、保存ボタンが有効化（オレンジ色）されることを確認
2. **バリデーションエラー時の動作保持**: 確度未入力等のバリデーションエラー時、APIが呼ばれないことを確認
3. **保存成功後の再変更**: 保存成功後にフィールドを再変更した時、保存ボタンが再び有効化されることを確認
4. **バックグラウンド更新の非干渉**: `setSeller(freshData)` が呼ばれても `statusChanged` が変化しないことを確認

### Unit Tests

- `handleUpdateStatus` が成功した後、`statusChanged` が `false` になることをテスト
- キャッシュヒット時のバックグラウンド更新が `statusChanged` に影響しないことをテスト
- `handleSaveCallMemo` が `statusChanged` に影響しないことをテスト

### Property-Based Tests

- ランダムなフィールド変更パターンで `handleUpdateStatus` を呼び出し、常に `statusChanged=false` になることを検証
- ランダムな `freshData` で `setSeller` を呼び出し、`statusChanged` が変化しないことを検証
- 多様なステータス値（追客中、訪問済み、専任、他決等）で保存が正常に動作することを検証

### Integration Tests

- 一覧ページから通話モードページに遷移（キャッシュヒット）し、ステータスを変更して1回保存するフローをテスト
- 直接URLアクセス（キャッシュなし）でステータスを変更して1回保存するフローをテスト
- コメント保存後にステータスを変更して1回保存するフローをテスト
