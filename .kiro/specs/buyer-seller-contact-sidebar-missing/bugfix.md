# Bugfix Requirements Document

## Introduction

買主リストのサイドバーカテゴリー「一般媒介_内覧後売主連絡未」に、条件を満たす買主（例：買主7609）が表示されないバグを修正する。

`BuyerStatusCalculator.ts` の Priority 8 判定ロジックに `atbb_status`（物件公開ステータス）のフィルタ条件（`contains(atbb_status, '公開中')`）が含まれているが、仕様書（`buyer-sidebar-status-definition.md`）にはこの条件が存在しない。この不正な条件により、`atbb_status` に "公開中" が含まれない買主が、内覧日・内覧後売主連絡の条件を満たしていてもサイドバーに表示されない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主の `viewing_type_general`（内覧形態_一般媒介）が空でなく、`latest_viewing_date`（内覧日）が2025-08-01以降かつ今日より過去で、`post_viewing_seller_contact`（内覧後売主連絡）が空欄であり、かつ `atbb_status` に "公開中" が含まれない THEN the system は「一般媒介_内覧後売主連絡未」カテゴリーに表示しない（条件Aのバグ）

1.2 WHEN 買主の `post_viewing_seller_contact`（内覧後売主連絡）が "未" であり、かつ `atbb_status` に "公開中" が含まれない THEN the system は「一般媒介_内覧後売主連絡未」カテゴリーに表示しない（条件Bのバグ）

### Expected Behavior (Correct)

2.1 WHEN 買主の `viewing_type_general`（内覧形態_一般媒介）が空でなく、`latest_viewing_date`（内覧日）が2025-08-01以降かつ今日より過去で、`post_viewing_seller_contact`（内覧後売主連絡）が空欄である THEN the system SHALL `atbb_status` の値に関わらず「一般媒介_内覧後売主連絡未」カテゴリーに表示する（条件A）

2.2 WHEN 買主の `post_viewing_seller_contact`（内覧後売主連絡）が "未" である THEN the system SHALL `atbb_status` の値に関わらず「一般媒介_内覧後売主連絡未」カテゴリーに表示する（条件B）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主の `post_viewing_seller_contact`（内覧後売主連絡）が "済" または "不要" である THEN the system SHALL CONTINUE TO 「一般媒介_内覧後売主連絡未」カテゴリーに表示しない

3.2 WHEN 買主の `latest_viewing_date`（内覧日）が今日以降（未来）である THEN the system SHALL CONTINUE TO 条件Aによる「一般媒介_内覧後売主連絡未」カテゴリーに表示しない

3.3 WHEN 買主の `latest_viewing_date`（内覧日）が2025-08-01より前である THEN the system SHALL CONTINUE TO 条件Aによる「一般媒介_内覧後売主連絡未」カテゴリーに表示しない

3.4 WHEN 買主の `viewing_type_general`（内覧形態_一般媒介）が空欄である THEN the system SHALL CONTINUE TO 条件Aによる「一般媒介_内覧後売主連絡未」カテゴリーに表示しない

3.5 WHEN 他のサイドバーカテゴリー（Priority 1-7, 9以降）の判定条件を満たす買主が存在する THEN the system SHALL CONTINUE TO それらのカテゴリーに正しく表示する
