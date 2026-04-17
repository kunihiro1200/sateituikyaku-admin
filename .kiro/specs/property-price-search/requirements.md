# 要件定義ドキュメント

## はじめに

本ドキュメントは、社内管理システム（sateituikyaku-admin）の物件リストページにおける**売買価格検索機能**の要件を定義します。

現状、物件リストの検索バーは物件番号・所在地・売主名・売主電話番号・買主名を対象としており、売買価格（`price` フィールド）は検索対象に含まれていません。そのため「6500000」と入力しても「物件データが見つかりませんでした」と表示されます。

本機能では、ユーザーが数値（例：`6500000`）を検索バーに入力することで、売買価格が一致する物件を検索結果に表示できるようにします。

---

## 用語集

- **PropertyListingsPage**: 物件リストページ（`frontend/frontend/src/pages/PropertyListingsPage.tsx`）
- **Search_Filter**: フロントエンドの `filteredListings` useMemo 内で実行されるクライアントサイドの検索フィルタリング処理
- **price**: `property_listings` テーブルの売買価格カラム（数値型、単位：円）
- **normalizeText**: 全角→半角変換（NFKC）と小文字化を行うフロントエンドのユーティリティ関数
- **searchQuery**: ユーザーが検索バーに入力したテキスト文字列

---

## 要件

### 要件 1: 売買価格による物件検索

**ユーザーストーリー:** 担当者として、売買価格の数値を検索バーに入力して物件を絞り込みたい。そうすることで、特定の価格帯の物件をすばやく見つけられる。

#### 受け入れ基準

1. WHEN ユーザーが検索バーに数値文字列（例：`6500000`）を入力したとき、THE Search_Filter SHALL `price` フィールドを文字列に変換した値が入力文字列を含む物件を検索結果に含める

2. WHEN ユーザーが検索バーに数値文字列を入力したとき、THE Search_Filter SHALL 既存の検索対象フィールド（物件番号・所在地・表示用所在地・売主名・売主メール・売主電話番号・買主名）に加えて `price` フィールドも検索対象として評価する

3. WHEN `price` フィールドが `null` または `undefined` の物件に対して価格検索が実行されたとき、THE Search_Filter SHALL その物件を検索結果から除外する（エラーを発生させない）

4. WHEN ユーザーが検索バーに部分的な数値文字列（例：`650`）を入力したとき、THE Search_Filter SHALL `price` フィールドの文字列表現に入力文字列が含まれる物件（例：`6500000`、`65000000`）を検索結果に含める

5. THE Search_Filter SHALL 既存の検索対象フィールドへの検索動作を変更しない（後方互換性を維持する）

---

### 要件 2: 全角数字による価格検索

**ユーザーストーリー:** 担当者として、全角数字（例：`６５００００００`）で入力しても検索できるようにしたい。そうすることで、日本語入力モードのまま検索できる。

#### 受け入れ基準

1. WHEN ユーザーが検索バーに全角数字（例：`６５００００００`）を入力したとき、THE Search_Filter SHALL `normalizeText` 関数による NFKC 正規化を適用して半角数字に変換した上で `price` フィールドと照合する

2. THE Search_Filter SHALL `price` フィールドの文字列変換に対しても `normalizeText` 関数を適用して照合する

---

### 要件 3: 検索結果の表示整合性

**ユーザーストーリー:** 担当者として、価格検索の結果が他の検索条件と同様に表示されることを期待する。そうすることで、一貫した操作感で物件を探せる。

#### 受け入れ基準

1. WHEN 価格検索によって物件が絞り込まれたとき、THE PropertyListingsPage SHALL 既存の表示ロジック（ページネーション・ソート・非公開物件の後方配置）をそのまま適用する

2. WHEN 価格検索の結果が 0 件のとき、THE PropertyListingsPage SHALL 「物件データが見つかりませんでした」と表示する

3. WHILE サイドバーステータスフィルターが選択されているとき、THE Search_Filter SHALL 価格検索との排他制御（サイドバーと検索は相互にクリアする）を既存の動作と同様に維持する

---

### 要件 4: バックエンド API の検索対象拡張（オプション）

**ユーザーストーリー:** 将来的にサーバーサイド検索に移行する場合に備えて、バックエンドの検索 API も価格フィールドを対象にしたい。

#### 受け入れ基準

1. WHERE バックエンドの `search` クエリパラメータが使用されるとき、THE PropertyListingService SHALL `price` フィールドを `ilike` 検索の対象に含める

2. WHEN `search` パラメータに数値文字列が渡されたとき、THE PropertyListingService SHALL `price::text ilike '%{search}%'` の形式で Supabase クエリを構築する

---

## 補足：現状の実装と変更箇所

### フロントエンド（主要変更箇所）

**ファイル**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

現在の検索フィルタ（317〜325行目付近）:
```typescript
listings = listings.filter(l =>
  (l.property_number ? normalizeText(l.property_number) : '').includes(query) ||
  (l.address ? normalizeText(l.address) : '').includes(query) ||
  (l.display_address ? normalizeText(l.display_address) : '').includes(query) ||
  (l.seller_name ? normalizeText(l.seller_name) : '').includes(query) ||
  (l.seller_email ? normalizeText(l.seller_email) : '').includes(query) ||
  (l.seller_phone ? normalizeText(l.seller_phone) : '').includes(query) ||
  (l.buyer_name ? normalizeText(l.buyer_name) : '').includes(query)
);
```

`price` フィールドの追加が必要:
```typescript
(l.price != null ? normalizeText(String(l.price)) : '').includes(query) ||
```

### バックエンド（オプション変更箇所）

**ファイル**: `backend/src/services/PropertyListingService.ts`

現在の検索クエリ（`getAll` メソッド内）:
```typescript
query = query.or(`property_number.ilike.%${search}%,address.ilike.%${search}%,...`);
```

`price` フィールドの追加が必要（Supabase の型キャスト構文）:
```typescript
query = query.or(`property_number.ilike.%${search}%,...,price.eq.${search}`);
// または cast を使う場合は RPC / raw SQL が必要
```
