# バグ修正要件ドキュメント

## はじめに

物件リスト詳細画面の「価格情報セクション」には2種類のCHAT送信ボタンが存在する。

- **青いバー「CHAT送信」ボタン**: 売買価格が変更されたときに表示される。押すと確認ステータスを「未」にリセットするのが正しい動作。
- **オレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタン**: 値下げ予約日がクリアされたときに表示される。押しても確認ステータスは変更しないのが正しい動作。

現在、オレンジのボタンを押したときも確認ステータスが「未」に変わってしまうバグが発生している。これは `handlePriceChatSendSuccess` コールバックが両ボタン共通で呼ばれており、その中で無条件に確認ステータスを「未」に更新しているために起きている。

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムは確認ステータスを「未」に変更する

1.2 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムはバックエンドAPI（`PUT /api/property-listings/:id/confirmation`）を呼び出して確認ステータスを「未」に更新する

1.3 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムは `propertyConfirmationUpdated` イベントを発火してサイドバーの確認ステータス表示を「未」に変更する

### 期待される動作（正しい動作）

2.1 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムは確認ステータスを変更しない（現在の値を維持する）

2.2 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムはバックエンドAPI（`PUT /api/property-listings/:id/confirmation`）を呼び出さない

2.3 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムは `propertyConfirmationUpdated` イベントを発火しない

2.4 WHEN ユーザーがオレンジのバー「物件担当へCHAT送信（画像添付可能）」ボタンを押してCHAT送信が成功した THEN システムは成功スナックバーを表示し、`priceSavedButNotSent` フラグをリセットする（これらは引き続き行う）

### 変更しない動作（リグレッション防止）

3.1 WHEN ユーザーが青いバー「CHAT送信」ボタンを押してCHAT送信が成功した THEN システムは確認ステータスを「未」に変更し続ける

3.2 WHEN ユーザーが青いバー「CHAT送信」ボタンを押してCHAT送信が成功した THEN システムはバックエンドAPI（`PUT /api/property-listings/:id/confirmation`）を呼び出して確認ステータスを「未」に更新し続ける

3.3 WHEN ユーザーが青いバー「CHAT送信」ボタンを押してCHAT送信が成功した THEN システムは `propertyConfirmationUpdated` イベントを発火してサイドバーを更新し続ける

3.4 WHEN オレンジのバーまたは青いバーのCHAT送信が失敗した THEN システムはエラースナックバーを表示し、確認ステータスを変更しない

3.5 WHEN オレンジのバーのCHAT送信が成功した THEN システムは成功スナックバーを表示し続ける

---

## バグ条件の定式化

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ChatSendSuccessEvent
  OUTPUT: boolean

  // オレンジのバーからのCHAT送信成功イベントであるとき、バグ条件が成立する
  RETURN X.source = 'orange_bar'
END FUNCTION
```

### 修正確認プロパティ（Fix Checking）

```pascal
// Property: Fix Checking - オレンジバーCHAT送信時の確認ステータス不変
FOR ALL X WHERE isBugCondition(X) DO
  confirmationBefore ← getConfirmationStatus()
  triggerOrangeChatSendSuccess(X)
  confirmationAfter ← getConfirmationStatus()
  ASSERT confirmationBefore = confirmationAfter
  ASSERT apiCallCount('PUT /confirmation') = 0
END FOR
```

### 保全プロパティ（Preservation Checking）

```pascal
// Property: Preservation Checking - 青いバーの動作は変わらない
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // 青いバーCHAT送信成功時は確認ステータスが「未」になる動作を維持
END FOR
```
