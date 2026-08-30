# 売主検索とハッシュ整合性のルール

## ⚠️ 重要：「DBから消えた」と見えたら、まず検索の仕様を疑う

売主が「登録されたはずなのに消えている」と報告された場合、
**実際にはレコードが存在していて、検索がヒットしていないだけ**のケースがある。

削除を疑って復元作業に入る前に、必ず `seller_number` かDB直接クエリで存在確認すること。

---

## 🚨 過去の障害（2026年8月）

### 症状

FI589（海出 務 / 08039968317 / 福岡県大野城市紫台18）が
**電話番号・名前・物件住所のどれで検索してもヒットしない**。
「イエウールから自動転記されたのに勝手に消えた」と判断された。

### 実際の状態

レコードは正常に存在していた。

| 項目 | 値 |
|---|---|
| 売主番号 | FI589 |
| 作成日時 | 2026-06-20 11:46 JST（メール受信の1分後） |
| deleted_at | null（＝通常リストに存在） |
| 状況（当社） | 除外済追客不要 |

**消えていたのではなく「検索で見つけられなかった」だけだった。**

---

### 原因1：検索対象が「直近500件」に限定されていた

`SellerService.searchSellers()` の暗号化カラム検索が、
`updated_at` 降順の **500件だけ** を取得して復号比較していた。

```typescript
// ❌ 修正前（更新が古い売主は構造的に検索不能）
let sellerQuery = this.table('sellers')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(500);   // ← ここが致命的
```

名前・住所・電話番号は暗号化されているためDBの `ilike` が使えず、
「取得して復号して比較」する必要がある。その母集団が500件しかなかった。

```typescript
// ✅ 修正後（全件を並列取得して走査）
// 1. 平文カラム（property_address / seller_number）はDBのilikeで先に絞り込む
// 2. 暗号化カラムは全件をページ並列取得して復号比較（軽量カラムのみ取得）
// 3. ヒットしたIDだけ本体（select('*, properties(*)')）を取得
```

**重要な設計ポイント**：

- `property_address` は**平文**なのでDBの `ilike` で検索できる（暗号化カラムと混同しない）
- `name` / `address` / `phone_number` / `email` は暗号化されているので復号比較が必須
- 電話番号は**ハイフン・空白を除去した数字同士**で比較する（`080-3996-8317` でも一致させる）
- ページ取得は逐次だと8,000件超で5〜6秒かかる → `Promise.all` で並列化して約2秒
- 上限（200件）で打ち切り、ヒットしたIDだけ本体を取得して負荷を抑える

---

### 原因2：`phone_number_hash` / `email_hash` が暗号文のハッシュになっていた

電話番号検索の高速パスは `phone_number_hash = sha256(平文)` で引く。
ところが一部レコードは `sha256(暗号文)` が保存されていた。

```
DBのハッシュ          : 50d222ab...  ← sha256(暗号化された文字列)
sha256("08039968317") : 6890a410...  ← 検索時に使う値
```

**原因**：過去のハッシュ補完バックフィルが `ENCRYPTION_KEY` 未設定/不正な状態で実行された。
多くのスクリプトの `decrypt()` は復号できないとき**暗号文をそのまま返す**フォールバックを持つため、
その戻り値をハッシュ化してしまった。

**影響範囲**：電話 408件 / メール 406件（全8,764件中）

**影響**：
- 電話番号検索の高速パスでヒットしない
- **重複検出が機能しない**（`idx_sellers_unique_phone_datetime` と重複判定はこのハッシュに依存）

**修正**：`backend/fix-phone-email-hashes.ts` で平文から再計算（実行済み）

---

## 🔧 ハッシュを扱うときの絶対ルール

### ルール1：ハッシュは必ず「平文」から作る

```typescript
// ✅ 正しい
phone_number_hash: tel ? crypto.createHash('sha256').update(tel).digest('hex') : null,
phone_number: encrypt(tel),

// ❌ 間違い（暗号文をハッシュ化 → 検索も重複検出も壊れる）
const encrypted = encrypt(tel);
phone_number_hash: crypto.createHash('sha256').update(encrypted).digest('hex'),
```

### ルール2：復号できないときはハッシュを書かない

`decrypt()` が暗号文をそのまま返す実装のスクリプトでハッシュを作ると、今回の障害が再発する。
バックフィル系スクリプトでは以下を必須にする。

```typescript
// ✅ 復号失敗時は null を返す実装にする（暗号文を返さない）
function decryptStrict(value: string | null): string | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 32) return null;   // キー不正なら諦める
  try { /* ... */ } catch { return null; }
}

// ✅ 実行前に「本当に復号できるか」をサンプルで検証し、できなければ中断する
if (probeOk === 0) {
  console.error('❌ ENCRYPTION_KEY で復号できません。中断します。');
  process.exit(1);
}
```

### ルール3：電話番号を更新したらハッシュも必ず更新する

`phone_number` を書き換える処理では `phone_number_hash` も同時に再計算する。
（`SellerService.updateSeller()` / `EnhancedAutoSyncService` は対応済み）

---

## 🔍 整合性チェックの手順

```bash
# ハッシュのズレを検出（読み取りのみ・更新しない）
npx ts-node backend/check-phone-hash-integrity.ts

# ズレを修復（まず --dry-run で件数確認）
npx ts-node backend/fix-phone-email-hashes.ts --dry-run
npx ts-node backend/fix-phone-email-hashes.ts

# 検索が実際にヒットするか検証
npx ts-node backend/verify-search-fi589.ts
```

---

## 📋 「売主が消えた」と報告されたときの調査順序

1. **`seller_number` で検索**（平文カラムなので必ずヒットする）
2. DBを直接確認する
   ```sql
   -- 電話番号ハッシュで検索（削除済みも含める）
   SELECT seller_number, deleted_at, is_restored, status
   FROM sellers
   WHERE phone_number_hash = '<sha256(電話番号)>';

   -- 物件住所は平文なので部分一致で探せる
   SELECT seller_number, property_address, deleted_at, status
   FROM sellers WHERE property_address ILIKE '%紫台%';
   ```
3. `deleted_at` を確認 → null なら**削除されていない**
4. 見つかった場合、なぜ画面に出なかったかを切り分ける
   - 検索の仕様（→ 本ドキュメント）
   - ハッシュのズレ（→ 本ドキュメント）
   - ステータス（例：`除外済追客不要` は追客系カテゴリーに出ない）
   - FI売主は福岡セクションに表示される（メインカテゴリーには出ない）

**❌ 存在確認をせずに復元作業を始めてはいけない。**

---

## 🗂 復元レコードの扱い（関連ルール）

削除レコードを復元する場合、**`deleted_at` を null に戻してはいけない。**

既存のクエリは約40箇所すべてが `deleted_at IS NULL` で絞っているため、
`deleted_at` を null にすると復元レコードが全カテゴリーの件数に混入する。

**2026年8月の障害**：復元142件の `deleted_at` を null にしたところ、
「当日TEL_未着手」等のサイドバー件数が一斉に増加した。

**正しい方式**：

| カラム | 値 | 意味 |
|---|---|---|
| `deleted_at` | 設定したまま | 既存の全クエリから自動的に除外される |
| `is_restored` | `true` | 「復元」カテゴリーの抽出条件 |
| `restored_at` | 復元日時 | 記録用 |

- 「復元」カテゴリーのときだけ `deleted_at` フィルタを外して `is_restored = true` で抽出する
  （`SellerService.listSellers()` の `statusCategory !== 'restored'` 条件）
- サイドバーの `restored` 件数も `deleted_at` フィルタなしで集計する
- 復元専用の分離スクリプト：`backend/separate-restored-sellers.ts`

---

## 🎯 まとめ

1. **「消えた」と聞いたら、まず存在確認**（`seller_number` かDB直接クエリ）
2. **検索の母集団に上限をかけない**（`limit(500)` のような制限は再発の元）
3. **ハッシュは平文から作る**（暗号文をハッシュ化しない）
4. **復号できないときはハッシュを書かない**（`ENCRYPTION_KEY` 未設定での実行を防ぐ）
5. **平文カラム（`property_address` / `seller_number`）はDBの `ilike` で検索できる**
6. **復元レコードは `deleted_at` を保持し、`is_restored` で分離する**

---

**最終更新日**: 2026年8月31日
**作成理由**: FI589（海出 務）が電話番号・名前・物件住所のどれでも検索できず、
削除されたと誤認された障害の再発防止
**関連ファイル**:
- `backend/src/services/SellerService.supabase.ts`（`searchSellers` / `listSellers`）
- `backend/src/services/SellerSidebarCountsUpdateService.ts`
- `backend/fix-phone-email-hashes.ts`
- `backend/check-phone-hash-integrity.ts`
- `backend/verify-search-fi589.ts`
- `backend/separate-restored-sellers.ts`
