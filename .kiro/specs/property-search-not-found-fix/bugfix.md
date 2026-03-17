# Bugfix Requirements Document

## Introduction

物件リストページ（`PropertyListingsPage`）の検索バーで`AA9195`のような物件番号を入力しても「物件データが見つかりませんでした」と表示されるバグ。DBには該当データが存在しているにもかかわらず、フロントエンドのクライアントサイドフィルタリングが機能しない。

根本原因は2つある：

1. **フロントエンドの全件取得が不完全**: `fetchAllData`は`limit=1000`でページネーションしながら全件取得しているが、`property_number`の降順ソートにより古い番号（`AA9195`など）は1000件目以降に位置する可能性があり、取得されない。

2. **`buyer_name`カラムがSELECT文に含まれていない**: バックエンドの`getAll`のSELECT文に`buyer_name`が含まれていないため、フロントエンドの`l.buyer_name`は常に`undefined`となり、買主名での検索が機能しない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが物件リストページの検索バーに`AA9195`のような古い物件番号を入力する THEN システムは「物件データが見つかりませんでした」と表示する

1.2 WHEN フロントエンドが`/api/property-listings`から全件取得する THEN システムは`distribution_date`降順・`property_number`降順でソートされた最初の1000件のみを取得し、それ以降の物件（古い番号の物件）は取得されない

1.3 WHEN ユーザーが買主名で検索する THEN システムは常に結果を返さない（`buyer_name`がSELECT文に含まれていないため`undefined`になる）

### Expected Behavior (Correct)

2.1 WHEN ユーザーが物件リストページの検索バーに任意の物件番号を入力する THEN システムはDBに存在する該当物件を正しく表示する

2.2 WHEN フロントエンドが全件取得する THEN システムはDBに存在する全物件を漏れなく取得する（件数に関わらず）

2.3 WHEN ユーザーが買主名で検索する THEN システムは`buyer_name`を含む物件を正しく返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが物件リストページを開く THEN システムは引き続き物件一覧を表示する

3.2 WHEN ユーザーがサイドバーステータスでフィルタリングする THEN システムは引き続き該当ステータスの物件のみを表示する

3.3 WHEN ユーザーが担当者でフィルタリングする THEN システムは引き続き該当担当者の物件のみを表示する

3.4 WHEN ユーザーが物件行をクリックする THEN システムは引き続き物件詳細ページへ遷移する

3.5 WHEN ユーザーがページネーションを操作する THEN システムは引き続き正しくページを切り替える
