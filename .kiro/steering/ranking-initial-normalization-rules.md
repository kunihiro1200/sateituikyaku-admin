---
inclusion: auto
---

# ランキング集計：スタッフイニシャル正規化ルール

## ⚠️ 絶対に守るべきルール

**ランキング集計時は、必ず `buildNormalizeInitialMap()` を使ってイニシャルを正規化すること。**
生の文字列をそのままカウントしてはいけない。

---

## 🔴 背景・問題

DBのランキング集計カラム（`first_call_person`, `visit_valuation_acquirer` 等）には、
同一スタッフが以下のような複数の表記で混在して保存されている。

| 実際のイニシャル | DBに入っている表記の例 |
|--------------|------------------|
| K（国広智子） | `K`, `k`, `Ｋ`, `国広智子` |
| W | `W`, `w`, `Ｗ`, `ｗ` |
| R（木村侑里音） | `R`, `木村侑里音` |
| U（裏天真） | `U`, `裏天真` |
| 和（和田 樹奈） | `和`, `和田　樹奈` |
| 久（久米マリ子） | `久`, `久米マリ子` |
| H | `H`, `Ｈ` |

---

## ✅ 現在のスタッフ一覧（employeesテーブル）

| イニシャル | 姓名 |
|---------|------|
| H | 廣瀬尚美 |
| I | 角井宏充 |
| IF | メール担当 |
| K | 国広智子 |
| R | 木村侑里音 |
| U | 裏天真 |
| Y | 山本裕子 |
| 久 | 久米マリ子 |
| 和 | 和田　樹奈 |
| 林 | 林田　元汰 |
| 生 | 生野陸斗 |
| 麻 | 麻生華蓮 |

**スタッフが追加・変更された場合は、このテーブルも更新すること。**

---

## ✅ 正規化ヘルパー関数

**ファイル**: `backend/src/routes/sellers.ts`

**関数名**: `buildNormalizeInitialMap(supabase)`

```typescript
// 使い方
const normalizeInitial = await buildNormalizeInitialMap(supabase);
const initial = normalizeInitial(rawValue.trim());
```

**正規化ロジック（優先順位）**:
1. **姓名フル → イニシャル**（例: `国広智子` → `K`）
2. **全角英字 → 半角大文字**（例: `Ｋ` → `K`, `ｗ` → `W`）
3. **小文字 → 大文字**（例: `k` → `K`, `w` → `W`）
4. **一致しない場合はそのまま返す**（未知の値）

---

## 🔴 対象ランキングエンドポイント（4つ全て適用済み）

| エンドポイント | 集計カラム | 基準日付カラム |
|------------|---------|------------|
| `GET /api/sellers/call-ranking` | `first_call_person` | `inquiry_date` |
| `GET /api/sellers/call-ranking-yearly` | `first_call_person` | `inquiry_date` |
| `GET /api/sellers/visit-ranking` | `visit_valuation_acquirer` | `visit_acquisition_date` |
| `GET /api/sellers/visit-ranking-yearly` | `visit_valuation_acquirer` | `visit_acquisition_date` |
| `GET /api/sellers/call-tracking-ranking` | スプシ「担当（前半）」「担当（後半）」列 | スプシ「日付」列 |

---

## 🚫 絶対にやってはいけないこと

```typescript
// ❌ 正規化なしでそのままカウント（表記揺れが別人として集計される）
const initial = row.visit_valuation_acquirer as string;
counts.set(initial, (counts.get(initial) || 0) + 1);

// ✅ 正しい（必ず正規化してからカウント）
const raw = (row.visit_valuation_acquirer as string).trim();
const initial = normalizeInitial(raw);
counts.set(initial, (counts.get(initial) || 0) + 1);
```

---

## 📝 新しいランキングエンドポイントを追加する際のルール

1. `buildNormalizeInitialMap(supabase)` を必ず呼び出す
2. カウント前に `normalizeInitial(raw.trim())` を必ず通す
3. このドキュメントの「対象ランキングエンドポイント」テーブルに追加する

---

## 🔧 過去の問題（2026年6月5日）

**問題**: 訪問査定取得ランキングでKが3件と表示されたが実際は5件

**原因**: `visit_valuation_acquirer` に `K` と `国広智子` が混在しており、
正規化なしで集計したため別人としてカウントされた

**修正**: `buildNormalizeInitialMap()` を4つの全ランキングエンドポイントに適用

---

**最終更新日**: 2026年6月5日
**作成理由**: ランキング集計でスタッフのイニシャル表記揺れ（全角・小文字・氏名）による集計ミスの再発防止
