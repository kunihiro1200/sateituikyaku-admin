# 実装計画: 買付状況表示機能

## 概要

物件の買付状況を3つの画面（物件詳細・買主詳細・買主新規登録）の目立つ位置に赤字で表示する機能を実装する。
判定ロジックをユーティリティ関数として切り出し、共通コンポーネント `PurchaseStatusBadge` を通じて各画面に表示する。

## タスク

- [x] 1. 判定ユーティリティの作成
  - `frontend/frontend/src/utils/purchaseStatusUtils.ts` を新規作成する
  - `hasBuyerPurchaseStatus(latestStatus)`: `latest_status` に「買」が含まれるか判定
  - `hasPropertyOfferStatus(offerStatus)`: `offer_status` が空でない値を持つか判定
  - `getPurchaseStatusText(latestStatus, offerStatus)`: 条件1優先で買付状況テキストを返す（どちらも不成立なら `null`）
  - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.1 Property 1 のプロパティテストを作成する
    - **Property 1: 判定ロジックの正確性（条件1）**
    - **Validates: 要件 1.1, 1.4**
    - `frontend/frontend/src/__tests__/purchaseStatus.property.test.ts` に記述
    - `fc.string()` で任意の文字列を生成し、「買」を含む場合は `true`、含まない場合は `false` を検証

  - [ ]* 1.2 Property 2 のプロパティテストを作成する
    - **Property 2: 判定ロジックの正確性（条件2）**
    - **Validates: 要件 1.2, 1.5**
    - 空でない文字列は `true`、null・空文字は `false` を検証

  - [ ]* 1.3 Property 3 のプロパティテストを作成する
    - **Property 3: 優先順位の正確性**
    - **Validates: 要件 1.3**
    - 条件1・条件2が両方成立する場合、常に `latest_status` の値が返ることを検証

- [x] 2. PurchaseStatusBadge コンポーネントの作成
  - `frontend/frontend/src/components/PurchaseStatusBadge.tsx` を新規作成する
  - `statusText: string | null` を props として受け取る
  - `statusText` が null または空文字の場合は何も描画しない（`null` を返す）
  - 表示時: 赤背景（`error.light`）、赤文字（`error.main`）、太字、`fontSize: '1.1rem'`、パディング付きの MUI `Box`
  - _要件: 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.1 Property 4 のプロパティテストを作成する
    - **Property 4: 買付状況テキストの表示・非表示**
    - **Validates: 要件 2.1, 2.2, 3.1, 3.2, 4.1, 4.2**
    - `getPurchaseStatusText` が非 null を返す場合はバッジが描画され、null の場合は何も描画されないことを検証

  - [ ]* 2.2 Property 5 のプロパティテストを作成する
    - **Property 5: スタイルの正確性**
    - **Validates: 要件 2.3, 5.1, 5.2, 5.4**
    - 非 null の `statusText` に対して、描画要素が `color: error`・`fontWeight: bold`・`fontSize: 1.1rem` 以上のスタイルを持つことを検証

- [x] 3. チェックポイント - テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 4. PropertyListingDetailPage へのバッジ追加
  - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` を修正する
  - `PurchaseStatusBadge` と `getPurchaseStatusText`、`hasBuyerPurchaseStatus` をインポートする
  - 買主リスト（`buyers` 配列）から条件1を満たす買主の `latest_status` を取得する
  - `data.offer_status` を条件2として使用する
  - ヘッダーの `Box` 内（物件番号・コピーボタン付近）に `<PurchaseStatusBadge statusText={purchaseStatusText} />` を挿入する
  - `data` が null の場合はバッジが表示されないことを確認する（`getPurchaseStatusText` に null が渡るため自動的に非表示）
  - _要件: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 4.1 Property 6 のプロパティテストを作成する
    - **Property 6: latest_status を使った条件1判定**
    - **Validates: 要件 3.4, 4.5**
    - `buyer.latest_status` に「買」が含まれる場合はバッジが `buyer.latest_status` の値を表示し、含まれない場合は何も表示しないことを検証

- [x] 5. PropertyInfoCard へのバッジ追加
  - `frontend/frontend/src/components/PropertyInfoCard.tsx` を修正する
  - `PurchaseStatusBadge` と `getPurchaseStatusText` をインポートする
  - `buyer?.latest_status` を条件1として使用し、条件2は `null` を渡す
  - コンポーネントの `return` 内、最初の `Box` の直後（他のコンテンツより前）に `<PurchaseStatusBadge statusText={purchaseStatusText} />` を挿入する
  - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 6. NewBuyerPage へのバッジ追加
  - `frontend/frontend/src/pages/NewBuyerPage.tsx` を修正する
  - `PurchaseStatusBadge` と `getPurchaseStatusText` をインポートする
  - フォームの `latestStatus` 状態と `propertyInfo?.offer_status` を使用して `purchaseStatusText` を算出する
  - 物件情報エリア（`<Paper>` 内）の先頭に `<PurchaseStatusBadge statusText={purchaseStatusText} />` を挿入する
  - 物件番号未入力時（`propertyInfo` が null）はバッジが表示されないことを確認する
  - _要件: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 6.1 Property 7 のプロパティテストを作成する
    - **Property 7: offer_status を使った条件2判定（NewBuyerPage）**
    - **Validates: 要件 4.6**
    - `propertyInfo.offer_status` が空でない場合（かつ条件1が不成立の場合）にバッジが `offer_status` の値を表示することを検証

- [x] 7. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [-] 8. デプロイ
  - ステアリングルール（deploy-procedure.md）に従いデプロイする
  - `git add . && git commit -m "feat: 買付状況表示機能を追加" && git push origin main`

## 注意事項

- タスクに `*` が付いているものはオプションであり、スキップ可能
- バックエンド変更は不要（`offer_status` は既存フィールド）
- プロパティテストには `fast-check` ライブラリを使用する
- 各プロパティテストには `// Feature: property-purchase-status-display, Property {番号}: {プロパティテキスト}` のタグコメントを付与する
