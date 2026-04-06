---
inclusion: manual
---

# GASファイル構成（絶対に混同しないルール）

## ⚠️ 重要：3つの独立したGASファイル

このプロジェクトには**3つの独立したGASファイル**が存在します。
**絶対に混同しないでください。**

---

## 📁 GASファイル一覧

### 1. **売主リスト用GAS**（メインGAS）

**ファイル名**: `gas_complete_code.js` ✅

**スプレッドシート**: 売主リストスプレッドシート

**スプレッドシートID**: （売主リスト用）

**シート名**: `売主リスト`

**識別子カラム**: `売主番号`（例: AA13501）

**主要関数**:
- `syncSellerList()` - 10分ごとの定期同期（メイン関数）
- `onEditTrigger()` - 編集時の即時同期
- `updateSidebarCounts_()` - サイドバーカウント更新（`seller_sidebar_counts`テーブル）
- `syncUpdatesToSupabase_()` - Supabase直接更新
- `setupSellerSyncTrigger()` - トリガー設定

**同期先テーブル**:
- `sellers` - 売主データ
- `seller_sidebar_counts` - サイドバーカウント

**用途**:
- 売主データの同期
- 売主サイドバーカウントの更新
- 売主リストページ（`/sellers`）

---

### 2. **買主リスト用GAS**

**ファイル名**: `gas_buyer_complete_code.js` ✅（または `gas_buyer_sync.js`、`gas_buyer_sidebar_counts.js`）

**スプレッドシート**: 買主リストスプレッドシート

**スプレッドシートID**: `1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY`

**シート名**: `買主リスト`

**識別子カラム**: `買主番号`（例: BB14）

**主要関数**（予定）:
- `syncBuyerList()` - 10分ごとの定期同期（メイン関数）
- `updateBuyerSidebarCounts_()` - サイドバーカウント更新（`buyer_sidebar_counts`テーブル）
- `setupBuyerSyncTrigger()` - トリガー設定

**同期先テーブル**:
- `buyers` - 買主データ
- `buyer_sidebar_counts` - サイドバーカウント

**用途**:
- 買主データの同期
- 買主サイドバーカウントの更新
- 買主リストページ（`/buyers`）

**現在の状態**: ファイルは存在するが、内容が空（実装が必要）

---

### 3. **物件リスト用GAS**

**ファイル名**: （未確認）

**スプレッドシート**: 物件リストスプレッドシート

**スプレッドシートID**: （未確認）

**シート名**: （未確認）

**識別子カラム**: `物件番号`（予想）

**主要関数**（予想）:
- `syncPropertyList()` - 定期同期
- `updatePropertySidebarCounts_()` - サイドバーカウント更新

**同期先テーブル**:
- `property_listings` - 物件データ
- `property_sidebar_counts` - サイドバーカウント（予想）

**用途**:
- 物件データの同期
- 物件サイドバーカウントの更新
- 物件リストページ（`/properties`）

**現在の状態**: 存在するか不明（確認が必要）

---

## 🚨 絶対に守るべきルール

### ルール1: GASファイルを混同しない

**❌ 間違い**:
```
「gas_complete_code.jsに買主リスト用の関数を追加して」
```

**✅ 正しい**:
```
「gas_buyer_complete_code.jsに買主リスト用の関数を追加して」
```

### ルール2: 識別子カラムで判断する

| GASファイル | 識別子カラム | 例 |
|-----------|------------|-----|
| `gas_complete_code.js` | `売主番号` | AA13501 |
| `gas_buyer_complete_code.js` | `買主番号` | BB14 |
| 物件リスト用GAS | `物件番号` | （未確認） |

### ルール3: スプレッドシートIDで判断する

| GASファイル | スプレッドシートID |
|-----------|------------------|
| `gas_complete_code.js` | （売主リスト用） |
| `gas_buyer_complete_code.js` | `1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY` |
| 物件リスト用GAS | （未確認） |

### ルール4: シート名で判断する

| GASファイル | シート名 |
|-----------|---------|
| `gas_complete_code.js` | `売主リスト` |
| `gas_buyer_complete_code.js` | `買主リスト` |
| 物件リスト用GAS | （未確認） |

---

## 📋 GASファイル編集前のチェックリスト

GASファイルを編集する前に、以下を確認してください：

- [ ] どのリスト用のGASか確認した（売主/買主/物件）
- [ ] 識別子カラムを確認した（売主番号/買主番号/物件番号）
- [ ] スプレッドシートIDを確認した
- [ ] シート名を確認した
- [ ] 正しいGASファイルを開いている

---

## 🎯 実例：今回の間違い

### ❌ 間違った編集

**ファイル**: `gas_complete_code.js`

**追加しようとした関数**: `updateBuyerSidebarCounts_()`

**理由**: 
- このファイルは**売主リスト用**
- 買主リスト用の関数は`gas_buyer_complete_code.js`に追加すべき

**結果**: 
- ユーザーの指摘で`git checkout`で元に戻した

### ✅ 正しい編集

**ファイル**: `gas_buyer_complete_code.js`

**追加する関数**: `updateBuyerSidebarCounts_()`

**理由**:
- このファイルは**買主リスト用**
- 買主リスト用の関数はこのファイルに追加する

---

## 📝 GASファイル編集時のベストプラクティス

### 1. ファイル名を必ず確認

**❌ 悪い例**:
```
GASに〇〇関数を追加する
```

**✅ 良い例**:
```
gas_buyer_complete_code.js（買主リスト用）に〇〇関数を追加する
```

### 2. 識別子カラムを確認

**確認方法**:
```javascript
// ファイルの先頭付近を確認
var sheet = ss.getSheetByName('売主リスト'); // ← 売主リスト用
var sheet = ss.getSheetByName('買主リスト'); // ← 買主リスト用
```

### 3. 編集前にユーザーに確認

**質問例**:
- 「このGASファイルは売主リスト用ですか？買主リスト用ですか？」
- 「買主リスト用のGASファイル名は何ですか？」

---

## 🔍 GASファイルの確認方法

### 方法1: ファイル名で確認

```bash
# GASファイルを検索
fileSearch "gas_"
```

### 方法2: ファイル内容で確認

```bash
# シート名を検索
grepSearch "getSheetByName" --includePattern="gas_*.js"
```

### 方法3: 識別子カラムで確認

```bash
# 売主番号を検索
grepSearch "売主番号" --includePattern="gas_*.js"

# 買主番号を検索
grepSearch "買主番号" --includePattern="gas_*.js"
```

---

## 💡 よくある間違い

### ❌ 間違い1: GASファイルを混同

```
「gas_complete_code.jsに買主リスト用の関数を追加して」
```

**問題**: `gas_complete_code.js`は売主リスト用
**正解**: `gas_buyer_complete_code.js`に追加する

---

### ❌ 間違い2: 識別子カラムを混同

```javascript
// ❌ 間違い（売主リスト用GASで買主番号を使用）
var buyerNumber = row['買主番号'];
```

**正解**: 売主リスト用GASでは`売主番号`を使用

---

### ❌ 間違い3: シート名を混同

```javascript
// ❌ 間違い（買主リスト用GASで売主リストを開く）
var sheet = ss.getSheetByName('売主リスト');
```

**正解**: 買主リスト用GASでは`買主リスト`を使用

---

## 🎓 まとめ

### 必ず覚えること

1. **3つの独立したGASファイルが存在する**
   - `gas_complete_code.js` → 売主リスト用
   - `gas_buyer_complete_code.js` → 買主リスト用
   - 物件リスト用GAS → （未確認）

2. **識別子カラムで判断する**
   - `売主番号` → 売主リスト用
   - `買主番号` → 買主リスト用
   - `物件番号` → 物件リスト用

3. **編集前に必ず確認する**
   - どのリスト用か？
   - 識別子カラムは何か？
   - 正しいGASファイルを開いているか？

4. **不明な場合はユーザーに確認する**

---

## 📚 関連ドキュメント

- `.kiro/steering/gas-sidebar-counts-update-guide.md` - GASサイドバーカウント更新ガイド
- `.kiro/steering/seller-spreadsheet-column-mapping.md` - 売主スプレッドシートのカラムマッピング

---

**最終更新日**: 2026年4月1日  
**作成理由**: GASファイルを混同して間違った編集をしてしまったため  
**更新履歴**: 初版作成

