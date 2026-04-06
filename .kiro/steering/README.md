# ステアリングドキュメント構成

## 📁 常時読み込み（最小限）

### 基本ルール（5つのみ）
- `japanese-language.md` - 日本語応答
- `project-isolation-rule.md` - プロジェクト隔離
- `git-history-first-approach.md` - Git履歴優先
- `file-encoding-protection.md` - エンコーディング保護
- `encryption-key-protection.md` - 暗号化キー保護

## 📋 条件付き読み込み（fileMatch）

### 売主関連ファイル編集時のみ
- `seller-table-column-definition.md` - `**/seller*.{ts,tsx,js,md}`
- `seller-spreadsheet-column-mapping.md` - `**/seller*.{ts,tsx,js,md}`
- `sidebar-status-definition.md` - `**/seller*.{ts,tsx,js,md}`

### 買主関連ファイル編集時のみ
- `buyer-spreadsheet-column-mapping.md` - `**/buyer*.{ts,tsx,js,md}`
- `buyer-sidebar-status-definition.md` - `**/buyer*.{ts,tsx,js,md}`

### バックエンド編集時のみ
- `backend-architecture.md` - `backend/**/*.{ts,js}`

### 日付・時刻関連編集時のみ
- `timezone-handling-rules.md` - `**/*{date,time,Date,Time}*.{ts,tsx,js}`

## 🔧 手動読み込み（`#ファイル名`で参照）

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
- `#auto-sync-timing` - 同期タイミング確認時

### Spec作成時
- `#spec-file-size-guidelines` - Specファイルサイズガイドライン

## 🚫 除外ファイル（.kiroignore）

以下のファイルはKiroのコンテキストから除外されています：

- `gas_buyer_complete_code.js` - 大きなGASファイル（723行）
- `gas_seller_complete_code.js` - 大きなGASファイル
- `*.log` - ログファイル
- `auto-sync-log.txt` - 自動同期ログ

**理由**: これらのファイルはトークン消費が大きく（30,000トークン以上）、セッションを短くする原因となるため。

---

**最終更新日**: 2026年4月6日
**変更**: 常時読み込みを5ファイルのみに削減、大部分を条件付き/手動読み込みに変更、.kiroignoreを追加
