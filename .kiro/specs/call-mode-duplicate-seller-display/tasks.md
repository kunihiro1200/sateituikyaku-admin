# 実装計画：通話モードページ 重複売主表示機能

## 概要

重複売主モーダルに確度・状況・次電日・査定額・コメント・物件所在地を追加する。
変更対象は4ファイルのみ。`properties` テーブルのJOINは削除し、`sellers.property_address` を直接使用する。

## タスク

- [x] 1. バックエンド型定義の更新（`backend/src/types/index.ts`）
  - `DuplicateMatch.sellerInfo` に以下のフィールドを追加する：
    - `confidenceLevel?: string`
    - `status?: string`
    - `nextCallDate?: string`
    - `valuationAmount1?: number`
    - `valuationAmount2?: number`
    - `valuationAmount3?: number`
    - `propertyAddress?: string`
    - `comments?: string`
  - _要件: 3.4_

- [x] 2. フロントエンド型定義の更新（`frontend/frontend/src/types/index.ts`）
  - `DuplicateMatch.sellerInfo` に同じフィールドを追加する（バックエンドと同一）
  - _要件: 3.4_

- [x] 3. `DuplicateDetectionService` のSELECTクエリ更新（`backend/src/services/DuplicateDetectionService.ts`）
  - [x] 3.1 `checkDuplicateByPhone` のSELECTクエリを修正する
    - `properties (...)` のJOINを削除する
    - `sellers` テーブルから直接 `confidence_level`, `status`, `next_call_date`, `valuation_amount_1/2/3`, `property_address`, `comments` を取得する
    - マッピングに新フィールドを追加する
    - _要件: 3.2, 3.3, 4.1, 4.2_
  - [x] 3.2 `checkDuplicateByEmail` のSELECTクエリを同様に修正する
    - _要件: 3.2, 3.3, 4.1, 4.2_

- [x] 4. `DuplicateCard.tsx` の表示更新（`frontend/frontend/src/components/DuplicateCard.tsx`）
  - [x] 4.1 売主番号リンクのURLを `/sellers/${duplicate.sellerId}/call` に変更する
    - _要件: 2.5_
  - [x] 4.2 確度・状況・次電日・査定額・物件所在地・コメントを表示追加する
    - 査定額は円→万円変換して表示
    - _要件: 2.2_

- [-] 5. デプロイ
  - `git add . && git commit -m "feat: 重複売主モーダルに確度・状況・次電日・査定額・コメント・物件所在地を追加" && git push origin main`
