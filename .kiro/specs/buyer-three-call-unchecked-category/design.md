# 買主リスト「当日TEL」「３回架電未」カテゴリ追加 - 設計書

## 📋 概要

買主リストのサイドバーに「当日TEL」カテゴリと、その下に「３回架電未」サブカテゴリを追加します。これにより、優先度の高い架電対象を明確に可視化します。

---

## 🎯 設計目標

### 主要目標
1. 「当日TEL」カテゴリを追加（後続担当が空 + 次電日が今日以前）
2. 「３回架電未」サブカテゴリを追加（「当日TEL」の下にインデント表示）
3. 既存のサイドバーカテゴリの動作に影響を与えない
4. GASの同期処理に大きな影響を与えない

### 非機能要件
- サイドバーカウントの取得は1秒以内
- GASの同期処理は10分以内に完了
- データベースマイグレーションは安全に実行可能

---

## 🏗️ アーキテクチャ

### システム構成

```
スプレッドシート（買主リスト）
  ↓ GAS同期（10分ごと）
データベース（buyers テーブル）
  ↓ GAS集計
buyer_sidebar_counts テーブル
  ↓ API
フロントエンド（BuyerStatusSidebar）
```

### データフロー

#### 1. スプレッドシート → データベース（GAS同期）

```
GASの10分トリガー
  ↓
syncBuyerList() 実行
  ↓
スプレッドシートから読み取り
  - FC列「３回架電確認済み」
  - 「【問合メール】電話対応」列
  ↓
buyers テーブルに保存
  - three_call_confirmed
  - inquiry_email_phone_response
  ↓
updateBuyerSidebarCounts_() 実行
  ↓
buyer_sidebar_counts テーブルに保存
```

#### 2. データベース → フロントエンド

```
BuyerStatusSidebar コンポーネント
  ↓
/api/buyers/sidebar-counts エンドポイント
  ↓
buyer_sidebar_counts テーブルから取得
  ↓
サイドバーに表示
  - ⑯当日TEL: 2
  - ↳ ３回架電未: 5
```

---

## 📊 データモデル

### 1. buyers テーブル（既存 + 新規カラム）

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| `buyer_number` | TEXT | NOT NULL | 買主番号（主キー） |
| `follow_up_assignee` | TEXT | NULL | 後続担当（既存） |
| `next_call_date` | DATE | NULL | 次電日（既存） |
| **`three_call_confirmed`** | **TEXT** | **NULL** | **３回架電確認済み（新規）** |
| **`inquiry_email_phone_response`** | **TEXT** | **NULL** | **【問合メール】電話対応（新規）** |

**新規カラムの詳細**:

#### three_call_confirmed
- **値**: `"3回架電未"` または その他の文字列
- **デフォルト**: NULL
- **用途**: ３回架電確認の状態を保存

#### inquiry_email_phone_response
- **値**: `"不通"`, `"未"`, その他の文字列
- **デフォルト**: NULL
- **用途**: 電話対応の状態を保存

### 2. buyer_sidebar_counts テーブル（既存）

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| `category` | TEXT | NOT NULL | カテゴリ名（例: 'todayCall', 'threeCallUnchecked'） |
| `count` | INTEGER | NOT NULL | カウント数 |
| `label` | TEXT | NULL | ラベル（サブカテゴリ用） |
| `assignee` | TEXT | NULL | 担当者イニシャル（担当別カテゴリ用） |
| `updated_at` | TIMESTAMP | NOT NULL | 更新日時 |

**主キー**: (`category`, `label`, `assignee`)

**新規カテゴリ**:
- `category = 'todayCall'`, `label = NULL`, `assignee = NULL` → 「当日TEL」
- `category = 'threeCallUnchecked'`, `label = NULL`, `assignee = NULL` → 「３回架電未」

---

## 🔧 コンポーネント設計

### 1. データベースマイグレーション

**ファイル**: `backend/supabase/migrations/YYYYMMDDHHMMSS_add_buyer_three_call_fields.sql`

**内容**:
```sql
-- 買主テーブルに新規カラムを追加

-- ３回架電確認済みカラム
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS three_call_confirmed TEXT;

-- 【問合メール】電話対応カラム
ALTER TABLE buyers
ADD COLUMN IF NOT EXISTS inquiry_email_phone_response TEXT;

-- インデックスを追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_buyers_three_call_confirmed
ON buyers(three_call_confirmed)
WHERE three_call_confirmed IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buyers_inquiry_email_phone_response
ON buyers(inquiry_email_phone_response)
WHERE inquiry_email_phone_response IS NOT NULL;

-- コメント
COMMENT ON COLUMN buyers.three_call_confirmed IS '３回架電確認済み（"3回架電未" or その他）';
COMMENT ON COLUMN buyers.inquiry_email_phone_response IS '【問合メール】電話対応（"不通", "未", その他）';
```

### 2. GAS同期処理

**ファイル**: `gas_buyer_complete_code.js`

#### 2-1. syncBuyerList() の修正

**追加箇所**: フィールド同期処理

```javascript
// ３回架電確認済み（FC列）
var sheetThreeCallConfirmed = row['３回架電確認済み'] ? String(row['３回架電確認済み']) : null;
var normalizedSheetThreeCallConfirmed = normalizeValue(sheetThreeCallConfirmed);
var normalizedDbThreeCallConfirmed = normalizeValue(dbBuyer.three_call_confirmed);
if (normalizedSheetThreeCallConfirmed !== normalizedDbThreeCallConfirmed) {
  updateData.three_call_confirmed = normalizedSheetThreeCallConfirmed;
  needsUpdate = true;
}

// 【問合メール】電話対応
var sheetInquiryEmailPhoneResponse = row['【問合メール】電話対応'] ? String(row['【問合メール】電話対応']) : null;
var normalizedSheetInquiryEmailPhoneResponse = normalizeValue(sheetInquiryEmailPhoneResponse);
var normalizedDbInquiryEmailPhoneResponse = normalizeValue(dbBuyer.inquiry_email_phone_response);
if (normalizedSheetInquiryEmailPhoneResponse !== normalizedDbInquiryEmailPhoneResponse) {
  updateData.inquiry_email_phone_response = normalizedSheetInquiryEmailPhoneResponse;
  needsUpdate = true;
}
```

#### 2-2. updateBuyerSidebarCounts_() の修正

**追加箇所**: カテゴリ計算ロジック

```javascript
function updateBuyerSidebarCounts_() {
  Logger.log('📊 買主サイドバーカウント更新開始...');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('買主リスト');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  // カウント変数の初期化
  var counts = {
    todayCall: 0,              // 当日TEL（新規）
    threeCallUnchecked: 0,     // ３回架電未（新規）
    viewingDayBefore: 0,
    todayCallAssigned: {},
    assigned: {}
  };
  
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  
  // 各行をループ
  for (var i = 1; i < data.length; i++) {
    var row = rowToObject(headers, data[i]);
    var buyerNumber = row['買主番号'];
    if (!buyerNumber) continue;
    
    // 後続担当
    var followUpAssignee = row['後続担当'] ? String(row['後続担当']).trim() : '';
    var isFollowUpAssigneeValid = followUpAssignee && followUpAssignee !== '外す';
    
    // 次電日
    var nextCallDate = formatDateToISO_(row['★次電日']);
    
    // ３回架電確認済み
    var threeCallConfirmed = row['３回架電確認済み'] ? String(row['３回架電確認済み']) : '';
    
    // 【問合メール】電話対応
    var inquiryEmailPhoneResponse = row['【問合メール】電話対応'] ? String(row['【問合メール】電話対応']) : '';
    
    // 当日TELカテゴリ（新規）
    // 条件: 後続担当が空 AND 次電日が空でない AND 次電日が今日以前
    if (!followUpAssignee &&
        nextCallDate &&
        nextCallDate <= todayStr) {
      counts.todayCall++;
    }
    
    // ３回架電未カテゴリ（新規）
    // 条件: ３回架電確認済み = "3回架電未" AND (【問合メール】電話対応 = "不通" OR "未")
    if (threeCallConfirmed === '3回架電未' &&
        (inquiryEmailPhoneResponse === '不通' || inquiryEmailPhoneResponse === '未')) {
      counts.threeCallUnchecked++;
    }
    
    // ... 既存のカテゴリ計算ロジック ...
  }
  
  // Supabaseに保存
  var upsertRows = [];
  var now = new Date().toISOString();
  
  // 当日TEL（新規）
  upsertRows.push({
    category: 'todayCall',
    count: counts.todayCall,
    label: null,
    assignee: null,
    updated_at: now
  });
  
  // ３回架電未（新規）
  upsertRows.push({
    category: 'threeCallUnchecked',
    count: counts.threeCallUnchecked,
    label: null,
    assignee: null,
    updated_at: now
  });
  
  // ... 既存のカテゴリ保存ロジック ...
  
  // Supabaseに一括保存
  var result = upsertToSupabase_('buyer_sidebar_counts', upsertRows);
  Logger.log('✅ 買主サイドバーカウント更新完了: ' + upsertRows.length + '行');
}
```

### 3. バックエンドAPI

**ファイル**: `backend/src/services/BuyerService.ts`

#### 3-1. getSidebarCounts() メソッド（既存）

**変更**: なし（既に `buyer_sidebar_counts` テーブルから取得している）

#### 3-2. listBuyers() メソッドの修正

**追加箇所**: フィルタリング条件

```typescript
// 当日TELカテゴリ
if (statusCategory === 'todayCall') {
  query = query
    .is('follow_up_assignee', null)
    .not('next_call_date', 'is', null)
    .lte('next_call_date', today);
}

// ３回架電未カテゴリ
if (statusCategory === 'threeCallUnchecked') {
  query = query
    .eq('three_call_confirmed', '3回架電未')
    .or('inquiry_email_phone_response.eq.不通,inquiry_email_phone_response.eq.未');
}
```

### 4. フロントエンド

**ファイル**: `frontend/frontend/src/components/BuyerStatusSidebar.tsx`

#### 4-1. カテゴリ定義の追加

```typescript
const statusList = useMemo(() => {
  const list = [
    { key: 'all', label: 'All', count: statusCounts.all },
  ];
  
  // 内覧日前日
  if (statusCounts.viewingDayBefore > 0) {
    list.push({
      key: 'viewingDayBefore',
      label: '②内覧日前日',
      count: statusCounts.viewingDayBefore,
    });
  }
  
  // 当日TEL（新規）
  if (statusCounts.todayCall > 0) {
    list.push({
      key: 'todayCall',
      label: '⑯当日TEL',
      count: statusCounts.todayCall,
    });
  }
  
  // ３回架電未（新規・インデント）
  if (statusCounts.threeCallUnchecked > 0) {
    list.push({
      key: 'threeCallUnchecked',
      label: '↳ ３回架電未',
      count: statusCounts.threeCallUnchecked,
      indent: true,  // インデント表示
    });
  }
  
  // ... 既存のカテゴリ ...
  
  return list;
}, [statusCounts]);
```

#### 4-2. スタイル定義

```typescript
const getCategoryColor = (key: string): string => {
  switch (key) {
    case 'viewingDayBefore':
      return '#d32f2f';  // 赤
    case 'todayCall':
      return '#555555';  // グレー
    case 'threeCallUnchecked':
      return '#d32f2f';  // 赤
    case 'assigned':
      return '#4caf50';  // 緑
    case 'todayCallAssigned':
      return '#ff5722';  // オレンジ
    default:
      return '#000000';
  }
};
```

---

## 🧪 テスト戦略

### 1. データベースマイグレーションテスト

**テストケース**:
1. マイグレーションが正常に実行される
2. 新規カラムが追加される（`three_call_confirmed`, `inquiry_email_phone_response`）
3. インデックスが作成される
4. 既存データに影響がない

**実行方法**:
```bash
# ローカル環境でテスト
npx supabase migration up

# 本番環境でテスト
npx supabase db push
```

### 2. GAS同期テスト

**テストケース**:
1. スプレッドシートのFC列「３回架電確認済み」がデータベースに同期される
2. スプレッドシートの「【問合メール】電話対応」がデータベースに同期される
3. `updateBuyerSidebarCounts_()` が正しくカウントを計算する
4. `buyer_sidebar_counts` テーブルに正しく保存される

**実行方法**:
```javascript
// GASエディタで手動実行
function testSync() {
  syncBuyerList();
  updateBuyerSidebarCounts_();
}
```

### 3. バックエンドAPIテスト

**テストケース**:
1. `/api/buyers/sidebar-counts` が正しいカウントを返す
2. `/api/buyers?statusCategory=todayCall` が正しくフィルタリングする
3. `/api/buyers?statusCategory=threeCallUnchecked` が正しくフィルタリングする

**実行方法**:
```bash
# サイドバーカウント取得
curl http://localhost:3000/api/buyers/sidebar-counts

# 当日TELフィルタリング
curl http://localhost:3000/api/buyers?statusCategory=todayCall

# ３回架電未フィルタリング
curl http://localhost:3000/api/buyers?statusCategory=threeCallUnchecked
```

### 4. フロントエンドテスト

**テストケース**:
1. サイドバーに「⑯当日TEL」が表示される
2. サイドバーに「↳ ３回架電未」がインデント表示される
3. カウント数が正しい
4. クリックすると正しくフィルタリングされる

**実行方法**:
```bash
# ローカル環境で確認
npm run dev
# http://localhost:5173/buyers を開く
```

---

## 📝 実装チェックリスト

### Phase 1: データベースマイグレーション
- [ ] マイグレーションファイルを作成
- [ ] ローカル環境でテスト
- [ ] 本番環境にデプロイ

### Phase 2: GAS同期処理
- [ ] `syncBuyerList()` にフィールド同期処理を追加
- [ ] `updateBuyerSidebarCounts_()` にカテゴリ計算ロジックを追加
- [ ] GASエディタにコピー＆ペースト
- [ ] 手動実行してテスト

### Phase 3: バックエンドAPI
- [ ] `BuyerService.listBuyers()` にフィルタリング条件を追加
- [ ] ローカル環境でテスト
- [ ] 本番環境にデプロイ

### Phase 4: フロントエンド
- [ ] `BuyerStatusSidebar.tsx` にカテゴリ定義を追加
- [ ] スタイル定義を追加
- [ ] ローカル環境でテスト
- [ ] 本番環境にデプロイ

### Phase 5: 統合テスト
- [ ] GASの10分同期が正常に動作することを確認
- [ ] サイドバーカウントが正しく表示されることを確認
- [ ] フィルタリングが正しく動作することを確認

---

## 🚨 注意事項

### 1. スプレッドシート列位置の確認

「【問合メール】電話対応」カラムの列位置は要確認です。スプレッドシートを開いて、正確な列名を確認してください。

### 2. GASコードの更新手順

1. `gas_buyer_complete_code.js` を更新
2. GASエディタにコピー＆ペースト（全体を上書き）
3. 保存（Ctrl+S）
4. 手動実行してテスト

### 3. 既存機能への影響

- 既存の「内覧日前日」「担当(イニシャル)」カテゴリの動作に影響を与えない
- GASの同期処理に大きな影響を与えない（フィールド追加のみ）

---

## 📊 期待される結果

### サイドバー表示

```
All: 4683

②内覧日前日: 2

⑯当日TEL: 2
  ↳ ３回架電未: 5

担当(Y): 150
  ↳ 当日TEL(Y): 10
```

### データベース

**buyers テーブル**:
- `three_call_confirmed` カラムが追加される
- `inquiry_email_phone_response` カラムが追加される

**buyer_sidebar_counts テーブル**:
- `category = 'todayCall'` のレコードが追加される
- `category = 'threeCallUnchecked'` のレコードが追加される

---

**作成日**: 2026年4月5日  
**作成者**: Kiro AI  
**ステータス**: 設計完了
