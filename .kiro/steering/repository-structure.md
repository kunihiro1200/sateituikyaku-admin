# リポジトリ構成とデプロイ先

## ⚠️ 重要：複数リポジトリで管理されている

このワークスペース（`sateituikyaku-admin`）だけがすべてではない。
ファイルを編集・デプロイする前に、**どのリポジトリに属するか**を必ず確認すること。

---

## 📁 リポジトリ一覧

| リポジトリ | ローカルパス | デプロイ先 | 主なファイル |
|---|---|---|---|
| `sateituikyaku-admin` | `C:\Users\kunih\sateituikyaku-admin` | Vercel（フロントエンド・バックエンド） | `frontend/`, `backend/` |
| `sateituikyaku-mail-server` | `C:\Users\kunih\sateituikyaku-mail-server` | Railway（`web` サービス） | `mail_notify_server.py` |
| `sateituikyaku-scrape-server` | `C:\Users\kunih\sateituikyaku-scrape-server` | Railway（スクレイピング） | `scrape_server.py` |

---

## 🚨 過去の障害

**発生日**: 2026年8月  
**症状**: `mail_notify_server.py` を修正して `sateituikyaku-admin` にpushしたが、Railwayにデプロイされなかった  
**原因**: Railwayは `sateituikyaku-mail-server` リポジトリを監視しているが、誤って `sateituikyaku-admin` にpushした  
**修正**: `C:\Users\kunih\sateituikyaku-mail-server` で作業してpushする必要がある

---

## 🔧 mail_notify_server.py を修正する場合の手順

1. `C:\Users\kunih\sateituikyaku-mail-server\mail_notify_server.py` を編集
2. `C:\Users\kunih\sateituikyaku-mail-server` でコミット・push
3. Railwayが自動デプロイ（`main` ブランチ監視）

---

## 📝 Railway サービス情報

- **サービス名**: web
- **URL**: `web-production-348cb.up.railway.app`
- **監視リポジトリ**: `kunihiro1200/sateituikyaku-mail-server`（mainブランチ）
- **起動コマンド**: `python mail_notify_server.py`（Procfileで定義）

---

**最終更新日**: 2026年8月
