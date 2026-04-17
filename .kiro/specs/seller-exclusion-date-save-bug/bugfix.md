# Bugfix Requirements Document

## Introduction

売主リスト通話モードページ（`/sellers/:id/call`）の「除外日にすること」フィールドに値を入力して保存した後、別ページに移動してから戻ると値が消えている（空になっている）バグ。しばらく待つと値が表示される（遅延表示）。

根本原因はバックエンドのインメモリキャッシュ（30秒TTL）にある。`updateSeller` 実行後にキャッシュ無効化を行っているが、Vercelサーバーレス環境では各リクエストが別インスタンスで処理されるため、キャッシュ無効化が他インスタンスに伝播しない。ページ遷移後に戻ると古いキャッシュ（保存前の値）が返され、30秒後にTTLが切れてDBから再取得されると正しい値が表示される。

加えて、フロントエンドの保存処理でも `exclusionAction` が空文字列の場合にリクエストペイロードから除外されるため、値の解除が保存されない問題もある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが「除外日にすること」フィールドに値を入力して保存し、別ページに移動してから通話モードページに戻る THEN システムは「除外日にすること」フィールドを空（保存前の状態）で表示する

1.2 WHEN 上記の状態でページを表示してから約30秒待つ THEN システムは「除外日にすること」フィールドに保存した値を遅延表示する

1.3 WHEN ユーザーが「除外日にすること」フィールドの値を解除（空に戻す）して保存する THEN システムは解除操作をDBに保存しない（空文字列がリクエストペイロードから除外されるため）

### Expected Behavior (Correct)

2.1 WHEN ユーザーが「除外日にすること」フィールドに値を入力して保存し、別ページに移動してから通話モードページに戻る THEN システムは「除外日にすること」フィールドに保存した値を即座に表示する

2.2 WHEN ユーザーが「除外日にすること」フィールドの値を解除（空に戻す）して保存する THEN システムは解除操作をDBに保存し、次回ページ表示時に空として表示する

2.3 WHEN 保存処理が完了する THEN システムはキャッシュを確実に無効化し、次のデータ取得リクエストでDBから最新データを返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが「除外日にすること」以外のフィールド（ステータス、次電日など）を保存する THEN システムは従来通りそれらのフィールドを正しく保存・表示する

3.2 WHEN ユーザーが通話モードページを初回表示する THEN システムは従来通りDBから売主データを取得して全フィールドを正しく表示する

3.3 WHEN キャッシュが有効期限内（30秒以内）に同一インスタンスで同じ売主データを取得する THEN システムは従来通りキャッシュからデータを返してパフォーマンスを維持する

---

## Bug Condition (バグ条件の定式化)

**Bug Condition Function**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerUpdateRequest
  OUTPUT: boolean

  // 以下のいずれかの条件でバグが発生する
  RETURN (
    // 条件A: 保存後にページ遷移して戻った場合（キャッシュ問題）
    X.exclusionAction IS NOT NULL AND X.exclusionAction <> '' AND
    X.requestIsFromDifferentVercelInstance = true
  ) OR (
    // 条件B: 値を解除して保存した場合（空文字列除外問題）
    X.exclusionAction = ''
  )
END FUNCTION
```

**Property: Fix Checking**:
```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← updateSeller'(X)
  ASSERT result.exclusionAction = X.exclusionAction  // 保存した値が即座に反映される
  ASSERT getSellerAfterUpdate'(X.sellerId).exclusionAction = X.exclusionAction  // 再取得でも正しい値
END FOR
```

**Property: Preservation Checking**:
```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT updateSeller(X) = updateSeller'(X)  // 他フィールドの保存動作は変わらない
END FOR
```
