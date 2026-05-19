"""
メール監視サーバースクリプト（Railway用）
- Windows通知・ブラウザオープンなし
- イエウール検知 → DB即時転記のみ
- 24時間365日稼働
"""

import os
import json
import time
import base64
import pickle
import re
import sys
import logging
import threading
import urllib.request
from datetime import datetime

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ===== 設定 =====
IEUL_SUBJECT = "【イエウール】不動産査定依頼のお知らせ"

SUBJECT_KEYWORDS = [
    "【イエウール】不動産査定依頼のお知らせ",
    "[HOME4U] 査定依頼 -- <大分県> 別府市",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市東区",
    "[HOME4U] 査定依頼 -- <大分県> 大分市",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市西区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市中央区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市城南区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市博多区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市南区",
    "【すまいステップ 反響通知メール】",
    "【LIFULL HOME'S】＜実名＞査定依頼がありました",
    "【反響 Yahoo!不動産 売買ツール】お客様から売却査定依頼がありました",
]

# チェック間隔（秒）
CHECK_INTERVAL = 10

# バックエンドAPI設定
BACKEND_IEUL_TRANSFER_URL = os.environ.get(
    "BACKEND_IEUL_TRANSFER_URL",
    "https://sateituikyaku-admin-backend.vercel.app/api/sellers/ieul-transfer"
)
BACKEND_HOME4U_TRANSFER_URL = os.environ.get(
    "BACKEND_HOME4U_TRANSFER_URL",
    "https://sateituikyaku-admin-backend.vercel.app/api/sellers/home4u-transfer"
)
HOME4U_SUBJECTS = [
    "[HOME4U] 査定依頼 -- <大分県> 別府市",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市東区",
    "[HOME4U] 査定依頼 -- <大分県> 大分市",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市西区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市中央区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市城南区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市博多区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市南区",
    "[HOME4U] 査定依頼 -- <福岡県> 福岡市早良区",
]
CRON_SECRET = os.environ.get(
    "CRON_SECRET",
    "a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s="
)

# ファイルパス（Railway環境では環境変数で上書き可能）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.environ.get("GMAIL_CREDENTIALS_FILE", os.path.join(SCRIPT_DIR, "credentials.json"))
TOKEN_FILE = os.environ.get("GMAIL_TOKEN_FILE", os.path.join(SCRIPT_DIR, "token.pickle"))
NOTIFIED_IDS_FILE = os.path.join(SCRIPT_DIR, "notified_ids_server.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "mail_notify_server.log")

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ]
)

# Gmail APIのスコープ
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
# ================


def get_gmail_service():
    """Gmail APIサービスを取得する"""
    creds = None

    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # サーバー環境では対話的認証不可 → ローカルで事前に token.pickle を生成しておく
            raise RuntimeError(
                "token.pickleが無効です。ローカルで一度 mail_notify.py を実行して"
                "token.pickleを再生成してからRailwayにデプロイしてください。"
            )
        with open(TOKEN_FILE, "wb") as token:
            pickle.dump(creds, token)

    return build("gmail", "v1", credentials=creds)


def load_notified_ids():
    """通知済みメールIDを読み込む"""
    if os.path.exists(NOTIFIED_IDS_FILE):
        with open(NOTIFIED_IDS_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_notified_ids(ids):
    """通知済みメールIDを保存する（最新1000件のみ保持）"""
    ids_list = list(ids)[-1000:]
    with open(NOTIFIED_IDS_FILE, "w", encoding="utf-8") as f:
        json.dump(ids_list, f)


def decode_body(payload):
    """メール本文をデコードする"""
    body = ""
    if "parts" in payload:
        for part in payload["parts"]:
            if part["mimeType"] == "text/plain":
                data = part["body"].get("data", "")
                if data:
                    body = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                    break
    else:
        data = payload["body"].get("data", "")
        if data:
            body = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    return body


def trigger_home4u_transfer(body: str):
    """HOME4Uメール本文をバックエンドに送ってDB即時転記"""
    def _call():
        try:
            logging.info("  [DB転記] /api/sellers/home4u-transfer 呼び出し開始...")
            payload = json.dumps({"body": body}).encode("utf-8")
            req = urllib.request.Request(
                BACKEND_HOME4U_TRANSFER_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {CRON_SECRET}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                if result.get("skipped"):
                    logging.info("  [DB転記] ⏭ スキップ（HOME4Uログアウトなし）")
                elif result.get("success"):
                    logging.info(f"  [DB転記] ✅ 完了: {result.get('message', 'OK')} ({result.get('sellerNumber', '')})")
                else:
                    logging.info(f"  [DB転記] ❌ 失敗: {result.get('error', '不明なエラー')}")
        except Exception as e:
            logging.info(f"  [DB転記] ❌ エラー: {e}")

    threading.Thread(target=_call, daemon=True).start()


def trigger_ieul_transfer(body: str):
    """
    イエウールメール本文をバックエンドに送ってDB即時転記 + スプシ同期を行う。
    別スレッドで非同期実行。
    """
    def _call():
        try:
            logging.info("  [DB転記] /api/sellers/ieul-transfer 呼び出し開始...")
            payload = json.dumps({"body": body}).encode("utf-8")
            req = urllib.request.Request(
                BACKEND_IEUL_TRANSFER_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {CRON_SECRET}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                if result.get("success"):
                    logging.info(f"  [DB転記] ✅ 完了: {result.get('message', 'OK')} ({result.get('sellerNumber', '')})")
                else:
                    logging.info(f"  [DB転記] ❌ 失敗: {result.get('error', '不明なエラー')}")
        except Exception as e:
            logging.info(f"  [DB転記] ❌ エラー: {e}")

    threading.Thread(target=_call, daemon=True).start()


def check_new_emails(service, notified_ids):
    """新着メールをチェックしてイエウールならDB転記する"""
    try:
        results = service.users().messages().list(
            userId="me",
            q="newer_than:1d",
            maxResults=10
        ).execute()

        messages = results.get("messages", [])

        for msg in messages:
            msg_id = msg["id"]

            if msg_id in notified_ids:
                continue

            msg_detail = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="full"
            ).execute()

            headers = msg_detail["payload"]["headers"]
            subject = ""
            for header in headers:
                if header["name"] == "Subject":
                    subject = header["value"]
                    break

            # 返信・転送はスキップ
            reply_prefix_pattern = re.compile(r'^(Re|Fwd?|FW|RE|転送)\s*:', re.IGNORECASE)
            if reply_prefix_pattern.match(subject):
                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)
                continue

            def subject_matches(subject, keyword):
                if keyword == "【すまいステップ 反響通知メール】":
                    return subject.startswith(keyword)
                return subject == keyword

            matched = any(subject_matches(subject, keyword) for keyword in SUBJECT_KEYWORDS)

            if matched:
                body = decode_body(msg_detail["payload"])
                logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 新着メール検知: {subject}")

                # イエウールのみDB転記
                if subject == IEUL_SUBJECT:
                    logging.info("  [DB転記] イエウール検知 → ieul-transfer を非同期実行します")
                    trigger_ieul_transfer(body)
                elif any(subject == s for s in HOME4U_SUBJECTS):
                    logging.info("  [DB転記] HOME4U検知 → home4u-transfer を非同期実行します")
                    trigger_home4u_transfer(body)
                else:
                    logging.info(f"  [スキップ] イエウール・HOME4U以外のため転記なし: {subject[:50]}")

                # 通知済みとして記録（matchedの場合も必ず記録する）
                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)

            # HOME4Uは件名Re:でも本文に「HOME4Uログアウト」があれば必ず処理
            else:
                body = decode_body(msg_detail["payload"])
                if body and 'HOME4Uログアウト' in body:
                    logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 HOME4U本文検知（Re:スキップ回避）: {subject}")
                    trigger_home4u_transfer(body)

                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)

    except Exception as e:
        logging.error(f"[{datetime.now().strftime('%H:%M:%S')}] エラー: {e}")

    return notified_ids


def main():
    logging.info("=" * 50)
    logging.info("メール監視サーバースクリプト 起動中...")
    logging.info(f"チェック間隔: {CHECK_INTERVAL}秒")
    logging.info("=" * 50)

    logging.info("Gmailに接続中...")
    service = get_gmail_service()
    logging.info("接続成功！監視を開始します。\n")

    notified_ids = load_notified_ids()

    # 起動時点の既存メールをスキップ登録
    logging.info("起動時チェック：現時点の全メールをスキップ登録中...")
    try:
        for query in ["is:unread", "is:read"]:
            results = service.users().messages().list(
                userId="me",
                q=query,
                maxResults=100
            ).execute()
            for msg in results.get("messages", []):
                notified_ids.add(msg["id"])
        save_notified_ids(notified_ids)
        logging.info(f"スキップ登録完了（合計 {len(notified_ids)} 件）。これ以降に届くメールを監視します。")
    except Exception as e:
        logging.info(f"スキップ処理エラー: {e}")

    logging.info("新着メールの監視を開始します...\n")

    while True:
        try:
            notified_ids = check_new_emails(service, notified_ids)
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            logging.info("\n停止しました。")
            break
        except Exception as e:
            logging.error(f"予期しないエラー: {e}")
            time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
