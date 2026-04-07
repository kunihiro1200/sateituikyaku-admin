# 追客電話月間ランキング機能

## 概要

通話モードページの追客ログセクションに「追客電話月間ランキング」ボタンを追加。
Google Spreadsheet「売主追客ログ」から当月のデータを集計し、スタッフ別の追客電話件数をランキング表示。

## データソース

- **スプレッドシートID**: `1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I`
- **シート名**: 売主追客ログ
- **集計対象列**:
  - A列: 日付（当月のデータのみ）
  - E列: 1回目イニシャル
  - F列: 2回目イニシャル

## 実装

### バックエンド

**エンドポイント**: `GET /api/sellers/call-tracking-ranking`

**ファイル**: `backend/src/routes/sellers.ts`

**処理**:
1. 東京時間（Asia/Tokyo）で当月の開始日・終了日を計算
2. Google Sheets APIでデータ取得（レート制限付き）
3. A列の日付を解析し、当月のデータのみをフィルタリング
4. E列・F列のイニシャルをカウント（両方にある場合は両方カウント）
5. 件数降順、同数の場合はイニシャル昇順でソート

**レスポンス形式**:
```json
{
  "period": { "from": "2026-04-01", "to": "2026-04-30" },
  "rankings": [
    { "initial": "Y", "count": 75 },
    { "initial": "R", "count": 58 }
  ],
  "updatedAt": "2026-04-15T10:30:00.000Z"
}
```

### フロントエンド

**コンポーネント**: `CallRankingDisplay`

**ファイル**: `frontend/frontend/src/components/CallRankingDisplay.tsx`

**拡張内容**:
- `title` プロパティを追加（デフォルト: "1番電話月間ランキング"）
- `endpoint` プロパティを追加（デフォルト: "/api/sellers/call-ranking"）

**使用例**:
```tsx
<CallRankingDisplay
  title="追客電話月間ランキング"
  endpoint="/api/sellers/call-tracking-ranking"
/>
```

**配置場所**: `CallModePage.tsx`

- 追客ログセクションの一番上にボタンを配置
- ボタンクリックでモーダルダイアログを表示
- 1番電話月間ランキングと同じUIパターン

## 注意事項

- Google Sheets APIのレート制限（100リクエスト/100秒）を考慮し、`sheetsRateLimiter`を使用
- 日付フィルタリングは東京時間（Asia/Tokyo）で実行
- イニシャルの大文字・小文字を区別してカウント
- E列とF列の両方にイニシャルがある場合は両方カウント

---

**作成日**: 2026年4月7日  
**実装完了日**: 2026年4月7日
