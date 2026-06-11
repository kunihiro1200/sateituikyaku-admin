---
inclusion: manual
---

# メール監視サーバー（mail_notify_server.py）修正ルール

---

## 🔴🔴🔴 `sellers.ts` 編集時の必須ルール（2026年6月3日追加）

### 背景（なぜこのルールが必要か）

HOME4U新フォーマット対応のために `sellers.ts` を編集した際、同じファイル内の `ieul-transfer` のコードも巻き込んで壊してしまった。
「イエウールが転記されない」問題が発生したが、Railwayのログを確認せずにコードを先に変更し、問題が悪化した。

### ✅ `sellers.ts` を編集する前に必ず確認すること

1. **変更対象のルートを明示する**
   - `ieul-transfer` を変更するのか、`home4u-transfer` を変更するのかを最初に確認する
   - 変更対象外のルートには触れない

2. **変更前に動作確認スクリプトを実行する**（基準値を記録する）
   ```powershell
   python manual_ieul_transfer.py   # イエウール転記テスト → 成功することを確認
   python manual_home4u_transfer.py # HOME4U転記テスト → 成功することを確認
   ```

3. **変更後も同じスクリプトで動作確認する**
   - 変更対象外のルートが壊れていないことを確認してからプッシュする

### ✅ 「転記されない」問題が起きたときの正しい手順

**コードを変更する前に必ずRailwayのログを確認する。**

1. Railwayのログで `🔔 新着メール検知` があるか確認
2. `[DB転記] ❌ エラー` があるか確認
3. Vercelのログでエラー詳細（`name=` `tel=`）を確認
4. **原因が特定できてから**コードを変更する

原因不明のままコードを変更すると、動いている別の機能を壊すリスクがある。

---

## ⚠️ 最重要：2つのリポジトリに必ず両方反映する

---

## 🔴 絶対に守るべきルール

### `mail_notify_server.py` を修正したら**必ず2箇所**にプッシュする

| リポジトリ | パス | 用途 |
|-----------|------|------|
| `sateituikyaku-admin` | `C:\Users\kunih\sateituikyaku-admin\mail_notify_server.py` | ソース管理・バックアップ |
| `sateituikyaku-mail-server` | `C:\Users\kunih\sateituikyaku-mail-server\mail_notify_server.py` | **Railwayが実際に動かすコード** ← これが本番 |

**`sateituikyaku-admin` だけにプッシュしてもRailwayには反映されない。**

---

## ✅ 正しい修正手順

```powershell
# 1. sateituikyaku-adminで修正・コミット・プッシュ
git add mail_notify_server.py
git commit -m "fix: ..."
git push origin main

# 2. sateituikyaku-mail-serverにコピーしてプッシュ（必須）
Copy-Item "C:\Users\kunih\sateituikyaku-admin\mail_notify_server.py" `
          "C:\Users\kunih\sateituikyaku-mail-server\mail_notify_server.py" -Force

git -C C:\Users\kunih\sateituikyaku-mail-server add mail_notify_server.py
git -C C:\Users\kunih\sateituikyaku-mail-server commit -m "fix: ..."
git -C C:\Users\kunih\sateituikyaku-mail-server push origin main
```

**ステップ2を忘れると、Railwayは古いコードのまま動き続ける。**

---

## 📋 チェックリスト

`mail_notify_server.py` を修正したら：

- [ ] `sateituikyaku-admin` にコミット・プッシュしたか？
- [ ] `sateituikyaku-mail-server` にコピーしてコミット・プッシュしたか？
- [ ] RailwayのDeploy Logsで新しいコミットハッシュが反映されているか確認したか？

---

## 🚫 過去の失敗事例（2026年5月30日）

### 問題1：`sateituikyaku-admin` だけにプッシュ
- `sateituikyaku-admin` に修正をプッシュしたが、Railwayは `sateituikyaku-mail-server` を見ているため反映されなかった
- 何度修正してもRailwayは古いコードのまま動き続けた

### 問題2：起動時スキップ登録でメール漏れ
- 起動時に `is:unread` + `is:read` 各100件をスキップ登録していた
- 再起動後に届いたメールが既読だとスキップ登録に含まれ、転記されなかった
- **修正済み**：起動時刻タイムスタンプ方式に変更（それより前のメールのみスキップ）

---

## 🏗️ システム構成

```
Gmail受信
    ↓
Railway（sateituikyaku-mail-server リポジトリ）
    ↓ mail_notify_server.py が10秒ごとにチェック
    ↓ HOME4U検知 → 本文に「HOME4Uログアウト」があれば
    ↓
Vercel バックエンド（sateituikyaku-admin-backend）
    ↓ /api/sellers/home4u-transfer
    ↓
Supabase DB + スプレッドシート同期
```

---

## 🔧 HOME4Uメール検知ルール（重要）

1. **件名に `[HOME4U] 査定依頼` が含まれる**（部分一致）← 地域問わず全対応
2. **本文に `HOME4Uログアウト` が含まれる**（絶対条件）
3. この2条件を満たす場合のみ `/api/sellers/home4u-transfer` を呼び出す

**地域ごとの件名リストは廃止済み。絶対に復活させない。**

---

## 📍 Railwayデプロイ確認方法

1. Railway Dashboard → `handsome-purpose` プロジェクト → `web` サービス
2. Deploy Logs タブを開く
3. 最新デプロイのコミットハッシュが `sateituikyaku-mail-server` の最新コミットと一致しているか確認
4. ログに `接続成功！監視を開始します。` が表示されていれば正常稼働中

---

## 🚨 転記されない場合の診断チェックリスト

転記されなかったら**まずRailwayのログを確認**して以下を判定する。

### パターンA：ログに `🔔 新着メール検知` が**ない**
→ mail_notify_server.py（Railway側）の問題

| 確認内容 | 原因 |
|---------|------|
| ログに `接続成功！監視を開始します。` がない | Railwayが古いコードのまま。`sateituikyaku-mail-server` へのプッシュ忘れ |
| ログに `[認証エラー]` がある | token.pickleが期限切れ。ローカルで再生成してmail-serverにプッシュ |
| 件名がSUBJECT_KEYWORDSに一致しない | `subject_matches()` のロジック確認 |

### パターンB：ログに `🔔 新着メール検知` はあるが `[DB転記]` が**ない**
→ スキップ判定の問題

| ログメッセージ | 原因 |
|-------------|------|
| `スキップ: HOME4Uだが本文に「HOME4Uログアウト」なし` | メール本文に `HOME4Uログアウト` が含まれていない（正常スキップ） |
| `イエウール・HOME4U以外のため転記なし` | `SUBJECT_KEYWORDS` に一致したが対象サービス以外 |
| ログが何もない（スキップも検知もない） | `internalDate < start_timestamp_ms` でスキップ。サーバー起動直後に届いたメールが起動前のタイムスタンプと判定された可能性 → 手動転記で対応 |

### パターンC：ログに `[DB転記] ❌ エラー: HTTP Error 400` がある
→ バックエンドのパース失敗

| 原因 | 対処 |
|------|------|
| **イエウール**: Gmailスレッドヘッダーが本文先頭に入り `氏名` や `電話番号` が取れない | `backend/src/routes/sellers.ts` の `ieul-transfer` に `=====` 区切り線までのヘッダー除去処理を追加済み（2026/6/3修正） |
| **HOME4U**: 新フォーマット（`姓 X 名 Y` 形式）でパース失敗 | `backend/src/routes/sellers.ts` の `home4u-transfer` に新フォーマット対応追加済み（2026/6/3修正） |
| それ以外 | Vercelのログで `[ieul-transfer]` または `[home4u-transfer]` のエラー詳細を確認 |

### パターンD：ログに `[DB転記] ✅ 完了` はあるがDBに登録されていない
→ 重複チェックでスキップされた

| ログメッセージ | 原因 |
|-------------|------|
| `重複スキップ: 電話番号・反響日時が既存売主 XXX と一致` | 同一電話番号・同一反響日時が既に登録済み（正常動作） |

### 手動転記の方法
```powershell
# イエウール
python manual_ieul_transfer.py  # 本文を貼り付けて実行

# HOME4U（■形式）
python manual_home4u_transfer.py  # 本文を貼り付けて実行
```

---

## 🔑 重要な実装メモ（2026年6月3日追記）

### `internalDate` の取得場所
- `messages().list()` のレスポンスには `internalDate` が**含まれない**
- `messages().get()` のレスポンスにのみ含まれる
- タイムスタンプフィルタは必ず `msg_detail.get("internalDate")` で取得すること

### Gmailスレッドヘッダー問題
- Gmailで返信スレッドとして届いたメールは、本文先頭に `イエウール運営事務局\r\n18:26...` のような送信者情報が付加される
- `ieul-transfer` は `=====` 区切り線 or `■ 査定依頼情報` or `依頼日時` が出現する手前までをスキップして本文を抽出する

### HOME4Uフォーマット
- **旧フォーマット**（〜2026年5月）: `■お名前　：` 形式
- **新フォーマット**（2026年6月〜）: `姓 X 名 Y 電話番号 XXXX` のスペース区切り形式
- `査定ナンバー SA\d+` かつ `姓 \S` パターンで新フォーマットを判定し `■` 形式に正規化

---

**最終更新日**: 2026年6月3日
**作成理由**: HOME4Uメール転記漏れ（2リポジトリ管理の見落とし・起動時スキップ問題）の再発防止
**更新履歴**:
- 2026年5月30日: 初版作成
- 2026年6月3日: 転記されない場合の診断チェックリストを追加。`internalDate`取得場所の注意事項、Gmailスレッドヘッダー問題、HOME4U新フォーマット対応を記録
