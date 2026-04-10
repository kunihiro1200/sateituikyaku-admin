# 要件定義書：物件詳細ページへの買主フィルター設定機能

## はじめに

売主管理システムの物件詳細ページ（`/properties/:id`）に、買主絞り込み用のフィルター設定バーを追加する。設定したフィルター値はデータベース（`property_listings`テーブル）に保存され、次回ページを開いた際に復元される。また、公開前メール送信・値下げ配信メール・買主候補リストの各機能を開いた際に、その物件に設定されたフィルター値を使って買主を自動絞り込む。

## 用語集

- **System**: 売主管理システム（社内管理システム）
- **User**: 不動産会社の従業員
- **Property_Detail_Page**: 物件詳細ページ（`/property-listings/:propertyNumber`）
- **Filter_Bar**: 物件情報セクションの「物件番号」右隣に配置するフィルター設定バー
- **Pet_Filter**: ペット可否フィルター（可 / 不可 / どちらでも）
- **Parking_Filter**: P台数（駐車場台数）フィルター（1台 / 2台以上 / 3台以上 / 10台以上 / 不要 / 指定なし）
- **Onsen_Filter**: 温泉フィルター（あり / なし / どちらでも）
- **Floor_Filter**: 高層階フィルター（高層階 / 低層階 / どちらでも）
- **Buyer_Candidate_List**: 物件詳細ページ内の買主候補表示機能（`/property-listings/:propertyNumber/buyer-candidates`）
- **Pre_Release_Email**: 公開前メール送信機能（GmailDistributionButtonコンポーネント）
- **Price_Reduction_Email**: 値下げ配信メール機能（GmailDistributionButtonコンポーネント）
- **property_listings**: 物件テーブル（Supabaseデータベース）
- **buyers**: 買主テーブル（Supabaseデータベース）

## 要件

### 要件1: フィルター設定UIの追加

**ユーザーストーリー**: 従業員として、物件詳細ページで買主絞り込み用のフィルターを手入力（ボタン選択）で設定したい。

#### 受入基準

1. THE System SHALL Property_Detail_Pageの物件情報セクション内「物件番号」の右隣にFilter_Barを表示する
2. THE Filter_Bar SHALL Pet_Filter、Parking_Filter、Onsen_Filter、Floor_Filterの4つのフィルターを含む
3. WHILE 物件種別が「マンション」である、THE System SHALL Filter_BarにPet_FilterとFloor_Filterを表示する
4. WHILE 物件種別が「マンション」以外である、THE System SHALL Filter_BarからPet_FilterとFloor_Filterを非表示にする
5. THE System SHALL Parking_FilterとOnsen_Filterを物件種別に関わらず常時Filter_Barに表示する
6. THE Pet_Filter SHALL 「可」「不可」「どちらでも」の3つの選択肢をボタン形式で提供する
7. THE Parking_Filter SHALL 「1台」「2台以上」「3台以上」「10台以上」「不要」「指定なし」の6つの選択肢をボタン形式で提供する
8. THE Onsen_Filter SHALL 「あり」「なし」「どちらでも」の3つの選択肢をボタン形式で提供する
9. THE Floor_Filter SHALL 「高層階」「低層階」「どちらでも」の3つの選択肢をボタン形式で提供する

### 要件2: フィルター設定値の保存と復元

**ユーザーストーリー**: 従業員として、設定したフィルター値が次回ページを開いた時に復元されるようにしたい。

#### 受入基準

1. WHEN User がフィルター値を変更する、THE System SHALL 変更されたフィルター値をproperty_listingsテーブルに保存する
2. WHEN User がProperty_Detail_Pageを開く、THE System SHALL property_listingsテーブルから保存済みのフィルター値を読み込んでFilter_Barに反映する
3. IF property_listingsテーブルにフィルター値が保存されていない場合、THEN THE System SHALL Pet_Filterのデフォルト値を「どちらでも」に設定する
4. IF property_listingsテーブルにフィルター値が保存されていない場合、THEN THE System SHALL Parking_Filterのデフォルト値を「指定なし」に設定する
5. IF property_listingsテーブルにフィルター値が保存されていない場合、THEN THE System SHALL Onsen_Filterのデフォルト値を「どちらでも」に設定する
6. IF property_listingsテーブルにフィルター値が保存されていない場合、THEN THE System SHALL Floor_Filterのデフォルト値を「どちらでも」に設定する
7. THE System SHALL property_listingsテーブルに以下のカラムを追加する：`buyer_filter_pet`（TEXT）、`buyer_filter_parking`（TEXT）、`buyer_filter_onsen`（TEXT）、`buyer_filter_floor`（TEXT）

### 要件3: 物件種別変更時のフィルターリセット

**ユーザーストーリー**: 従業員として、物件種別が「マンション」以外に変更された際に、マンション専用フィルターが自動リセットされるようにしたい。

#### 受入基準

1. WHEN 物件種別が「マンション」以外に変更される、THE System SHALL Pet_Filterの選択値を「どちらでも」にリセットする
2. WHEN 物件種別が「マンション」以外に変更される、THE System SHALL Floor_Filterの選択値を「どちらでも」にリセットする
3. WHEN Pet_FilterまたはFloor_Filterがリセットされる、THE System SHALL リセット後の値をproperty_listingsテーブルに保存する

### 要件4: 買主候補リストへのフィルター自動適用

**ユーザーストーリー**: 従業員として、買主候補リストを開いた際に、その物件に設定されたフィルター値で買主が自動絞り込まれるようにしたい。

#### 受入基準

1. WHEN User がBuyer_Candidate_Listを開く、THE System SHALL property_listingsテーブルから当該物件のフィルター値を取得する
2. WHEN Buyer_Candidate_Listが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByPetメソッドを使用してPet_Filterの値でフィルタリングする
3. WHEN Buyer_Candidate_Listが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByParkingメソッドを使用してParking_Filterの値でフィルタリングする
4. WHEN Buyer_Candidate_Listが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByOnsenメソッドを使用してOnsen_Filterの値でフィルタリングする
5. WHEN Buyer_Candidate_Listが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByFloorメソッドを使用してFloor_Filterの値でフィルタリングする
6. IF 物件にフィルター値が設定されていない場合、THEN THE System SHALL フィルターを適用せず全件を対象とする

### 要件5: 公開前メール・値下げ配信メールへのフィルター自動適用

**ユーザーストーリー**: 従業員として、公開前メール・値下げ配信メールの買主候補リストを開いた際に、その物件に設定されたフィルター値で買主が自動絞り込まれるようにしたい。

#### 受入基準

1. WHEN User がPre_Release_EmailまたはPrice_Reduction_Emailの買主候補リストを取得する、THE System SHALL property_listingsテーブルから当該物件のフィルター値を取得する
2. WHEN EnhancedBuyerDistributionServiceが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByPetメソッドを使用してPet_Filterの値でフィルタリングする
3. WHEN EnhancedBuyerDistributionServiceが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByParkingメソッドを使用してParking_Filterの値でフィルタリングする
4. WHEN EnhancedBuyerDistributionServiceが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByOnsenメソッドを使用してOnsen_Filterの値でフィルタリングする
5. WHEN EnhancedBuyerDistributionServiceが買主を絞り込む、THE System SHALL 既存のBuyerService.filterByFloorメソッドを使用してFloor_Filterの値でフィルタリングする
6. IF 物件にフィルター値が設定されていない場合、THEN THE System SHALL フィルターを適用せず全件を対象とする

### 要件6: フィルターのマッチングロジック

**ユーザーストーリー**: 従業員として、設定したフィルター値が既存の「他社物件新着配信」と同じマッチングロジックで適用されることを期待する。

#### 受入基準

1. WHEN Pet_Filterが「可」に設定されている、THE System SHALL 買主の`pet_allowed_required`が「不可」以外（空欄・nullを含む）の買主を対象に含める
2. WHEN Pet_Filterが「不可」に設定されている、THE System SHALL 買主の`pet_allowed_required`が「不可」または空欄・nullの買主を対象に含める
3. WHEN Pet_Filterが「どちらでも」に設定されている、THE System SHALL ペット条件に関わらず全ての買主を対象に含める
4. WHEN Parking_Filterが「不要」に設定されている、THE System SHALL 買主の`parking_spaces`が空欄・null・「1台」・「2台」・「不要」のいずれかの買主を対象に含める
5. WHEN Parking_Filterが「1台」に設定されている、THE System SHALL 買主の`parking_spaces`が空欄・null・「不要」・「1台」のいずれかの買主を対象に含める
6. WHEN Parking_Filterが「2台以上」に設定されている、THE System SHALL 買主の`parking_spaces`が「2台以上」・「3台以上」・「10台以上」のいずれかの買主を対象に含める
7. WHEN Parking_Filterが「3台以上」に設定されている、THE System SHALL 買主の`parking_spaces`が「3台以上」・「10台以上」のいずれかの買主を対象に含める
8. WHEN Parking_Filterが「10台以上」に設定されている、THE System SHALL 買主の`parking_spaces`が「10台以上」の買主のみを対象に含める
9. WHEN Parking_Filterが「指定なし」に設定されている、THE System SHALL P台数条件に関わらず全ての買主を対象に含める
10. WHEN Onsen_Filterが「あり」に設定されている、THE System SHALL 買主の`hot_spring_required`が「あり」の買主のみを対象に含める
11. WHEN Onsen_Filterが「なし」に設定されている、THE System SHALL 買主の`hot_spring_required`が空欄・null・「なし」の買主を対象に含める
12. WHEN Onsen_Filterが「どちらでも」に設定されている、THE System SHALL 温泉条件に関わらず全ての買主を対象に含める
13. WHEN Floor_Filterが「高層階」に設定されている、THE System SHALL 買主の`high_floor_required`が空欄・null・「高層階」・「どちらでも」のいずれかの買主を対象に含める
14. WHEN Floor_Filterが「低層階」に設定されている、THE System SHALL 買主の`high_floor_required`が空欄・null・「低層階」・「どちらでも」のいずれかの買主を対象に含める
15. WHEN Floor_Filterが「どちらでも」に設定されている、THE System SHALL 高層階条件に関わらず全ての買主を対象に含める

### 要件7: バックエンドAPIの拡張

**ユーザーストーリー**: 従業員として、フィルター設定値の保存・取得・適用がバックエンドで正確に処理されることを期待する。

#### 受入基準

1. THE System SHALL `PUT /api/property-listings/:propertyNumber`エンドポイントで`buyer_filter_pet`・`buyer_filter_parking`・`buyer_filter_onsen`・`buyer_filter_floor`の4フィールドの更新を受け付ける
2. THE System SHALL `GET /api/property-listings/:propertyNumber`エンドポイントのレスポンスに`buyer_filter_pet`・`buyer_filter_parking`・`buyer_filter_onsen`・`buyer_filter_floor`の4フィールドを含める
3. WHEN `GET /api/property-listings/:propertyNumber/buyer-candidates`が呼び出される、THE System SHALL property_listingsテーブルから当該物件のフィルター値を取得してBuyerCandidateServiceに渡す
4. WHEN `GET /api/property-listings/:propertyNumber/distribution-buyers-enhanced`が呼び出される、THE System SHALL property_listingsテーブルから当該物件のフィルター値を取得してEnhancedBuyerDistributionServiceに渡す
5. IF フィルター値がnullまたは未設定の場合、THEN THE System SHALL 該当フィルターを適用せず全件を対象とする
