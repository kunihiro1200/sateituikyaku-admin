# 買付ステータスバッジ表示優先順位バグ タスクリスト

## Tasks

- [-] 1. DBマイグレーション: タイムスタンプカラム追加
  - [x] 1.1 `property_listings` テーブルに `offer_status_updated_at TIMESTAMPTZ` カラムを追加するSQLファイルを作成する
  - [x] 1.2 `buyers` テーブルに `latest_status_updated_at TIMESTAMPTZ` カラムを追加するSQLファイルを作成する
  - [ ] 1.3 SupabaseダッシュボードまたはマイグレーションスクリプトでSQLを実行する

- [x] 2. バックエンド: offer_status保存時にタイムスタンプを記録
  - [x] 2.1 `backend/src/routes/propertyListings.ts` の PUT エンドポイントで、`offer_status` 等の買付フィールドが更新される場合に `offer_status_updated_at` を自動セットする処理を追加する

- [x] 3. バックエンド: latest_status更新時にタイムスタンプを記録
  - [x] 3.1 `backend/src/services/BuyerService.ts` の更新処理で、`latest_status` が更新される場合に `latest_status_updated_at` を自動セットする処理を追加する

- [x] 4. バックエンド: /buyersエンドポイントでlatest_status_updated_atを返す
  - [x] 4.1 `backend/src/services/BuyerLinkageService.ts` の `getBuyersForProperty` メソッドのSELECTクエリに `latest_status_updated_at` を追加する
  - [x] 4.2 `BuyerSummary` インターフェースに `latest_status_updated_at?: string | null` フィールドを追加する

- [x] 5. フロントエンド: 型定義の更新
  - [x] 5.1 `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `Buyer` インターフェースに `latest_status_updated_at?: string` を追加する
  - [x] 5.2 `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `PropertyListing` インターフェースに `offer_status_updated_at?: string` を追加する

- [x] 6. フロントエンド: getPurchaseStatusTextを更新日時比較ロジックに変更
  - [x] 6.1 `frontend/frontend/src/utils/purchaseStatusUtils.ts` の `getPurchaseStatusText` 関数のシグネチャに `latestStatusUpdatedAt` と `offerStatusUpdatedAt` の引数を追加する
  - [x] 6.2 両方のステータスが存在する場合に更新日時を比較して新しい方を返すロジックを実装する
  - [x] 6.3 タイムスタンプが両方nullの場合は `offer_status` を優先するフォールバックロジックを実装する

- [x] 7. フロントエンド: PropertyListingDetailPageの呼び出し箇所を更新
  - [x] 7.1 `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `PurchaseStatusBadge` 呼び出し箇所で、`latest_status_updated_at` と `offer_status_updated_at` を `getPurchaseStatusText` に渡すよう更新する

- [x] 8. テスト: バグ条件探索テスト（修正前コードで実行）
  - [x] 8.1 `frontend/frontend/src/__tests__/property-listing-purchase-status-priority-bug-exploration.test.ts` を作成する
    - `getPurchaseStatusText("買付外れました", "一般他決")` が `"買付外れました"` を返すことを確認（バグの存在を証明）
    - `offer_status` の方が新しいシナリオで現在の実装が誤った結果を返すことを確認

- [x] 9. テスト: 修正確認テスト（修正後コードで実行）
  - [x] 9.1 `frontend/frontend/src/__tests__/property-listing-purchase-status-priority-fix-checking.test.ts` を作成する
    - `offer_status_updated_at > latest_status_updated_at` の場合に `offer_status` が返ることを確認
    - `latest_status_updated_at > offer_status_updated_at` の場合に `latest_status` が返ることを確認

- [x] 10. テスト: 保存動作テスト（プロパティベース）
  - [x] 10.1 `frontend/frontend/src/__tests__/property-listing-purchase-status-priority-preservation.test.ts` を作成する
    - `offer_status` のみ存在する場合は修正前後で同じ結果を返すことを確認
    - `latest_status` のみ存在する場合は修正前後で同じ結果を返すことを確認
    - 両方nullの場合は修正前後で `null` を返すことを確認

- [-] 11. デプロイ: バックエンド
  - [x] 11.1 バックエンドの変更をコミットしてプッシュする
  - [ ] 11.2 Vercelプロジェクト `sateituikyaku-admin-backend` にデプロイされたことを確認する
  - [ ] 11.3 デプロイ後、`/api/property-listings/AA9406/buyers` のレスポンスに `latest_status_updated_at` が含まれることを確認する

- [ ] 12. デプロイ: フロントエンド
  - [x] 12.1 フロントエンドの変更をコミットしてプッシュする
  - [ ] 12.2 Vercelプロジェクト `sateituikyaku-admin-frontend` にデプロイされたことを確認する
  - [ ] 12.3 デプロイ後、物件AA9406の詳細画面でヘッダーバッジが「一般他決」を表示することを確認する
