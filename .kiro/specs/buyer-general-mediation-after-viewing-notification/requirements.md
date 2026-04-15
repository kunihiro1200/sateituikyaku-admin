# 要件定義書

## はじめに

買主リストにおいて、以下の2点を実装する：

1. **サイドバーカテゴリー表示**: 既存の「一般媒介_内覧後売主連絡未」カテゴリーを今まで通りの条件で維持する
2. **注意書き表示**: `BuyerViewingResultPage`（内覧ページ）の「内覧後売主連絡」フィールドの下に、常に赤字で「*一般媒介は内覧後に、全ての売り主に結果報告をしてください」と表示する

### 背景

一般媒介契約の物件を内覧した後、担当者は全ての売主に内覧結果を報告する義務がある。現状、この報告漏れが発生しやすいため、内覧ページの「内覧後売主連絡」フィールド付近に注意書きを常時表示し、担当者に報告義務を周知する。

サイドバーカテゴリーは既存の実装（`BuyerStatusCalculator.ts` Priority 8）の条件を変更せずそのまま維持する。

---

## 用語集

- **BuyerViewingResultPage**: 内覧ページ。`/buyers/:buyer_number/viewing` に対応するフロントエンドページ（`frontend/frontend/src/pages/BuyerViewingResultPage.tsx`）
- **BuyerStatusSidebar**: 買主リストのサイドバーコンポーネント（`frontend/frontend/src/components/BuyerStatusSidebar.tsx`）
- **BuyerStatusCalculator**: 買主のステータスを算出するサービス（`backend/src/services/BuyerStatusCalculator.ts`）
- **post_viewing_seller_contact**: 「内覧後売主連絡」フィールドのデータベースカラム名。値は「済」「未」「不要」または空欄
- **atbb_status**: ATBBステータスフィールド。「公開中」を含む場合に一部の判定条件で使用される
- **generalViewingSellerContactPending**: `CategoryCounts` インターフェース内のカウントキー名（一般媒介_内覧後売主連絡未）

---

## 要件

### 要件1：サイドバーカテゴリー「一般媒介_内覧後売主連絡未」の維持

**ユーザーストーリー：** 担当者として、既存の「一般媒介_内覧後売主連絡未」サイドバーカテゴリーを今まで通りの条件で使用したい。そうすることで、売主への連絡漏れを防ぎ、一般媒介契約の義務を確実に果たせる。

#### 受け入れ基準

1. THE System SHALL `BuyerStatusCalculator.ts` の Priority 8 判定ロジック（`generalViewingSellerContactPending`）を変更せず、既存の条件のまま維持する
2. THE System SHALL `BuyerStatusSidebar.tsx` の「一般媒介_内覧後売主連絡未」カテゴリー表示ロジックを変更せず、既存の実装のまま維持する
3. WHEN 「一般媒介_内覧後売主連絡未」カテゴリーに該当する買主が1件以上存在する THEN THE System SHALL `BuyerStatusSidebar` にそのカテゴリーと件数を表示する
4. WHEN 「一般媒介_内覧後売主連絡未」カテゴリーに該当する買主が0件の場合 THEN THE System SHALL そのカテゴリーをサイドバーに表示しない

---

### 要件2：内覧ページへの注意書き常時表示

**ユーザーストーリー：** 担当者として、内覧ページの「内覧後売主連絡」フィールド付近に注意書きを常に表示してほしい。そうすることで、一般媒介物件の内覧後に全ての売主へ結果報告する義務を忘れずに実行できる。

#### 受け入れ基準

1. WHEN `BuyerViewingResultPage`（内覧ページ）が表示される THEN THE System SHALL 「内覧後売主連絡」フィールドの直下に「*一般媒介は内覧後に、全ての売り主に結果報告をしてください」を常に赤字（`color: 'error'` または `#d32f2f`）で表示する
2. THE System SHALL 注意書きのテキストを `Typography` コンポーネントで `variant="caption"` または `variant="body2"` を使用して表示する
3. THE System SHALL 注意書きを「内覧後売主連絡」フィールドの直下に配置する
4. THE System SHALL `post_viewing_seller_contact` の値（済・未・不要・空欄）に関わらず、注意書きを常に表示する
