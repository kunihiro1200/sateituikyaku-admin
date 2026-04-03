# 買主リスト「内覧日前日」カテゴリ未表示問題 - 要件定義

## 問題の概要

買主リストページのサイドバーに「内覧日前日」カテゴリが表示されない。

## 現状の問題

### 症状

- サイドバーに「内覧日前日」カテゴリが表示されない
- APIエンドポイント `/api/buyers/status-categories-with-buyers` のレスポンスに「内覧日前日」が含まれていない可能性

### 期待される動作

- サイドバーに「内覧日前日」カテゴリが表示される
- 内覧日の前日（木曜日の場合は2日前）に該当する買主がカウントされる

## 根本原因の仮説

### 仮説1: `buyer_sidebar_counts`テーブルにデータが存在しない

**確認方法**:
```sql
SELECT * FROM buyer_sidebar_counts WHERE category = 'viewingDayBefore';
```

**可能性**:
- GASの`updateBuyerSidebarCounts_()`関数が実装されていない
- GASの時間トリガーが設定されていない
- GASの実行でエラーが発生している

### 仮説2: バックエンドの`getSidebarCounts()`メソッドが正しく動作していない

**確認ポイント**:
- `buyer_sidebar_counts`テーブルからデータを取得できているか
- `viewingDayBefore`カテゴリを正しく「内覧日前日」にマッピングしているか

**現在の実装**（`backend/src/services/BuyerService.ts`）:
```typescript
case 'viewingDayBefore':
  // 内覧日前日
  categoryCounts['内覧日前日'] = count;
  break;
```

✅ **マッピングは正しい**

### 仮説3: GASの`updateBuyerSidebarCounts_()`関数が未実装

**確認方法**:
- `gas_buyer_complete_code.js`に`updateBuyerSidebarCounts_()`関数が存在するか確認
- 関数が存在する場合、`viewingDayBefore`カテゴリを計算しているか確認

## バグ条件 C(X)

**C(X)**: 買主リストページのサイドバーに「内覧日前日」カテゴリが表示されない

**入力 X**:
- 買主データ（`buyers`テーブル）
- 内覧日（`viewing_date`）
- 今日の日付

**期待される出力**:
- サイドバーに「内覧日前日」カテゴリが表示される
- 内覧日の前日（木曜日の場合は2日前）に該当する買主がカウントされる

**実際の出力**:
- サイドバーに「内覧日前日」カテゴリが表示されない

## 要件

### 機能要件

#### FR-1: `buyer_sidebar_counts`テーブルに`viewingDayBefore`カテゴリのデータを保存

**要件**: GASの`updateBuyerSidebarCounts_()`関数で`viewingDayBefore`カテゴリを計算し、`buyer_sidebar_counts`テーブルに保存する

**詳細**:
- 内覧日の前日（木曜日の場合は2日前）に該当する買主をカウント
- カウント結果を`buyer_sidebar_counts`テーブルに保存
  - `category`: `'viewingDayBefore'`
  - `count`: カウント数
  - `label`: `null`
  - `assignee`: `null`

#### FR-2: バックエンドの`getSidebarCounts()`メソッドが正しく動作

**要件**: `buyer_sidebar_counts`テーブルから`viewingDayBefore`カテゴリを取得し、「内覧日前日」として返す

**詳細**:
- ✅ 既に実装済み（`backend/src/services/BuyerService.ts`の1545行目）
- 確認のみ必要

#### FR-3: GASの時間トリガーを設定

**要件**: GASの`updateBuyerSidebarCounts_()`関数を10分ごとに実行する時間トリガーを設定

**詳細**:
- トリガー名: `updateBuyerSidebarCounts_`
- 実行間隔: 10分ごと
- 実行関数: `updateBuyerSidebarCounts_()`

### 非機能要件

#### NFR-1: パフォーマンス

- GASの実行時間は30秒以内
- バックエンドAPIのレスポンスタイムは500ms以内

#### NFR-2: 保守性

- GASのコードは`gas_buyer_complete_code.js`に記述
- 判定ロジックは売主リストの`isVisitDayBefore()`と同じロジックを使用

#### NFR-3: テスタビリティ

- GASの`updateBuyerSidebarCounts_()`関数を手動実行してテスト可能

## 成功基準

### AC-1: `buyer_sidebar_counts`テーブルにデータが保存される

**Given**: GASの`updateBuyerSidebarCounts_()`関数を実行  
**When**: `buyer_sidebar_counts`テーブルを確認  
**Then**: `viewingDayBefore`カテゴリのデータが保存されている

**確認SQL**:
```sql
SELECT * FROM buyer_sidebar_counts WHERE category = 'viewingDayBefore';
```

### AC-2: サイドバーに「内覧日前日」カテゴリが表示される

**Given**: 買主リストページを開く  
**When**: サイドバーを確認  
**Then**: 「内覧日前日」カテゴリが表示される

### AC-3: カウント数が正しい

**Given**: 内覧日の前日に該当する買主が2件存在する  
**When**: サイドバーの「内覧日前日」カテゴリを確認  
**Then**: カウント数が「2」と表示される

## 制約条件

### 技術的制約

- GAS: Google Apps Script
- バックエンド: Node.js + TypeScript + Supabase
- フロントエンド: React + TypeScript

### ビジネス制約

- 水曜日は定休日（木曜日の内覧の場合は2日前に通知）
- 日曜日の内覧は土曜日に通知（1日前）

## 関連ドキュメント

- `gas_buyer_complete_code.js` - 買主リスト用GAS
- `backend/src/services/BuyerService.ts` - 買主サービス
- `backend/src/config/buyer-status-definitions.ts` - ステータス定義
- `.kiro/steering/gas-sidebar-counts-update-guide.md` - GASサイドバーカウント更新ガイド

## 備考

### 類似問題

- 売主リストの「訪問日前日」カテゴリは正常に動作している
- 同じロジックを買主リストにも適用する必要がある

---

**作成日**: 2026年4月3日  
**作成者**: Kiro AI  
**ステータス**: Draft
