# Bugfix Requirements Document

## Introduction

売主リストの同期において、通話モードページの物件住所に「未入力」という値が表示されるバグを修正する。

過去に同様の問題（AA13807）が発生しており、`PropertyService.mapToPropertyInfo()` が `data.address` のみを参照していたことが根本原因だった。その際は `data.property_address || data.address` の形式に修正された。

今回のバグは、売主リスト同期（GASの `syncSellerList` → `EnhancedAutoSyncService`）を経由してDBに書き込まれた売主データにおいて、`sellers.property_address` カラムに「未入力」という文字列が格納されてしまうケースが存在することが原因と考えられる。通話モードページは `backend/src/services/SellerService.supabase.ts` を使用しており、`getSeller()` の `properties` テーブル参照時に `property_address` が「未入力」の場合のフォールバック処理が不完全な可能性がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主リストの同期（スプレッドシート → DB）が実行され、スプレッドシートの物件所在地（R列）が空欄または「未入力」の状態で同期された場合 THEN 通話モードページの物件住所欄に「未入力」という文字列が表示される

1.2 WHEN `properties` テーブルの `property_address` カラムに「未入力」という文字列が格納されている場合 THEN `SellerService.getSeller()` がそのまま「未入力」を返し、通話モードページに表示される

1.3 WHEN `sellers` テーブルの `property_address` カラムに有効な住所が存在するにもかかわらず THEN `properties` テーブルの `property_address` が「未入力」の場合、`sellers.property_address` へのフォールバックが正しく機能しない

### Expected Behavior (Correct)

2.1 WHEN 売主リストの同期が実行され、スプレッドシートの物件所在地が空欄または「未入力」の状態で同期された場合 THEN 通話モードページの物件住所欄には「未入力」という文字列ではなく、`sellers.property_address` の値または空欄が表示される

2.2 WHEN `properties` テーブルの `property_address` カラムに「未入力」という文字列が格納されている場合 THEN `SellerService.getSeller()` は `sellers.property_address` にフォールバックし、有効な住所を返す

2.3 WHEN `sellers.property_address` にも有効な住所が存在しない場合 THEN 通話モードページの物件住所欄には空欄または適切なデフォルト値が表示される（「未入力」という文字列は表示されない）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `properties.property_address` に有効な住所（空欄でも「未入力」でもない文字列）が格納されている場合 THEN 通話モードページの物件住所欄には引き続きその住所が正しく表示される

3.2 WHEN `sellers.property_address` に有効な住所が格納されており、`properties.property_address` が空欄の場合 THEN 通話モードページの物件住所欄には引き続き `sellers.property_address` の値が表示される

3.3 WHEN 通話モードページで物件住所を手動編集・保存した場合 THEN その変更は引き続き正しく保存・表示される

3.4 WHEN `PropertyService.mapToPropertyInfo()` が呼び出される場合 THEN `data.property_address || data.address` の優先順位は引き続き維持される
