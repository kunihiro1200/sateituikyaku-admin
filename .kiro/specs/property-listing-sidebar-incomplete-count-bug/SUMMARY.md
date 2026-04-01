# 物件リストサイドバー「未完了」カテゴリーカウント問題 - 修正サマリー

## 問題の概要

物件番号BB14で「事務へチャット」を送信し、データベースの`property_listings`テーブルで`confirmation`カラムが「未」になっているにもかかわらず、サイドバーの「未完了」カテゴリーにカウントされず、そのため「未完了」カテゴリー自体がサイドバーに表示されない問題。

## 根本原因

`PropertyListingSpreadsheetSync.syncConfirmationFromSpreadsheet()`メソッドで、スプレッドシートのDQ列（確認フィールド）を読み取る際に、配列インデックスが1つずれていた。

### 問題のコード

**ファイル**: `backend/src/services/PropertyListingSpreadsheetSync.ts`  
**行番号**: 207

```typescript
const range = '物件!B:DQ';
const rows = await this.sheetsClient.readRawRange(range);
// ...
const confirmation = row[119]; // DQ列（0-indexed: 119） ← 間違い！
```

### 原因の詳細

- 読み取り範囲は`B:DQ`（B列から開始）
- B列は配列のインデックス0
- DQ列は120番目の列（A=1, B=2, ..., DQ=120）
- B列から開始しているため、DQ列は配列のインデックス118（120 - 2 = 118）になるべき
- しかし、コードでは`row[119]`を読み取っているため、DR列（121番目の列）を読み取ってしまっていた

## 修正内容

### 修正箇所

**ファイル**: `backend/src/services/PropertyListingSpreadsheetSync.ts`  
**行番号**: 207

```typescript
// 修正前
const confirmation = row[119]; // DQ列（0-indexed: 119）

// 修正後
const confirmation = row[118]; // DQ列（0-indexed: 118、B列から開始のため120-2=118）
```

## 検証手順

### 1. 診断スクリプトを実行

```bash
npx ts-node backend/diagnose-bb14-incomplete-bug.ts
```

このスクリプトは以下を確認します:
- BB14のデータベースの状態
- 「未完了」カテゴリの条件
- 全物件の「未完了」カウント
- APIエンドポイントのレスポンス

### 2. 修正を適用

修正は既に適用済みです（`backend/src/services/PropertyListingSpreadsheetSync.ts` 207行目）。

### 3. バックエンドサーバーを再起動

```bash
cd backend
npm run dev
```

### 4. スプレッドシート同期を実行

以下のいずれかの方法で同期を実行:

**方法1: GASの10分トリガーを待つ**（推奨）
- 何もせず、次の10分トリガーを待つ

**方法2: 手動で同期を実行**
```bash
npx ts-node backend/verify-bb14-confirmation-fix.ts
```

### 5. 検証

```bash
npx ts-node backend/check-bb14-confirmation.ts
```

このスクリプトは以下を確認します:
- BB14の`confirmation`カラムが「未」であること
- 「未完了」カテゴリの判定が正しいこと

### 6. フロントエンドで確認

1. ブラウザで物件リストページを開く
2. サイドバーに「未完了」カテゴリーが表示されることを確認
3. 「未完了」カテゴリーのカウントが正しいことを確認（BB14が含まれる）

## 影響範囲

### 修正による影響

- ✅ スプレッドシートからデータベースへの確認フィールド同期が正しく動作するようになる
- ✅ 「未完了」カテゴリーのカウントが正しく表示されるようになる
- ✅ BB14が「未完了」カテゴリーに正しくカウントされる

### 変更されないもの

- ✅ データベースからスプレッドシートへの同期（`syncConfirmationToSpreadsheet`）は変更なし
- ✅ 他のサイドバーカテゴリー（「未報告」「要値下げ」など）は影響を受けない
- ✅ フロントエンドのコードは変更なし

## 今後の予防策

### チェックリスト

スプレッドシートの列を読み取る際は、以下を確認:

- [ ] 読み取り範囲の開始列を確認（A列から？B列から？）
- [ ] 配列インデックスを正しく計算（開始列を考慮）
- [ ] コメントに計算式を記載（例: `// DQ列（0-indexed: 118、B列から開始のため120-2=118）`）

### 推奨される実装パターン

```typescript
// 読み取り範囲を明示
const range = '物件!B:DQ';
const rows = await this.sheetsClient.readRawRange(range);

// 開始列を定数として定義
const START_COLUMN = 'B'; // B列から開始
const START_COLUMN_INDEX = 2; // B列は2番目の列（A=1, B=2）

// 目的の列のインデックスを計算
const DQ_COLUMN_INDEX = 120; // DQ列は120番目の列
const DQ_ARRAY_INDEX = DQ_COLUMN_INDEX - START_COLUMN_INDEX; // 120 - 2 = 118

// 配列から値を取得
const confirmation = row[DQ_ARRAY_INDEX]; // row[118]
```

## 関連ドキュメント

- [Bugfix Requirements](.kiro/specs/property-listing-sidebar-incomplete-count-bug/bugfix.md)
- [Property Listing Spreadsheet Sync Service](backend/src/services/PropertyListingSpreadsheetSync.ts)
- [Property Sidebar Status Component](frontend/frontend/src/components/PropertySidebarStatus.tsx)

## 作成日

2026年3月26日

## 作成者

Kiro AI Assistant
