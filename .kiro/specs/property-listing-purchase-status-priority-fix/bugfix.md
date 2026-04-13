# バグ修正要件定義書

## はじめに

物件リスト詳細画面（PropertyListingDetailPage）のヘッダーに表示される買付ステータスバッジについて、2つのデータソース（`offer_status` と買主の `latest_status`）の表示優先順位が誤っているバグを修正する。

具体的には、物件AA9406において「買付外れました」という古い買主ステータスがヘッダーに表示されたまま、後から更新した「一般他決」の `offer_status` が反映されない問題が発生している。

正しい優先順位は「固定の優先順位」ではなく「更新日時が新しい方」を優先する仕様である。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN `offer_status` の更新日時が買主 `latest_status` の更新日時より新しい場合、THEN the system は更新日時に関わらず買主の `latest_status`（「買」を含む）を優先してヘッダーバッジに表示する

1.2 WHEN 買主の `latest_status` の更新日時が `offer_status` の更新日時より新しい場合、THEN the system は正しく買主の `latest_status` を表示するが、逆の場合に `offer_status` が反映されない

### 期待する動作（正しい動作）

2.1 WHEN `offer_status` の更新日時が買主 `latest_status` の更新日時より新しい場合、THEN the system SHALL `offer_status` をヘッダーバッジに表示する

2.2 WHEN 買主 `latest_status`（「買」を含む）の更新日時が `offer_status` の更新日時より新しい場合、THEN the system SHALL 買主の `latest_status` をヘッダーバッジに表示する

2.3 WHEN `offer_status` のみ存在し、買主 `latest_status`（「買」を含む）が存在しない場合、THEN the system SHALL `offer_status` をヘッダーバッジに表示する

2.4 WHEN 買主 `latest_status`（「買」を含む）のみ存在し、`offer_status` が存在しない場合、THEN the system SHALL 買主の `latest_status` をヘッダーバッジに表示する

2.5 WHEN `offer_status` も買主 `latest_status`（「買」を含む）も存在しない場合、THEN the system SHALL ヘッダーバッジを表示しない

### 変更しない動作（リグレッション防止）

3.1 WHEN `offer_status` のみ存在する（買主 `latest_status` に「買」が含まれない）場合、THEN the system SHALL CONTINUE TO `offer_status` をヘッダーバッジに表示する

3.2 WHEN 買主 `latest_status`（「買」を含む）のみ存在し、`offer_status` が存在しない場合、THEN the system SHALL CONTINUE TO 買主の `latest_status` をヘッダーバッジに表示する

3.3 WHEN `offer_status` も買主 `latest_status`（「買」を含む）も存在しない場合、THEN the system SHALL CONTINUE TO ヘッダーバッジを非表示にする
