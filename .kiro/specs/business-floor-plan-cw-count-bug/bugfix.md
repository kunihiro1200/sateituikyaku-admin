# Bugfix Requirements Document

## Introduction

業務リスト（Business List）の間取図確認セクションにおいて、「間取図300円（CW）計」の集計値が誤った値（例：153）を表示するバグを修正する。正しくは、CW（外部業者）が担当した間取図の件数のみをカウントすべきところ、誤ったフィールドや誤った集計範囲を参照しているため、実際の件数（例：3）とかけ離れた値が表示されている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 業務リストの間取図確認セクションで「間取図300円（CW）計」を表示する THEN システムは誤った集計値（例：153）を表示する
1.2 WHEN CW担当の間取図件数を集計する THEN システムは誤ったフィールドまたは誤った集計範囲（全レコードの合計や別フィールドの値）を参照して計算する

### Expected Behavior (Correct)

2.1 WHEN 業務リストの間取図確認セクションで「間取図300円（CW）計」を表示する THEN システムは SHALL CW（外部業者）が担当した間取図の正しい件数（例：3）を表示する
2.2 WHEN CW担当の間取図件数を集計する THEN システムは SHALL 対象レコードのCW担当間取図フィールドのみを正しく参照して件数を計算する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 間取図修正回数（1〜4のボタン）を記録する THEN システムは SHALL CONTINUE TO 当社ミスによる修正回数を正しくカウントする（CWミスによる修正はカウント対象外）
3.2 WHEN 間取図確認セクションの他の集計項目（CW以外）を表示する THEN システムは SHALL CONTINUE TO それぞれの正しい集計値を表示する
3.3 WHEN 業務リストの他のセクションの集計値を表示する THEN システムは SHALL CONTINUE TO 各セクションの正しい集計値を表示する
