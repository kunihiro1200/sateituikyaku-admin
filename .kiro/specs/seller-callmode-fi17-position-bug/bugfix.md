# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（CallModePage）に表示される「物件位置」マップにおいて、FI17（福岡支店の売主）の物件位置が明らかにおかしい場所に表示されるバグを修正します。

根本原因は `backend/src/services/GeocodingService.ts` の `geocodeAddress()` メソッドにあります。このメソッドは、住所に「大分県」が含まれていない場合、自動的に「大分県」を先頭に付加してジオコーディングを実行します。FIプレフィックスの売主は福岡支店の売主であり、物件住所が福岡県内の住所であっても「大分県」が付加されるため、全く異なる場所（大分県内の誤った位置）にピンが表示されます。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN FIプレフィックスの売主（例: FI17）の物件住所が「大分県」を含まない場合（例: 「福岡市中央区○○」） THEN システムは住所の先頭に「大分県」を自動付加して「大分県福岡市中央区○○」としてジオコーディングを実行する

1.2 WHEN GeocodingServiceが「大分県」を付加した誤った住所でジオコーディングを実行する THEN システムは誤った座標（大分県内の位置）を返し、sellersテーブルに保存する

1.3 WHEN 通話モードページのPropertyMapSectionがFI17の座標を取得する THEN システムは誤った座標に基づいて地図上の誤った位置にピンを表示する

### Expected Behavior (Correct)

2.1 WHEN FIプレフィックスの売主の物件住所が「大分県」を含まない場合 THEN システムSHALL「大分県」を自動付加せず、元の住所のままジオコーディングを実行する

2.2 WHEN GeocodingServiceが正しい住所でジオコーディングを実行する THEN システムSHALL正しい座標を返し、sellersテーブルに保存する

2.3 WHEN 通話モードページのPropertyMapSectionがFI17の座標を取得する THEN システムSHALL正しい座標に基づいて地図上の正しい位置にピンを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN AAプレフィックスの売主（大分支店）の物件住所が「大分県」を含まない場合 THEN システムSHALL CONTINUE TO 住所の先頭に「大分県」を自動付加してジオコーディングを実行する

3.2 WHEN 物件住所が既に「大分県」を含む場合 THEN システムSHALL CONTINUE TO 「大分県」を重複付加せずにジオコーディングを実行する

3.3 WHEN AAプレフィックスの売主の通話モードページを表示する THEN システムSHALL CONTINUE TO 正しい物件位置を地図上に表示する
