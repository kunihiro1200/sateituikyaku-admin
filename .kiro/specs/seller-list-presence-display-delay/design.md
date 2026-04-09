# 売主一覧プレゼンス表示遅延バグ修正 Design

## Overview

売主一覧テーブルの「対応中」列に表示されるプレゼンス情報（国、林など）に2つの問題が発生しています。

1. **表示遅延**: 通話モードから一覧に戻った際、自分のイニシャルが表示されるまでに5秒程度の遅延が発生
2. **早期消失**: ページを離れた後、プレゼンス情報が即座に消えてしまい、他のスタッフが重複電話をしてしまう

この修正では、以下のアプローチで問題を解決します：

- **即座の表示**: プレゼンス情報をローカルステートに即座に反映
- **5秒間の維持**: プレゼンス情報を削除する際、5秒間のディレイを追加
- **デバッグログ追加**: プレゼンス情報の購読・発信・更新のタイミングをログ出力
- **エラーハンドリング強化**: Supabase Realtimeの接続エラーを適切に処理

## Glossary

- **Bug_Condition (C)**: プレゼンス情報の表示遅延または早期消失が発生する条件
- **Property (P)**: プレゼンス情報が即座に表示され、5秒間維持される正しい動作
- **Preservation**: 他のユーザーのプレゼンス表示、複数ユーザーの同時表示など、既存の動作を維持
- **useSellerPresenceSubscribe**: `frontend/frontend/src/hooks/useSellerPresence.ts`で定義されている、プレゼンス情報を購読するフック（SellersPage用）
- **useSellerPresenceTrack**: `frontend/frontend/src/hooks/useSellerPresence.ts`で定義されている、プレゼンス情報を発信するフック（CallModePage、SellerDetailPage用）
- **presenceState**: 売主番号をキーとして、各売主を開いているユーザーのリストを保持するステート
- **CHANNEL_NAME**: Supabase Realtimeのチャンネル名（`'seller-presence'`）

## Bug Details

### Bug Condition

バグは以下の2つの条件で発生します：

**条件1: 表示遅延**
ユーザーが通話モードで売主を開いた後、売主一覧に戻った際、自分のイニシャルが「対応中」列に表示されるまでに5秒程度の遅延が発生します。

**条件2: 早期消失**
ユーザーがページを離れる（別の売主を開く、または別のページに移動する）と、プレゼンス情報が即座に消えてしまい、他のスタッフが「この案件は対応済み」と判断する前に消失します。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: 'open' | 'leave', sellerNumber: string, userName: string }
  OUTPUT: boolean
  
  RETURN (input.action == 'open' AND displayDelayOccurs(input.sellerNumber, input.userName))
         OR (input.action == 'leave' AND presenceDisappearsImmediately(input.sellerNumber, input.userName))
END FUNCTION

FUNCTION displayDelayOccurs(sellerNumber, userName)
  // 通話モードから一覧に戻った際、プレゼンス情報が5秒以上表示されない
  RETURN timeUntilPresenceDisplayed(sellerNumber, userName) > 5000
END FUNCTION

FUNCTION presenceDisappearsImmediately(sellerNumber, userName)
  // ページを離れた後、プレゼンス情報が即座に消える（5秒未満）
  RETURN timeUntilPresenceRemoved(sellerNumber, userName) < 5000
END FUNCTION
```

### Examples

**例1: 表示遅延（バグ）**
- ユーザー「国」が売主「AA1234」の通話モードを開く
- 売主一覧に戻る
- 「対応中」列に「国」が表示されるまでに5秒かかる
- 期待: 即座に表示される

**例2: 早期消失（バグ）**
- ユーザー「林」が売主「AA5678」の通話モードを開く
- 売主一覧に戻る（「林」が表示される）
- ユーザー「林」が別の売主を開く
- 「対応中」列から「林」が即座に消える
- 期待: 5秒間表示を維持してから消える

**例3: 正常動作（他のユーザーのプレゼンス）**
- ユーザー「国」が売主「AA1234」を開いている
- ユーザー「林」が売主一覧を見る
- 「対応中」列に「国」が表示される
- 期待: 正常に表示される（変更なし）

**例4: 正常動作（複数ユーザー）**
- ユーザー「国」と「林」が売主「AA1234」を同時に開いている
- 売主一覧の「対応中」列に「国、林」が表示される
- 期待: 正常に表示される（変更なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 他のユーザーが売主を開いている場合、その売主の「対応中」列に他のユーザーのイニシャルが表示され続ける
- 複数のユーザーが同じ売主を開いている場合、全てのユーザーのイニシャルが「対応中」列に表示される
- ユーザーが売主を開いていない場合、その売主の「対応中」列は空白のままである
- プレゼンス情報が更新される際、`formatPresenceLabel`関数により「国」「林」などのラベル形式で表示される

**Scope:**
プレゼンス情報の表示遅延と早期消失以外の動作は全て変更されません。これには以下が含まれます：
- 他のユーザーのプレゼンス情報の表示
- 複数ユーザーの同時表示
- プレゼンス情報のフォーマット（`formatPresenceLabel`）
- Supabase Realtimeの接続・切断処理

## Hypothesized Root Cause

バグの根本原因として、以下の可能性が考えられます：

1. **Supabase Realtimeの遅延**: `useSellerPresenceSubscribe`がSupabase Realtimeの`presence`イベントを受信するまでに遅延が発生している可能性
   - `channel.on('presence', { event: 'sync' })`が遅延している
   - `channel.on('presence', { event: 'join' })`が遅延している

2. **Reactの再レンダリング遅延**: プレゼンス情報が更新されても、`presenceState`ステートの更新が遅延している可能性
   - `setPresenceState(buildState())`が遅延している
   - `buildState()`の処理が重い

3. **プレゼンス発信の遅延**: `useSellerPresenceTrack`が`channel.track()`を呼び出すまでに遅延が発生している可能性
   - `channel.subscribe()`のコールバックが遅延している
   - `channel.track()`の処理が遅延している

4. **早期消失の原因**: `useSellerPresenceTrack`のクリーンアップ処理が即座に`channel.untrack()`を呼び出している
   - `useEffect`のクリーンアップ関数が即座に実行される
   - `channel.untrack()`が即座にプレゼンス情報を削除する

## Correctness Properties

Property 1: Bug Condition - プレゼンス情報の即座の表示

_For any_ ユーザーが通話モードで売主を開いた後、売主一覧に戻った場合、修正後の`useSellerPresenceSubscribe`と`useSellerPresenceTrack`は、自分のイニシャルを「対応中」列に即座に（遅延なく）表示する。

**Validates: Requirements 2.1**

Property 2: Preservation - プレゼンス情報の5秒間維持

_For any_ ユーザーがページを離れる（別の売主を開く、または別のページに移動する）場合、修正後の`useSellerPresenceTrack`は、プレゼンス情報を5秒間表示を維持してから削除する。

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - 他のユーザーのプレゼンス表示

_For any_ 他のユーザーが売主を開いている場合、修正後のコードは、元のコードと同じように、その売主の「対応中」列に他のユーザーのイニシャルを表示し続ける。

**Validates: Requirements 3.1**

Property 4: Preservation - 複数ユーザーの同時表示

_For any_ 複数のユーザーが同じ売主を開いている場合、修正後のコードは、元のコードと同じように、全てのユーザーのイニシャルを「対応中」列に表示する。

**Validates: Requirements 3.2**

Property 5: Preservation - 空白表示

_For any_ ユーザーが売主を開いていない場合、修正後のコードは、元のコードと同じように、その売主の「対応中」列を空白のままにする。

**Validates: Requirements 3.3**

Property 6: Preservation - フォーマット表示

_For any_ プレゼンス情報が更新される場合、修正後のコードは、元のコードと同じように、`formatPresenceLabel`関数により「国」「林」などのラベル形式で表示する。

**Validates: Requirements 3.4**

## Fix Implementation

### Changes Required

根本原因の仮説に基づき、以下の変更を実施します：

**File**: `frontend/frontend/src/hooks/useSellerPresence.ts`

**Function**: `useSellerPresenceSubscribe`, `useSellerPresenceTrack`

**Specific Changes**:

1. **ローカルステートの即座の反映**（表示遅延の解決）
   - `useSellerPresenceTrack`で`channel.track()`を呼び出した直後、ローカルステートに即座に反映
   - Supabase Realtimeの`presence`イベントを待たずに、UIを即座に更新
   - 実装方法: `channel.track()`の後、カスタムイベントまたはグローバルステートを使用してSellersPageに通知

2. **5秒間のディレイ追加**（早期消失の解決）
   - `useSellerPresenceTrack`のクリーンアップ処理で、`channel.untrack()`を5秒間遅延させる
   - `setTimeout`を使用して5秒後に`channel.untrack()`を呼び出す
   - 実装方法: クリーンアップ関数内で`setTimeout(() => channel.untrack(), 5000)`を使用

3. **デバッグログの追加**
   - `useSellerPresenceSubscribe`と`useSellerPresenceTrack`の各処理にタイムスタンプ付きログを追加
   - `console.log`で以下の情報を出力:
     - プレゼンス情報の購読開始・終了
     - プレゼンス情報の発信開始・終了
     - `presence`イベントの受信（sync, join, leave）
     - `channel.track()`と`channel.untrack()`の呼び出し

4. **エラーハンドリングの強化**
   - `channel.subscribe()`のステータスが`TIMED_OUT`または`CHANNEL_ERROR`の場合、リトライ処理を実装
   - 既存のリトライ処理（`MAX_RETRIES = 5`）を維持
   - エラーログを詳細に出力

5. **5秒間の維持時間を定数化**
   - `PRESENCE_PERSIST_DURATION_MS = 5000`を定数として定義
   - ユーザーが調整可能にする

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する探索的テストを実施し、次に修正後のコードで正しい動作と既存動作の保存を検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因の仮説を確認または反証します。反証された場合は、再度仮説を立て直します。

**Test Plan**: 以下のテストケースを実行し、修正前のコードでバグが発生することを確認します。

**Test Cases**:
1. **表示遅延テスト**: ユーザーが通話モードで売主を開いた後、売主一覧に戻った際、自分のイニシャルが表示されるまでの時間を計測（修正前のコードで5秒以上かかることを確認）
2. **早期消失テスト**: ユーザーがページを離れた後、プレゼンス情報が消えるまでの時間を計測（修正前のコードで即座に消えることを確認）
3. **Supabase Realtimeの遅延テスト**: `presence`イベントの受信タイミングをログで確認（修正前のコードで遅延が発生しているか確認）
4. **Reactの再レンダリング遅延テスト**: `setPresenceState`の呼び出しタイミングをログで確認（修正前のコードで遅延が発生しているか確認）

**Expected Counterexamples**:
- 表示遅延: 自分のイニシャルが5秒以上表示されない
- 早期消失: プレゼンス情報が即座に消える（5秒未満）
- 可能性のある原因: Supabase Realtimeの遅延、Reactの再レンダリング遅延、プレゼンス発信の遅延

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が発生した場合に正しい動作をすることを検証します。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := useSellerPresenceSubscribe_fixed() AND useSellerPresenceTrack_fixed(input)
  ASSERT expectedBehavior(result)
END FOR

FUNCTION expectedBehavior(result)
  IF input.action == 'open' THEN
    RETURN result.presenceDisplayedImmediately == true
  ELSE IF input.action == 'leave' THEN
    RETURN result.presencePersistedFor5Seconds == true
  END IF
END FUNCTION
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が発生しない場合に、元のコードと同じ動作をすることを検証します。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT useSellerPresenceSubscribe_original(input) = useSellerPresenceSubscribe_fixed(input)
  ASSERT useSellerPresenceTrack_original(input) = useSellerPresenceTrack_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingを推奨します。理由：
- 多数のテストケースを自動生成できる
- 手動テストでは見逃しがちなエッジケースを検出できる
- 全ての非バグ入力に対して動作が変わらないことを強く保証できる

**Test Plan**: 修正前のコードで正常動作を観察し、その後Property-based testでその動作を検証します。

**Test Cases**:
1. **他のユーザーのプレゼンス表示**: 他のユーザーが売主を開いている場合、その売主の「対応中」列に他のユーザーのイニシャルが表示され続けることを確認
2. **複数ユーザーの同時表示**: 複数のユーザーが同じ売主を開いている場合、全てのユーザーのイニシャルが「対応中」列に表示されることを確認
3. **空白表示**: ユーザーが売主を開いていない場合、その売主の「対応中」列が空白のままであることを確認
4. **フォーマット表示**: プレゼンス情報が更新される際、`formatPresenceLabel`関数により「国」「林」などのラベル形式で表示されることを確認

### Unit Tests

- `useSellerPresenceSubscribe`のテスト: `presence`イベントの受信時に`presenceState`が正しく更新されることを確認
- `useSellerPresenceTrack`のテスト: `channel.track()`と`channel.untrack()`が正しく呼び出されることを確認
- 表示遅延のテスト: 自分のイニシャルが即座に表示されることを確認
- 早期消失のテスト: プレゼンス情報が5秒間維持されることを確認

### Property-Based Tests

- ランダムなユーザーと売主の組み合わせを生成し、プレゼンス情報が正しく表示されることを確認
- ランダムなタイミングでページを離れ、プレゼンス情報が5秒間維持されることを確認
- 多数のシナリオで、他のユーザーのプレゼンス表示、複数ユーザーの同時表示、空白表示が正しく動作することを確認

### Integration Tests

- 通話モードから売主一覧に戻る完全なフローをテスト
- 複数のユーザーが同時に売主を開くシナリオをテスト
- ページを離れた後、5秒間プレゼンス情報が表示され続けることを確認
