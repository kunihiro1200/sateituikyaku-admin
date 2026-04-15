# バグ修正要件ドキュメント

## はじめに

売主リストページ（SellersPage）において、特定の売主（AA13974を含む）の物件場所（GMAP）フィールドが表示されないバグを修正する。

コードベース調査の結果、以下の欠落が確認された：

- `sellersテーブル`には `google_map_url` カラムが存在する（DataIntegrityDiagnosticServiceで参照済み）
- しかし `backend/src/services/SellerService.supabase.ts` の `decryptSeller` メソッドに `googleMapUrl` フィールドのマッピングが存在しない
- そのため、バックエンドAPIのレスポンスに `googleMapUrl` が含まれない
- フロントエンドの `SellersPage.tsx` の `Seller` インターフェースにも `googleMapUrl` フィールドが定義されていない
- 売主リストの表示列にも GMAP リンクが存在しない

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN 売主リストページを表示する THEN システムは物件場所（GMAP）列を表示しない

1.2 WHEN バックエンドAPIが売主リストを返す THEN システムは `googleMapUrl` フィールドを含まないレスポンスを返す

1.3 WHEN `decryptSeller` メソッドが売主データを変換する THEN システムは `sellers.google_map_url` カラムの値をレスポンスオブジェクトにマッピングしない

1.4 WHEN 売主番号 AA13974 の売主リストエントリを表示する THEN システムは物件場所（GMAP）リンクを表示しない

### 期待される動作（正常）

2.1 WHEN バックエンドAPIが売主リストを返す THEN システムは `googleMapUrl` フィールドを含むレスポンスを返すものとする

2.2 WHEN `decryptSeller` メソッドが売主データを変換する THEN システムは `sellers.google_map_url` カラムの値を `googleMapUrl` フィールドとしてレスポンスオブジェクトにマッピングするものとする

2.3 WHEN 売主リストページを表示する THEN システムは `googleMapUrl` が存在する売主に対して物件場所（GMAP）リンクを表示するものとする

2.4 WHEN 売主番号 AA13974 の売主リストエントリを表示する THEN システムは物件場所（GMAP）リンクを正しく表示するものとする

2.5 WHEN `googleMapUrl` が null または空文字列の場合 THEN システムは GMAP リンクを表示せず「-」を表示するものとする

### 変更されない動作（リグレッション防止）

3.1 WHEN 売主リストページを表示する THEN システムは既存の列（売主番号、名前、対応中、最終電話、反響日付、次電日、物件所在地、種別、査定額、営担、訪問日、状況）を引き続き正しく表示するものとする

3.2 WHEN 売主リストAPIが呼び出される THEN システムは既存のフィールド（`propertyAddress`、`propertyType`、`valuationAmount1` 等）を引き続き正しく返すものとする

3.3 WHEN `decryptSeller` メソッドが実行される THEN システムは既存の全フィールドのマッピング（名前の復号化、電話番号の復号化等）を引き続き正しく処理するものとする

3.4 WHEN 売主詳細ページ（SellerDetailPage）や通話モードページ（CallModePage）を表示する THEN システムはこれらのページの動作に影響を与えないものとする

3.5 WHEN 売主リストの検索・フィルタリングを実行する THEN システムは既存の検索・フィルタリング機能を引き続き正しく動作させるものとする

---

## バグ条件の定義

### バグ条件関数

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SellerListRequest
  OUTPUT: boolean

  // 売主リストAPIが呼び出された場合にバグが発生する
  RETURN true  // 全ての売主リスト取得リクエストでバグが発生する
END FUNCTION
```

### 修正確認プロパティ

```pascal
// Property: Fix Checking - googleMapUrl フィールドの存在確認
FOR ALL X WHERE isBugCondition(X) DO
  result <- listSellers'(X)
  ASSERT result.data[i].googleMapUrl IS NOT undefined
  // google_map_url が設定されている売主では値が含まれる
  // google_map_url が null の売主では null が返される（表示時は「-」）
END FOR
```

### 保全プロパティ

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  // 既存フィールドの値は変更されない
  ASSERT listSellers(X).propertyAddress = listSellers'(X).propertyAddress
  ASSERT listSellers(X).propertyType = listSellers'(X).propertyType
  ASSERT listSellers(X).valuationAmount1 = listSellers'(X).valuationAmount1
END FOR
```
