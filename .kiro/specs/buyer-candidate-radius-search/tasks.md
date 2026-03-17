# 実装計画：買主候補半径3km検索

## 概要

`BuyerCandidateService` に半径3km距離マッチング機能を追加する。既存の配信エリアマッチングとOR条件で動作し、`GeocodingService` を利用して物件住所から座標を取得する。

## タスク

- [x] 1. `BuyerCandidateService` に `GeocodingService` を注入する
  - `GeocodingService` のインポートを追加する
  - コンストラクタに `this.geocodingService = new GeocodingService()` を追加する
  - インスタンス変数 `geocodingCache: Map<string, { lat: number; lng: number } | null>` を追加する
  - コンストラクタで `this.geocodingCache = new Map()` を初期化する
  - _Requirements: 2.1, 2.3_

- [x] 2. `getPropertyCoordsFromAddress` メソッドを追加する
  - [x] 2.1 `getPropertyCoordsFromAddress` の実装
    - `property.address` が空の場合は `null` を返す
    - `GeocodingService.geocodeAddress(address)` を呼び出す
    - 失敗時（APIキー未設定・APIエラー・ZERO_RESULTS）は `null` を返す
    - 成功時は `{ lat: coords.latitude, lng: coords.longitude }` に変換して返す
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 `getPropertyCoordsFromAddress` のユニットテストを書く
    - `address` が空の場合 → `null` を返すことを検証
    - ジオコーディング成功時 → `{ lat, lng }` を返すことを検証
    - APIキー未設定時 → `null` を返すことを検証
    - _Requirements: 2.1, 2.2_

- [x] 3. `matchesByInquiryDistance` メソッドを修正する
  - [x] 3.1 `matchesByInquiryDistance` を非同期・`GeocodingService` 利用版に書き換える
    - シグネチャを `async matchesByInquiryDistance(buyer, propertyCoords, geocodingCache): Promise<boolean>` に変更する
    - `buyer.property_number` が空の場合は `false` を返す
    - カンマ区切りの場合は最初の物件番号のみを使用する
    - `geocodingCache` にキャッシュがあればそれを使用する
    - キャッシュがない場合は `property_listings` から `address` を取得する
    - `address` が空の場合はキャッシュに `null` を保存して `false` を返す
    - `GeocodingService.geocodeAddress(address)` を呼び出す
    - 失敗時はキャッシュに `null` を保存して `false` を返す
    - 成功時はキャッシュに座標を保存する
    - `GeolocationService.calculateDistance` で距離を計算し、3.0km以下なら `true` を返す
    - _Requirements: 1.2, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 3.2 `matchesByInquiryDistance` のユニットテストを書く
    - 3km以内の物件 → `true` を返すことを検証
    - 3km超の物件 → `false` を返すことを検証
    - `property_number` が空 → `false` を返すことを検証
    - `property_number` が `property_listings` に存在しない → `false` を返すことを検証
    - ジオコーディング失敗 → `false` を返すことを検証
    - カンマ区切り複数物件番号 → 最初の番号のみ使用することを検証
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. `filterCandidates` を非同期版 `filterCandidatesAsync` に切り替える
  - [x] 4.1 `filterCandidatesAsync` を実装する
    - シグネチャを `async filterCandidatesAsync(buyers, propertyType, salesPrice, propertyAreaNumbers, propertyCoords): Promise<any[]>` に変更する
    - 処理順序：`shouldExcludeBuyer` → `matchesStatus` → `matchesPropertyTypeCriteria` → `matchesPriceCriteria` → `matchesAreaCriteria` → `matchesByInquiryDistance`
    - `matchesAreaCriteria` が `true` の場合は距離計算をスキップして候補に追加する（OR条件の効率的な実装）
    - `propertyCoords` が `null` の場合は距離マッチングをスキップする
    - `matchesByInquiryDistance` に `this.geocodingCache` を渡す
    - _Requirements: 1.1, 1.3, 1.4, 4.1, 4.3, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.2 `filterCandidatesAsync` のユニットテストを書く
    - 配信エリアマッチング済み買主は距離計算をスキップすることを検証
    - 距離マッチングで追加された買主にも既存フィルタが適用されることを検証
    - `property_address` が空の場合、配信エリアマッチングのみで結果を返すことを検証
    - APIエラー時でも例外が発生しないことを検証
    - _Requirements: 1.3, 1.4, 4.1_

- [x] 5. `getCandidatesForProperty` を修正して距離マッチングを有効化する
  - `propertyCoords` の取得を `getPropertyCoordsFromAddress(property)` に変更する（`null` から有効化）
  - `filterCandidates` の呼び出しを `await filterCandidatesAsync` に変更する
  - `getCandidatesForProperty` を `async` にする（既に非同期の場合は確認のみ）
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 6. チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [-] 7. プロパティベーステストを作成する
  - [x]* 7.1 プロパティ1のテストを書く：距離マッチングによる候補追加
    - **Property 1: 距離マッチングによる候補追加**
    - **Validates: Requirements 1.1, 1.2**
    - `fast-check` を使用して任意の物件座標と3km以内の買主に対して候補リストに含まれることを検証する

  - [ ]* 7.2 プロパティ2のテストを書く：OR条件の成立
    - **Property 2: OR条件の成立**
    - **Validates: Requirements 1.3**
    - 配信エリアのみ合致・距離のみ合致・両方合致の買主が全て候補に含まれることを検証する

  - [ ]* 7.3 プロパティ3のテストを書く：既存フィルタの不変性
    - **Property 3: 既存フィルタの不変性**
    - **Validates: Requirements 1.4, 5.1, 5.2, 5.3, 5.4**
    - 任意の距離マッチング候補買主に対して、既存フィルタで除外されるべき買主が候補リストに含まれないことを検証する

  - [ ]* 7.4 プロパティ4のテストを書く：重複計算の回避
    - **Property 4: 重複計算の回避**
    - **Validates: Requirements 4.1, 4.3**
    - 配信エリアマッチング済みの買主に対して `GeocodingService.geocodeAddress` が呼ばれないことを検証する

  - [ ]* 7.5 プロパティ5のテストを書く：ジオコーディングキャッシュの有効性
    - **Property 5: ジオコーディングキャッシュの有効性**
    - **Validates: Requirements 4.2**
    - 同一物件番号を持つ複数の買主に対して `GeocodingService.geocodeAddress` が1回のみ呼ばれることを検証する

- [x] 8. 最終チェックポイント - 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、MVPとして省略可能
- 各タスクは前のタスクの成果物を前提とする
- `GeocodingService` は `{ latitude, longitude }` を返すが、`GeolocationService.calculateDistance` は `{ lat, lng }` を受け取るため変換が必要
- 全エラーは例外を発生させず、フォールバック（距離マッチングをスキップ）として処理する
