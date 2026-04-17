# Bugfix Requirements Document

## Introduction

物件リスト画面のサイドバーにおいて、「レインズ登録＋SUUMO登録」カテゴリーに表示されている物件（例: AA13600）が、対応済みの状態（SUUMO URLの登録など）にしたにもかかわらず、カテゴリーから消えないバグを修正します。

**影響範囲**: 物件リストページのサイドバー「レインズ登録＋SUUMO登録」カテゴリー

**バグ条件 C(X)**:
```
C(X) = property_listings.sidebar_status === 'レインズ登録＋SUUMO登録'
       AND（suumo_url が登録済み OR 対応済み条件を満たす状態に変更された）
       AND sidebar_status が再計算・更新されていない
```

**バグ条件関数（擬似コード）**:
```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PropertyListing
  OUTPUT: boolean

  RETURN X.sidebar_status = 'レインズ登録＋SUUMO登録'
         AND (X.suumo_url IS NOT NULL AND X.suumo_url != '')
         // 対応済みにしたにもかかわらずsidebar_statusが古い値のまま
END FUNCTION
```

**修正チェックプロパティ（擬似コード）**:
```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← calculateSidebarStatus'(X)
  ASSERT result != 'レインズ登録＋SUUMO登録'
END FOR
```

**保存チェックプロパティ（擬似コード）**:
```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件の `suumo_url` が登録済み（空でない）の状態で `PUT /api/property-listings/:propertyNumber` が呼び出される THEN システムは `sidebar_status` を再計算せず、古い「レインズ登録＋SUUMO登録」の値がデータベースに残り続ける

1.2 WHEN レインズ登録ページ（ReinsRegistrationPage）でSUUMO URLを保存する THEN システムは `property_listings` テーブルの `suumo_url` フィールドのみを更新し、`sidebar_status` の再計算・更新をトリガーしない

1.3 WHEN `sidebar_status` が「レインズ登録＋SUUMO登録」のまま残っている THEN システムはサイドバーのカテゴリーフィルターで当該物件を「レインズ登録＋SUUMO登録」カテゴリーに表示し続ける

### Expected Behavior (Correct)

2.1 WHEN 物件の `suumo_url` が登録済み（空でない）の状態で `PUT /api/property-listings/:propertyNumber` が呼び出される THEN システムは `sidebar_status` を再計算し、「レインズ登録＋SUUMO登録」以外の適切なステータス（例: 担当別ステータスまたは「専任・公開中」）に更新する

2.2 WHEN レインズ登録ページでSUUMO URLを保存する THEN システムは `suumo_url` の更新後に `sidebar_status` を再計算し、データベースに正しい値を保存する

2.3 WHEN `sidebar_status` が正しく更新される THEN システムはサイドバーのカテゴリーフィルターで当該物件を「レインズ登録＋SUUMO登録」カテゴリーから除外し、適切なカテゴリーに表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件の `suumo_url` が空 AND `atbb_status` が「専任・公開中」 AND `publish_scheduled_date` が昨日以前 THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」カテゴリーに表示する

3.2 WHEN 物件の `suumo_url` が空 AND `atbb_status` が「一般・公開中」 AND `publish_scheduled_date` が昨日以前 THEN システムは引き続き物件を「SUUMO URL　要登録」カテゴリーに表示する

3.3 WHEN `suumo_url` 以外のフィールド（例: `special_notes`、`report_date`）が更新される THEN システムは引き続き `sidebar_status` を正しく計算して保存する

3.4 WHEN 物件の `suumo_registered` が「S不要」 THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」カテゴリーに表示しない

3.5 WHEN `calculateSidebarStatus()` が他のステータス（未報告、未完了、本日公開予定など）を計算する THEN システムは引き続き正しいステータスを返す
