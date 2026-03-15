# Bugfix Requirements Document

## Introduction

物件リストの一覧画面（`/property-listings`）と詳細画面（`/property-listings/:propertyNumber`）のメインカラーが緑になっているバグを修正する。

根本原因は `frontend/frontend/src/main.tsx` のMUIグローバルテーマで `primary.main` が `#2e7d32`（緑）に設定されていること。これにより、MUIコンポーネントのデフォルトprimaryカラーが全画面で緑になっている。物件リストページは `SECTION_COLORS.property.main`（`#2196f3` 青）を個別のsxプロパティで指定しているが、MUIのデフォルトprimaryカラーを使うコンポーネント（ボタン、バッジ、リストアイテムのselected状態等）は緑のままになっている。

正しいメインカラーは濃いめのブルー（`#1565c0`）であるべき。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが物件リスト一覧画面（`/property-listings`）を開く THEN MUIコンポーネント（ボタン、バッジ、選択状態のリストアイテム等）のメインカラーが緑（`#2e7d32`）で表示される

1.2 WHEN ユーザーが物件リスト詳細画面（`/property-listings/:propertyNumber`）を開く THEN MUIコンポーネントのメインカラーが緑（`#2e7d32`）で表示される

1.3 WHEN `main.tsx` のMUIグローバルテーマの `primary.main` が `#2e7d32`（緑）に設定されている THEN 物件リストページのMUIデフォルトprimaryカラーを使うコンポーネントが緑で表示される

### Expected Behavior (Correct)

2.1 WHEN ユーザーが物件リスト一覧画面（`/property-listings`）を開く THEN MUIコンポーネントのメインカラーが濃いめのブルー（`#1565c0`）で表示される

2.2 WHEN ユーザーが物件リスト詳細画面（`/property-listings/:propertyNumber`）を開く THEN MUIコンポーネントのメインカラーが濃いめのブルー（`#1565c0`）で表示される

2.3 WHEN `main.tsx` のMUIグローバルテーマの `primary.main` が濃いめのブルー（`#1565c0`）に変更される THEN 物件リストページのMUIコンポーネントが正しいブルーで表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが売主リスト画面（`/sellers`）を開く THEN `SECTION_COLORS.seller.main`（`#d32f2f` 赤）を使った個別のsxプロパティによるカラー指定は引き続き正しく表示される

3.2 WHEN ユーザーが買主リスト画面（`/buyers`）を開く THEN `SECTION_COLORS.buyer.main`（`#4caf50` 緑）を使った個別のsxプロパティによるカラー指定は引き続き正しく表示される

3.3 WHEN ユーザーがログイン画面を含む全ての画面を操作する THEN MUIのデフォルトprimaryカラーを使うコンポーネント（ボタン等）が濃いめのブルー（`#1565c0`）で表示される
