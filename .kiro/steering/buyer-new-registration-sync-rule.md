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

## 🔗 買主詳細画面と新規登録画面の統合ルール（最重要）

### ⚠️ 絶対に守るべきルール

**買主詳細画面（`BuyerDetailPage.tsx`）のフィールドを変更した場合、新規登録画面（`NewBuyerPage.tsx`）も同様に変更すること。**

逆も同様：**新規登録画面のフィールドを変更した場合、買主詳細画面も同様に変更すること。**

---

### 📋 統合ルールの詳細

#### ルール1: フィールドの追加・削除は両方の画面で行う

```
❌ 間違い: BuyerDetailPage.tsx にフィールドを追加したが、NewBuyerPage.tsx には追加しなかった
✅ 正しい: 両方の画面に同じフィールドを追加する
```

#### ルール2: バリデーションロジックも両方の画面で同期する

```
❌ 間違い: BuyerDetailPage.tsx でバリデーションを追加したが、NewBuyerPage.tsx には追加しなかった
✅ 正しい: 両方の画面に同じバリデーションを追加する
```

#### ルール3: ドロップダウンの選択肢も両方の画面で同期する

```
❌ 間違い: BuyerDetailPage.tsx のドロップダウン選択肢を変更したが、NewBuyerPage.tsx は変更しなかった
✅ 正しい: 両方の画面で同じ選択肢を使用する
```

---

### 📐 セクション構成の違い（重要）

**買主詳細画面（`BuyerDetailPage.tsx`）のセクション順序**:
1. 問合せ・内覧情報（`inquiry_hearing` を先頭に配置）
2. 基本情報
3. その他

**新規登録画面（`NewBuyerPage.tsx`）のセクション順序**:
1. 基本情報（氏名・電話番号・メールアドレス）
2. 問合せ情報（受付日・問合せ元・問合時ヒアリング・問合時確度）
3. 希望条件（希望エリア・希望種別・予算）

**理由**: 新規登録時は基本情報の入力が最優先。詳細画面では問合せ内容が最重要。

---

### 📋 現在の対応フィールド一覧

| フィールド名 | BuyerDetailPage | NewBuyerPage | 備考 |
|------------|----------------|--------------|------|
| `buyer_number` | ✅ 表示（読み取り専用） | ✅ 自動採番表示 | |
| `name` | ✅ インライン編集 | ✅ 必須入力 | |
| `phone_number` | ✅ インライン編集 | ✅ 入力 | |
| `email` | ✅ インライン編集 | ✅ 入力 | |
| `reception_date` | ✅ インライン編集 | ✅ 今日の日付デフォルト | |
| `inquiry_source` | ✅ インライン編集 | ✅ Autocomplete | |
| `inquiry_hearing` | ✅ インライン編集（先頭） | ✅ テキストエリア | |
| `inquiry_confidence` | ✅ インライン編集 | ✅ 入力 | |
| `desired_area` | ❌ 詳細画面なし | ✅ 入力 | 希望条件ページで管理 |
| `desired_property_type` | ❌ 詳細画面なし | ✅ 入力 | 希望条件ページで管理 |
| `budget` | ❌ 詳細画面なし | ✅ 入力 | 希望条件ページで管理 |

---

### 🚨 よくある間違い

#### ❌ 間違い1: 詳細画面だけ変更して新規登録画面を忘れる

```
状況: BuyerDetailPage.tsx に「初動担当」フィールドを追加した
問題: NewBuyerPage.tsx には「初動担当」フィールドがない
結果: 新規登録時に初動担当を入力できない
```

**正しい対応**:
1. `BuyerDetailPage.tsx` に `initial_assignee` フィールドを追加
2. `NewBuyerPage.tsx` にも `initial_assignee` フィールドを追加
3. バックエンドの `POST /api/buyers` で `initial_assignee` を受け取れるようにする

#### ❌ 間違い2: 新規登録画面だけ変更して詳細画面を忘れる

```
状況: NewBuyerPage.tsx に「会社名」フィールドを追加した
問題: BuyerDetailPage.tsx には「会社名」フィールドがない
結果: 登録後に会社名を編集できない
```

---

### ✅ フィールド追加時のチェックリスト

新しいフィールドを追加する際は、以下を確認：

- [ ] `BuyerDetailPage.tsx` の `BUYER_FIELD_SECTIONS` に追加したか？
- [ ] `NewBuyerPage.tsx` のフォームに追加したか？
- [ ] `backend/src/routes/buyers.ts` の `POST /api/buyers` で受け取れるか？
- [ ] `backend/src/services/BuyerService.ts` で保存されるか？
- [ ] DBのカラムが存在するか（マイグレーション済みか）？

---

## 📁 関連ファイル

| ファイル | 役割 |
|---------|------|
| `frontend/frontend/src/pages/NewBuyerPage.tsx` | 新規買主登録画面 |
| `frontend/frontend/src/pages/BuyerDetailPage.tsx` | 買主詳細画面 |
| `backend/src/routes/buyers.ts` | `GET /next-buyer-number`、`POST /api/buyers` エンドポイント |
| `backend/src/services/BuyerService.ts` | `generateBuyerNumber()`、`createBuyer()` メソッド |

---

**最終更新日**: 2026年3月14日
**作成理由**: 買主新規登録画面の買主番号自動採番ルールを明確化するため
**更新履歴**:
- 2026年3月14日: 買主詳細画面と新規登録画面の統合ルールを追加
