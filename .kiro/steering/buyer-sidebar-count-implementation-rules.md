---
inclusion: fileMatch
fileMatchPattern: '**/BuyerService.ts'
---

# 買主サイドバーカウント実装ルール（実装漏れ防止）

## ⚠️ 重要：カテゴリ判定ロジックは3箇所に実装が必要

買主サイドバーの新規カテゴリを追加・変更する際、**以下の3箇所すべてに実装しないと表示されない**。
どれか1つでも漏れると、テーブルには入っているのにサイドバーに表示されないバグが発生する。

---

## 🚨 過去の障害

**発生日**: 2026年8月  
**症状**: 「内覧アンケート未」カテゴリが `buyer_sidebar_counts` テーブルに `count: 2` と入っているのに、サイドバーに表示されなかった  
**原因**: `_buildSidebarCountsFromCache()` のforループ内に `viewingSurveyUnchecked` のカウント処理が**抜けていた**  
**修正コミット**: `4e614bc9`

---

## 📍 実装が必要な3箇所

### 1. `_buildSidebarCountsFromCache()` ← 最重要・最も漏れやすい

**ファイル**: `backend/src/services/BuyerService.ts`

**役割**: ページロード時にリアルタイムでカウントを計算して返す（本番で実際に使われるメインの処理）

**判定方式**: `calculated_status` を見るカテゴリと、フィールドを直接見るカテゴリの2種類がある

```typescript
// ✅ calculated_statusベースのカテゴリ（例）
if (status === '内覧未確定') result.viewingUnconfirmed++;

// ✅ フィールド直接判定のカテゴリ（例）
// ← 内覧アンケート未はこちら。for loopの末尾に追加すること
const hasSurveyResult = buyer.viewing_survey_result && String(buyer.viewing_survey_result).trim();
const isSurveyConfirmed = buyer.viewing_survey_confirmed && String(buyer.viewing_survey_confirmed).trim();
if (hasSurveyResult && !isSurveyConfirmed) result.viewingSurveyUnchecked++;
```

**⚠️ 注意**: `calculated_status` に入らないカテゴリは、for ループのelse if チェーンには書けない。
ループの末尾（`// 持ち家ヒアリング統計（月別）` コメントの前）に独立して追加すること。

---

### 2. `getSidebarCountsFallback()` 

**ファイル**: `backend/src/services/BuyerService.ts`

**役割**: Cronジョブ（`/api/buyers/update-sidebar-counts`）が `buyer_sidebar_counts` テーブルを更新する際に使う

```typescript
// 内覧アンケート未確認: viewing_survey_result が入力済み かつ viewing_survey_confirmed が空欄
allBuyers.forEach((buyer: any) => {
  const hasSurveyResult = buyer.viewing_survey_result && String(buyer.viewing_survey_result).trim();
  const isConfirmed = buyer.viewing_survey_confirmed && String(buyer.viewing_survey_confirmed).trim();
  if (hasSurveyResult && !isConfirmed) {
    result.viewingSurveyUnchecked++;
  }
});
```

---

### 3. `getBuyersByStatus()` のフィルタロジック

**ファイル**: `backend/src/services/BuyerService.ts`

**役割**: サイドバーのカテゴリをクリックしたとき、該当買主を絞り込んで表示する

```typescript
} else if (status === 'viewingSurveyUnchecked') {
  filteredBuyers = allBuyers.filter((buyer: any) => {
    const hasSurveyResult = buyer.viewing_survey_result && String(buyer.viewing_survey_result).trim();
    const isSurveyConfirmed = buyer.viewing_survey_confirmed && String(buyer.viewing_survey_confirmed).trim();
    return hasSurveyResult && !isSurveyConfirmed;
  });
```

---

## ✅ 新規カテゴリ追加時のチェックリスト

新しいサイドバーカテゴリを追加するときは、以下を**必ず全部やること**：

- [ ] **1. `_buildSidebarCountsFromCache()` にカウント処理を追加**
  - `calculated_status`ベース → `else if` チェーンに追加
  - フィールド直接判定 → forループ末尾に独立して追加
- [ ] **2. `getSidebarCountsFallback()` にカウント処理を追加**（Cronジョブ用）
- [ ] **3. `getBuyersByStatus()` にフィルタ処理を追加**（クリック時の絞り込み用）
- [ ] **4. `updateSidebarCountsTable()` の `rows.push()` に追加**（テーブル保存用）
- [ ] **5. `BuyerStatusSidebar.tsx` の `newCategories` 配列に追加**（フロントエンド表示用）
- [ ] **6. `getCategoryLabel()` にラベル追加**
- [ ] **7. `getCategoryColor()` に色追加**
- [ ] **8. `CategoryCounts` インターフェースに型定義追加**
- [ ] **9. `backendEnglishKeyCategories` 配列に追加**（BuyersPage.tsxのフィルタパラメータ用）
- [ ] **10. フロントエンドのフィルタロジック `selectedCalculatedStatus === 'xxx'` に追加**（BuyersPage.tsx）

---

## 🔍 確認方法

実装後に以下を確認すること：

1. **Supabaseで直接データ確認**: 条件を満たす買主が実際に存在するか
2. **`buyer_sidebar_counts` テーブル確認**: `count > 0` になっているか
3. **ブラウザのコンソール確認**: `viewing survey result 入力済み件数` のログを確認
4. **サイドバー表示確認**: 実際にカテゴリが表示されているか

---

**最終更新日**: 2026年8月  
**作成理由**: `_buildSidebarCountsFromCache()` への実装漏れでサイドバー表示バグが発生したため  
**関連ファイル**: 
- `backend/src/services/BuyerService.ts`
- `frontend/frontend/src/components/BuyerStatusSidebar.tsx`
- `frontend/frontend/src/pages/BuyersPage.tsx`
