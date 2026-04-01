# Bugfix Requirements Document

## Introduction

売主リストのサイドバーで「一般（23）」カテゴリをクリックすると、カウント表示は23件だが、実際には全件が展開リストに表示されてしまうバグを修正します。

根本原因は、バックエンドの `SellerService.supabase.ts` の `case 'general':` のフィルタリング条件が間違っていることです。現在の条件は「次電日が今日より後」（`.gt('next_call_date', todayJST)`）となっていますが、正しくは「次電日が今日ではない」（`.neq('next_call_date', todayJST)`）である必要があります。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN サイドバーの「一般（23）」をクリック THEN システムは23件ではなく全件を展開リストに表示する

1.2 WHEN バックエンドが一般カテゴリのフィルタリングを実行 THEN システムは `.gt('next_call_date', todayJST)` （次電日が今日より後）という間違った条件を使用する

### Expected Behavior (Correct)

2.1 WHEN サイドバーの「一般（23）」をクリック THEN システムは正確に23件のみを展開リストに表示する

2.2 WHEN バックエンドが一般カテゴリのフィルタリングを実行 THEN システムは `.neq('next_call_date', todayJST)` （次電日が今日ではない）という正しい条件を使用する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 他のサイドバーカテゴリ（専任、訪問後他決など）をクリック THEN システムは引き続き正しい件数を表示する

3.2 WHEN 一般カテゴリのカウント計算（GAS側）を実行 THEN システムは引き続き正しいカウント（23件）を計算する

3.3 WHEN 一般カテゴリ以外のフィルタリング条件を使用 THEN システムは引き続き正しく動作する
