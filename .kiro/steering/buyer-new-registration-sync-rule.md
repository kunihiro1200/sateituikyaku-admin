# 買主新規登録画面のルール

## ⚠️ 重要：買主番号の自動採番

新規買主登録時、買主番号は**自動的に採番**されます。

---

## 📋 買主番号の採番ルール

### 採番方法

**APIエンドポイント**: `GET /api/buyers/next-buyer-number`

**実装**: `backend/src/routes/buyers.ts` → `BuyerService.generateBuyerNumber()`

**採番ロジック**:
- DBの `buyers` テーブルから最新の `buyer_number` を取得（降順）
- 最大値 + 1 を次の買主番号とする
- 数値形式（例: `4370`）

### フロントエンドでの表示

**ファイル**: `frontend/frontend/src/pages/NewBuyerPage.tsx`

- ページ読み込み時に `GET /api/buyers/next-buyer-number` を呼び出す
- 取得した番号を「買主番号（自動採番）」フィールドに表示（読み取り専用）
- 実際の採番は `POST /api/buyers` 時にバックエンドで行われる

---

## 🔄 新規登録時のスプレッドシート同期

### 現在の実装

新規買主を `POST /api/buyers` で作成した場合：
- DBに保存される
- **スプレッドシートへの即時同期は行われない**
- 5分ごとの定期同期（`EnhancedPeriodicSyncManager`）でスプレッドシートに反映される

### 注意事項

- 登録直後はスプレッドシートに反映されていない場合がある
- 最大5分後に自動同期される

---

## 📁 関連ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/frontend/src/pages/NewBuyerPage.tsx` | 新規買主登録画面 |
| `backend/src/routes/buyers.ts` | `GET /next-buyer-number` エンドポイント |
| `backend/src/services/BuyerService.ts` | `generateBuyerNumber()` メソッド |

---

**最終更新日**: 2026年3月12日
**作成理由**: 買主新規登録画面の買主番号自動採番ルールを明確化するため
