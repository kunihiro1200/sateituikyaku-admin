# Bugfix Requirements Document

## Introduction

売主リストのサイドバーにある「当日TEL分」カテゴリーのフィルタリングロジックに不具合がある。
状況（当社）フィールドに「追客不要」を含む売主（「追客不要」「除外済追客不要」等）が「当日TEL分」に表示されてしまっている。
これらのステータスを持つ売主は架電対象外であるため、「当日TEL分」から除外されなければならない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 売主の状況（当社）が「追客不要」である THEN システムはその売主を「当日TEL分」カテゴリーに表示してしまう

1.2 WHEN 売主の状況（当社）が「除外済追客不要」等、「追客不要」を含む文字列である THEN システムはその売主を「当日TEL分」カテゴリーに表示してしまう

### Expected Behavior (Correct)

2.1 WHEN 売主の状況（当社）が「追客不要」である THEN システムはその売主を「当日TEL分」カテゴリーから除外しなければならない（SHALL）

2.2 WHEN 売主の状況（当社）が「追客不要」を含む文字列（「除外済追客不要」等）である THEN システムはその売主を「当日TEL分」カテゴリーから除外しなければならない（SHALL）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 売主の状況（当社）が「追客不要」を含まない通常のステータスであり、かつ当日TEL対象の条件を満たす THEN システムはその売主を「当日TEL分」カテゴリーに引き続き表示しなければならない（SHALL CONTINUE TO）

3.2 WHEN 売主の状況（当社）が「追客不要」を含まない THEN システムは他のサイドバーカテゴリー（「当日TEL分」以外）の表示件数に影響を与えてはならない（SHALL CONTINUE TO）

3.3 WHEN 売主の状況（当社）が「追客不要」を含む THEN システムは「当日TEL分」以外のカテゴリーへの表示には影響を与えてはならない（SHALL CONTINUE TO）
