---
inclusion: auto
---

# ステアリングドキュメント構成

## 重要：inclusion設定について

各ファイルのfrontmatterで読み込みタイミングを制御しています。

- `inclusion: auto` → 常時読み込み（毎回コンテキストに含まれる）
- `inclusion: fileMatch` → 対象ファイル編集時のみ自動で読み込む
- `inclusion: manual` → `#ファイル名` で明示的に参照したときのみ読み込む

---

## 📁 常時読み込み（auto）

プロジェクト全体で常に守るべき基本ルール。

| ファイル | 内容 |
|---------|------|
| `japanese-language.md` | 日本語応答 |
| `project-isolation-rule.md` | プロジェクト隔離（触ってはいけないプロジェクト） |
| `git-history-first-approach.md` | Git履歴優先アプローチ |
| `file-encoding-protection.md` | エンコーディング保護（UTF-8必須） |
| `encryption-key-protection.md` | 暗号化キー保護（絶対に変更しない） |
| `email-html-image-display-rules.md` | メールHTML画像表示ルール |
| `backend-file-edit-safety-rules.md` | バックエンド編集安全ルール（tsc必須） |
| `scraping-server-protection.md` | スクレイピングサーバー保護 |
| `ranking-initial-normalization-rules.md` | ランキング集計イニシャル正規化 |

---

## 📋 条件付き読み込み（fileMatch）

対象ファイルを開いているときだけ自動で読み込まれる。

### バックエンド編集時のみ
- `backend-architecture.md` - `backend/**/*.{ts,js}`

### 売主関連ファイル編集時のみ
- `seller-table-column-definition.md` - `**/seller*.{ts,tsx,js,md}`
- `seller-spreadsheet-column-mapping.md` - `**/seller*.{ts,tsx,js,md}`
- `sidebar-status-definition.md` - `**/seller*.{ts,tsx,js,md}`

### 買主関連ファイル編集時のみ
- `buyer-spreadsheet-column-mapping.md` - `**/buyer*.{ts,tsx,js,md}`
- `buyer-sidebar-status-definition.md` - `**/buyer*.{ts,tsx,js,md}`

### 日付・時刻関連編集時のみ
- `timezone-handling-rules.md` - `**/*{date,time,Date,Time}*.{ts,tsx,js}`
- `date-field-handling-rules.md` - `**/*{date,Date,time,Time}*.{ts,tsx,js}`

---

## 🔧 手動読み込み（manual）

`#ファイル名` で参照したときのみ読み込まれる。

### HOME4U・メール転記関連（⚠️ 繰り返しトラブルあり。必ず参照すること）
- `#home4u-mail-transfer-rules` - HOME4U転記の全経緯・注意事項・修正履歴
- `#mail-notify-server-rules` - メール監視サーバー修正ルール

### デバッグ系
- `#pagination-debugging-checklist`
- `#cache-invalidation-checklist`
- `#gas-debugging-checklist`
- `#frontend-backend-debugging-checklist`

### GAS作業時
- `#gas-sidebar-counts-update-guide`
- `#gas-file-organization`
- `#gas-modification-safety-rules`
- `#gas-rowtoobject-time-column-handling`

### 特殊ケース
- `#environment-definition` - 環境確認時
- `#identifier-prefix-rules` - 識別子確認時
- `#deploy-procedure` - デプロイ時
- `#vercel-deploy-procedure` - Vercelデプロイ時
- `#vercel-deployment-rules` - Vercelデプロイルール
- `#auto-sync-timing` - 同期タイミング確認時
- `#spec-file-size-guidelines` - Specファイルサイズ
- `#window-open-popup-block-rules` - window.openポップアップブロック防止

### 実装記録系（過去の修正記録）
- `#visit-appointment-features`
- `#property-listing-spreadsheet-sync-fix`
- `#calendar-send-fix`
- `#buyer-other-property-section-fix`
- `#buyer-email-history-property-display`
- `#seller-property-email-search-implementation`

### その他（特定場面のみ）
- `#athome-scraping-guide`
- `#google-sheets-api-quota-optimization`
- `#property-preview-and-vercel-rules`
- `#property-listing-sync-rules`
- `#property-listing-column-mapping`
- `#property-listing-seller-name-rule`
- `#property-comments-auto-sync-rule`
- `#property-coordinates-sync-rules`
- `#public-property-definition`
- `#react-usememo-dependencies`
- `#buyer-viewing-date-field-correction`
- `#buyer-viewing-date-sync-protection`
- `#seller-visit-date-timestamp-migration`

---

## 🚫 除外ファイル（.kiroignore）

以下のファイルはKiroのコンテキストから除外されています：

- `gas_buyer_complete_code.js` - 大きなGASファイル（723行）
- `gas_seller_complete_code.js` - 大きなGASファイル
- `*.log` - ログファイル
- `auto-sync-log.txt` - 自動同期ログ

**理由**: これらのファイルはトークン消費が大きく（30,000トークン以上）、セッションを短くする原因となるため。

---

**最終更新日**: 2026年6月12日
**変更**: 全ファイルにfrontmatterを追加（inclusionを明示的に設定）、HOME4Uトラブル経緯をhome4u-mail-transfer-rules.mdに記録
