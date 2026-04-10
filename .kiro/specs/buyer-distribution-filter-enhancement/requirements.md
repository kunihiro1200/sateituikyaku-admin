# 要件定義書：買主リスト「他社物件新着配信」フィルター追加

## はじめに

買主リスト一覧の「他社物件新着配信」ページのヘッダー選択バーに、現在の「住所」「価格種別」「物件種別」に加えて、「ペット」「P台数（駐車場台数）」「温泉」「高層階」の4つのフィルターを追加します。各フィルターには独自のマッチングロジックがあり、「ペット」と「高層階」は物件種別が「マンション」の場合のみ表示されます。

## 用語集

- **System**: 買主管理システム（社内管理システム）
- **User**: 不動産会社の従業員
- **Buyer**: 買主
- **Distribution_Page**: 他社物件新着配信ページ（`/buyers/other-company-distribution`）
- **Filter_Bar**: 配信ページのヘッダーにある選択バー（住所・価格種別・物件種別などのフィルター群）
- **Pet_Filter**: ペット可否フィルター（可 / 不可 / どちらでも）
- **Parking_Filter**: P台数（駐車場台数）フィルター（1台 / 2台以上 / 3台以上 / 10台以上 / 不要）
- **Onsen_Filter**: 温泉フィルター（あり / なし / どちらでも）
- **Floor_Filter**: 高層階フィルター（高層階 / 低層階 / どちらでも）
- **Property_Type**: 物件種別（戸建 / マンション / 土地）

## 要件

### 要件1: ペットフィルターの追加

**ユーザーストーリー**: 従業員として、ペット可否条件でフィルタリングして、条件に合う買主を絞り込みたい。

#### 受入基準

1. WHILE 物件種別に「マンション」が選択されている、THE System SHALL Filter_Barに「ペット」フィルターを表示する
2. WHILE 物件種別に「マンション」が選択されていない、THE System SHALL Filter_Barから「ペット」フィルターを非表示にする
3. THE Pet_Filter SHALL 「可」「不可」「どちらでも」の3つの選択肢を提供する
4. WHEN User が Pet_Filter を未選択の状態で配信ページを開く、THE System SHALL Pet_Filter のデフォルト値を「どちらでも」に設定する
5. WHEN User が Pet_Filter で「可」を選択する、THE System SHALL 買主の希望ペット条件が「不可」以外（空欄を含む）の買主を検索対象に含める
6. WHEN User が Pet_Filter で「不可」を選択する、THE System SHALL 買主の希望ペット条件が「不可」の買主のみを検索対象に含める
7. WHEN User が Pet_Filter で「どちらでも」を選択する、THE System SHALL ペット条件に関わらず全ての買主を検索対象に含める
8. WHEN 物件種別の選択が変更されて「マンション」が含まれなくなる、THE System SHALL Pet_Filter の選択値を「どちらでも」にリセットする

### 要件2: P台数（駐車場台数）フィルターの追加

**ユーザーストーリー**: 従業員として、駐車場台数条件でフィルタリングして、条件に合う買主を絞り込みたい。

#### 受入基準

1. THE System SHALL Filter_Barに「P台数」フィルターを常時表示する
2. THE Parking_Filter SHALL 「1台」「2台以上」「3台以上」「10台以上」「不要」の5つの選択肢を提供する
3. WHEN User が Parking_Filter を未選択の状態で配信ページを開く、THE System SHALL Parking_Filter のデフォルト値を「指定なし」（全件対象）に設定する
4. WHEN User が Parking_Filter で「不要」を選択する、THE System SHALL 買主のP台数条件が「空欄」「1台」「2台」「不要」のいずれかに該当する買主を検索対象に含める
5. WHEN User が Parking_Filter で「1台」を選択する、THE System SHALL 買主のP台数条件が「不要」「空欄」「1台」のいずれかに該当する買主を検索対象に含める
6. WHEN User が Parking_Filter で「2台以上」を選択する、THE System SHALL 買主のP台数条件が「2台以上」「3台以上」「10台以上」のいずれかに該当する買主を検索対象に含める
7. WHEN User が Parking_Filter で「3台以上」を選択する、THE System SHALL 買主のP台数条件が「3台以上」「10台以上」のいずれかに該当する買主を検索対象に含める
8. WHEN User が Parking_Filter で「10台以上」を選択する、THE System SHALL 買主のP台数条件が「10台以上」の買主のみを検索対象に含める
9. WHEN User が Parking_Filter で「指定なし」を選択する、THE System SHALL P台数条件に関わらず全ての買主を検索対象に含める

### 要件3: 温泉フィルターの追加

**ユーザーストーリー**: 従業員として、温泉の有無条件でフィルタリングして、条件に合う買主を絞り込みたい。

#### 受入基準

1. THE System SHALL Filter_Barに「温泉」フィルターを常時表示する
2. THE Onsen_Filter SHALL 「あり」「なし」「どちらでも」の3つの選択肢を提供する
3. WHEN User が Onsen_Filter を未選択の状態で配信ページを開く、THE System SHALL Onsen_Filter のデフォルト値を「どちらでも」に設定する
4. WHEN User が Onsen_Filter で「あり」を選択する、THE System SHALL 買主の温泉条件が「あり」の買主のみを検索対象に含める
5. WHEN User が Onsen_Filter で「なし」を選択する、THE System SHALL 買主の温泉条件が「空欄」または「なし」の買主を検索対象に含める
6. WHEN User が Onsen_Filter で「どちらでも」を選択する、THE System SHALL 温泉条件に関わらず全ての買主を検索対象に含める

### 要件4: 高層階フィルターの追加

**ユーザーストーリー**: 従業員として、高層階・低層階の希望条件でフィルタリングして、条件に合う買主を絞り込みたい。

#### 受入基準

1. WHILE 物件種別に「マンション」が選択されている、THE System SHALL Filter_Barに「高層階」フィルターを表示する
2. WHILE 物件種別に「マンション」が選択されていない、THE System SHALL Filter_Barから「高層階」フィルターを非表示にする
3. THE Floor_Filter SHALL 「高層階」「低層階」「どちらでも」の3つの選択肢を提供する
4. WHEN User が Floor_Filter を未選択の状態で配信ページを開く、THE System SHALL Floor_Filter のデフォルト値を「どちらでも」に設定する
5. WHEN User が Floor_Filter で「高層階」を選択する、THE System SHALL 買主の高層階条件が「空欄」「高層階」「どちらでも」のいずれかに該当する買主を検索対象に含める
6. WHEN User が Floor_Filter で「低層階」を選択する、THE System SHALL 買主の高層階条件が「空欄」「低層階」「どちらでも」のいずれかに該当する買主を検索対象に含める
7. WHEN User が Floor_Filter で「どちらでも」を選択する、THE System SHALL 高層階条件に関わらず全ての買主を検索対象に含める
8. WHEN 物件種別の選択が変更されて「マンション」が含まれなくなる、THE System SHALL Floor_Filter の選択値を「どちらでも」にリセットする

### 要件5: フィルターの表示条件制御

**ユーザーストーリー**: 従業員として、物件種別に応じて関連するフィルターのみが表示されることで、操作を混乱なく行いたい。

#### 受入基準

1. WHEN User が物件種別で「マンション」を選択する、THE System SHALL Pet_Filter と Floor_Filter を Filter_Bar に表示する
2. WHEN User が物件種別から「マンション」の選択を解除する、THE System SHALL Pet_Filter と Floor_Filter を Filter_Bar から非表示にする
3. THE System SHALL Parking_Filter と Onsen_Filter を物件種別の選択に関わらず常時 Filter_Bar に表示する
4. WHEN Pet_Filter または Floor_Filter が非表示になる、THE System SHALL 該当フィルターの選択値を「どちらでも」にリセットする

### 要件6: フィルターの複合適用

**ユーザーストーリー**: 従業員として、複数のフィルターを同時に適用して、より精度の高い買主絞り込みを行いたい。

#### 受入基準

1. WHEN User が複数のフィルターを選択する、THE System SHALL 全てのフィルター条件をAND条件で適用して買主を絞り込む
2. THE System SHALL 既存の「住所」「価格種別」「物件種別」フィルターと新規追加フィルターを同時に適用する
3. WHEN 全てのフィルターがデフォルト値（「どちらでも」または「指定なし」）の場合、THE System SHALL 既存の検索条件（住所・価格種別・物件種別）のみで買主を絞り込む

### 要件7: バックエンドAPIの拡張

**ユーザーストーリー**: 従業員として、新しいフィルター条件がバックエンドで正確に処理されることを期待する。

#### 受入基準

1. THE System SHALL `/api/buyers/radius-search` エンドポイントのリクエストパラメーターに `pet`、`parking`、`onsen`、`floor` の4つのフィルターパラメーターを追加する
2. WHEN バックエンドが `pet` パラメーターを受け取る、THE System SHALL 買主テーブルの対応するペット条件フィールドに対してマッチングロジックを適用する
3. WHEN バックエンドが `parking` パラメーターを受け取る、THE System SHALL 買主テーブルの対応するP台数フィールドに対してマッチングロジックを適用する
4. WHEN バックエンドが `onsen` パラメーターを受け取る、THE System SHALL 買主テーブルの対応する温泉フィールドに対してマッチングロジックを適用する
5. WHEN バックエンドが `floor` パラメーターを受け取る、THE System SHALL 買主テーブルの対応する高層階フィールドに対してマッチングロジックを適用する
6. IF フィルターパラメーターが省略された場合、THEN THE System SHALL 該当フィルターを適用せず全件を対象とする
