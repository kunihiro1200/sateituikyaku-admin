# seller-taketsu-visit-status-fix Bugfix Design

## Overview

売主リストの「他決→追客通知」ボタンを押した際、Google Chat通知の本文に表示される訪問状況ラベルが誤っている。
訪問済み（`visit_assignee` が設定されている）の場合でも「未訪問他決」と表示されてしまう。

**バグの影響範囲**: `CallModePage.tsx` の `handleSendChatNotification` 関数において、
`seller.visitAssignee` の有無を確認せずに常に `pre-visit-other-decision`（未訪問他決）エンドポイントを呼び出している。

**修正方針**: `handleSendChatNotification` 内のエンドポイント選択ロジックに、
`seller.visitAssignee` の有無チェックを追加し、訪問済みの場合は `post-visit-other-decision` を呼ぶよう修正する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `visit_assignee` が設定されている（訪問済み）かつ他決ステータスの売主に対して「他決→追客通知」ボタンを押したとき
- **Property (P)**: 期待される正しい動作 — Chat通知本文に「訪問後他決」が表示される
- **Preservation**: 修正によって変えてはいけない既存の動作 — 未訪問他決の通知送信、Chat送信自体の動作、他の通知本文の内容
- **handleSendChatNotification**: `frontend/frontend/src/pages/CallModePage.tsx` 内の関数。ステータスに応じて適切なChat通知エンドポイントを選択して送信する
- **visit_assignee**: `sellers` テーブルのカラム。訪問査定を担当した営業担当者のイニシャル。設定されていれば訪問済み、空欄・null・「外す」なら未訪問
- **statusLabel**: `getStatusLabel(editedStatus)` の結果。例: `'他決→追客'`、`'訪問後他決'`、`'未訪問他決'`
- **seller.visitAssignee**: フロントエンドの `seller` オブジェクトの訪問担当者フィールド（`visit_assignee` に対応）

## Bug Details

### Bug Condition

バグは `CallModePage.tsx` の `handleSendChatNotification` 関数において、
他決ステータスのエンドポイント選択時に `seller.visitAssignee` の有無を確認していないことで発生する。

現在のコード（バグあり）:
```typescript
} else if (statusLabel.includes('訪問後他決')) {
  endpoint = `/api/chat-notifications/post-visit-other-decision/${seller.id}`;
} else if (statusLabel.includes('未訪問他決') || statusLabel.includes('他決')) {
  endpoint = `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
}
```

`getStatusLabel` の変換結果:
- `'VISITOTHERDECISION'` → `'訪問後他決'` → `post-visit-other-decision` ✅
- `'UNVISITEDOTHERDECISION'` → `'未訪問他決'` → `pre-visit-other-decision` ✅
- `'other_decision_follow_up'` → `'他決→追客'` → `pre-visit-other-decision` ← **ここが問題**

`'他決→追客'` は `statusLabel.includes('他決')` にマッチするため、
`visit_assignee` の有無に関わらず常に `pre-visit-other-decision`（未訪問他決）が呼ばれる。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SellerChatNotificationInput
  OUTPUT: boolean

  // 訪問済み（visit_assigneeが設定されている）かつ他決ステータスの場合にバグが発生
  RETURN X.visitAssignee IS NOT NULL
         AND X.visitAssignee != ""
         AND X.visitAssignee != "外す"
         AND X.status IN ['他決→追客', '他決→追客不要', '一般→他決', '他社買取']
         AND calledEndpoint(X) = "pre-visit-other-decision"  // 誤ったエンドポイント
END FUNCTION
```

### Examples

- **AA13872（バグ確認ケース）**: `visit_assignee = "KN"`（訪問済み）、`status = '他決→追客'` → 「未訪問他決」と表示される（誤り）。正しくは「訪問後他決」
- **未訪問他決の正常ケース**: `visit_assignee = null`、`status = '他決→追客'` → 「未訪問他決」と表示される（正常）
- **VISITOTHERDECISION ステータス**: `status = 'VISITOTHERDECISION'` → `statusLabel = '訪問後他決'` → `post-visit-other-decision` が呼ばれる（正常）
- **UNVISITEDOTHERDECISION ステータス**: `status = 'UNVISITEDOTHERDECISION'` → `statusLabel = '未訪問他決'` → `pre-visit-other-decision` が呼ばれる（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `visit_assignee` が未設定（null・空文字・「外す」）の売主への「他決→追客通知」は引き続き「未訪問他決」として送信される
- Google Chat（`https://chat.googleapis.com/v1/spaces/AAAA0Ey7RU8/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=9jIN_bTulZibUDaPCPQmdsdkgbzfV5kCzH4dIx2IKb4`）への通知送信自体は正常に行われる
- 売主番号・売主名・担当者・他決要因などの他の通知本文の内容は変わらない
- `VISITOTHERDECISION` / `UNVISITEDOTHERDECISION` ステータスの既存の判定ロジックは変わらない
- 専任媒介・一般媒介通知のエンドポイント選択ロジックは変わらない

**Scope:**
他決ステータス（`'他決→追客'`、`'他決→追客不要'`、`'一般→他決'`、`'他社買取'` など）以外の通知送信は
この修正の影響を受けない。

## Hypothesized Root Cause

バグの根本原因は以下の通り:

1. **エンドポイント選択ロジックの不完全な条件分岐**: `handleSendChatNotification` において、
   `statusLabel.includes('他決')` という条件は `'他決→追客'` にマッチするが、
   この条件に `seller.visitAssignee` の有無チェックが含まれていない

2. **ステータス値と訪問状況の分離**: `status` フィールドは他決の種類（追客・追客不要など）を表すが、
   訪問済みかどうかは `visit_assignee` フィールドで別管理されている。
   エンドポイント選択時にこの2つのフィールドを組み合わせた判定が実装されていなかった

3. **`VISITOTHERDECISION` / `UNVISITEDOTHERDECISION` との不整合**: これらのステータス値は
   訪問状況を明示的に含むが、`'他決→追客'` などの汎用的な他決ステータスは含まない。
   汎用ステータスに対して訪問状況を判定する処理が欠落していた

4. **修正対象ファイル**: `frontend/frontend/src/pages/CallModePage.tsx` の
   `handleSendChatNotification` 関数（約3756行目）

## Correctness Properties

Property 1: Bug Condition - 訪問済み他決の通知ラベル修正

_For any_ 入力 X において `isBugCondition(X)` が true（`visit_assignee` が設定されており、
かつ他決ステータス）の場合、修正後の `handleSendChatNotification` は
`post-visit-other-decision` エンドポイントを呼び出し、
Google Chat通知本文に「訪問後他決」が表示される SHALL。

**Validates: Requirements 2.1**

Property 2: Preservation - 未訪問他決の通知ラベル維持

_For any_ 入力 X において `isBugCondition(X)` が false（`visit_assignee` が未設定）の場合、
修正後の `handleSendChatNotification` は修正前と同じく
`pre-visit-other-decision` エンドポイントを呼び出し、
Google Chat通知本文に「未訪問他決」が表示される SHALL。

**Validates: Requirements 2.2, 3.1, 3.2**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `handleSendChatNotification`（約3756行目）

**Specific Changes**:

1. **他決エンドポイント選択ロジックの修正**: `statusLabel.includes('他決')` の条件分岐に
   `seller.visitAssignee` の有無チェックを追加する

   **修正前（バグあり）**:
   ```typescript
   } else if (statusLabel.includes('訪問後他決')) {
     endpoint = `/api/chat-notifications/post-visit-other-decision/${seller.id}`;
   } else if (statusLabel.includes('未訪問他決') || statusLabel.includes('他決')) {
     endpoint = `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
   }
   ```

   **修正後（バグ修正）**:
   ```typescript
   } else if (statusLabel.includes('訪問後他決')) {
     endpoint = `/api/chat-notifications/post-visit-other-decision/${seller.id}`;
   } else if (statusLabel.includes('未訪問他決')) {
     endpoint = `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
   } else if (statusLabel.includes('他決')) {
     // visit_assigneeが設定されている（訪問済み）場合は訪問後他決、それ以外は未訪問他決
     const isVisited = seller.visitAssignee && seller.visitAssignee !== '' && seller.visitAssignee !== '外す';
     endpoint = isVisited
       ? `/api/chat-notifications/post-visit-other-decision/${seller.id}`
       : `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
   }
   ```

2. **修正の影響範囲**: `handleSendChatNotification` 関数内のエンドポイント選択ロジックのみ。
   バックエンドの `ChatNotificationService.ts` は変更不要（既に `post-visit` と `pre-visit` の
   2つのメソッドが正しく実装されている）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ: まず未修正コードでバグを再現するカウンターサンプルを確認し、
次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: `visit_assignee` が設定された他決ステータスの売主に対して
`handleSendChatNotification` を呼び出し、`pre-visit-other-decision` エンドポイントが
誤って呼ばれることを確認する。未修正コードで実行してバグを観察する。

**Test Cases**:
1. **訪問済み他決テスト**: `visit_assignee = "KN"`、`status = 'other_decision_follow_up'`（`statusLabel = '他決→追客'`）の場合、`pre-visit-other-decision` が呼ばれることを確認（未修正コードでは失敗するはず）
2. **未訪問他決テスト**: `visit_assignee = null`、`status = 'other_decision_follow_up'` の場合、`pre-visit-other-decision` が呼ばれることを確認（正常動作）
3. **「外す」ケーステスト**: `visit_assignee = "外す"`、`status = 'other_decision_follow_up'` の場合、`pre-visit-other-decision` が呼ばれることを確認（未訪問扱い）
4. **空文字ケーステスト**: `visit_assignee = ""`、`status = 'other_decision_follow_up'` の場合、`pre-visit-other-decision` が呼ばれることを確認（未訪問扱い）

**Expected Counterexamples**:
- `visit_assignee` が設定されているにもかかわらず `pre-visit-other-decision` が呼ばれる
- 原因: `statusLabel.includes('他決')` の条件に `visit_assignee` チェックが含まれていない

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が正しい動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := handleSendChatNotification_fixed(X)
  ASSERT calledEndpoint(result) = "post-visit-other-decision"
  ASSERT chatMessageBody(result) CONTAINS "訪問後他決"
  ASSERT chatMessageBody(result) NOT CONTAINS "未訪問他決"
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleSendChatNotification_original(X) = handleSendChatNotification_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な `visit_assignee` の値（null、空文字、「外す」、各種イニシャル）を自動生成できる
- 多様な `status` 値の組み合わせを網羅できる
- 手動テストでは見落としがちなエッジケースを検出できる

**Test Plan**: 未修正コードで未訪問他決の動作を観察し、修正後も同じ動作が保持されることを検証する。

**Test Cases**:
1. **未訪問他決の保持**: `visit_assignee = null` の場合、修正前後で `pre-visit-other-decision` が呼ばれることを確認
2. **「外す」の保持**: `visit_assignee = "外す"` の場合、修正前後で `pre-visit-other-decision` が呼ばれることを確認
3. **専任媒介通知の保持**: `statusLabel.includes('専任')` の場合、`exclusive-contract` エンドポイントが変わらず呼ばれることを確認
4. **一般媒介通知の保持**: `statusLabel.includes('一般')` の場合、`general-contract` エンドポイントが変わらず呼ばれることを確認

### Unit Tests

- `visit_assignee` が設定されている場合に `post-visit-other-decision` が呼ばれることをテスト
- `visit_assignee` が null/空文字/「外す」の場合に `pre-visit-other-decision` が呼ばれることをテスト
- `VISITOTHERDECISION` / `UNVISITEDOTHERDECISION` ステータスの既存動作が変わらないことをテスト

### Property-Based Tests

- ランダムな `visit_assignee` 値（null、空文字、「外す」、任意のイニシャル）を生成し、エンドポイント選択が正しいことを検証
- ランダムな他決ステータス値を生成し、`visit_assignee` の有無に応じて正しいエンドポイントが選択されることを検証
- 非他決ステータス（専任・一般など）に対してエンドポイント選択が変わらないことを検証

### Integration Tests

- AA13872のケースを再現: `visit_assignee = "KN"`、`status = 'other_decision_follow_up'` で通知送信し、Chat本文に「訪問後他決」が含まれることを確認
- 未訪問他決の通常フロー: `visit_assignee = null` で通知送信し、Chat本文に「未訪問他決」が含まれることを確認
- 修正後も通知送信自体（HTTPリクエスト）が正常に完了することを確認
