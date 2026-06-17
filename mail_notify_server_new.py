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
    # HOME4Uは件名部分一致で検知（地域を問わず全て対応）
    # ※本文に「HOME4Uログアウト」が含まれることが絶対条件（バックエンド側でもチェック）
    "[HOME4U] 査定依頼",
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
HOME4U_SUBJECT_PREFIX = "[HOME4U] 査定依頼"
CRON_SECRET = os.environ.get(
    "CRON_SECRET",
    "a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s="
)

# アラートメール送信URL（バックエンドAPI経由）
BACKEND_SEND_ALERT_URL = os.environ.get(
    "BACKEND_SEND_ALERT_URL",
    "https://sateituikyaku-admin-backend.vercel.app/api/sellers/send-alert"
)

# ファイルパス（Railway環境では環境変数で上書き可能）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.environ.get("GMAIL_CREDENTIALS_FILE", os.path.join(SCRIPT_DIR, "credentials.json"))
TOKEN_FILE = os.environ.get("GMAIL_TOKEN_FILE", os.path.join(SCRIPT_DIR, "token.pickle"))
LOG_FILE = os.path.join(SCRIPT_DIR, "mail_notify_server.log")

# Supabase設定（処理済みIDの永続保存用）
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

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


def send_alert_email(subject: str, body: str):
    """認証エラーなどの緊急アラートをバックエンドAPI経由でメール送信する"""
    try:
        payload = json.dumps({"subject": subject, "body": body}).encode("utf-8")
        req = urllib.request.Request(
            BACKEND_SEND_ALERT_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {CRON_SECRET}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if result.get("success"):
                logging.info(f"[アラート] ✅ アラートメール送信完了 → tenant@ifoo-oita.com")
            else:
                logging.error(f"[アラート] ❌ アラートメール送信失敗: {result}")
    except Exception as e:
        logging.error(f"[アラート] ❌ アラートメール送信エラー: {e}")


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
            error_msg = (
                "token.pickleが無効です。ローカルで token.pickle を再生成してください。"
            )
            alert_body = """Gmail認証トークンが期限切れになりました。
イエウール・HOME4Uのメールが自動転記されていない状態です。

■ 復旧手順

1. PCのPowerShellを開く

2. 以下を実行する（コピー&ペーストでOK）:

   cd C:\\Users\\kunih\\sateituikyaku-admin
   python -c "
   from google_auth_oauthlib.flow import InstalledAppFlow
   import pickle
   SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
   flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
   creds = flow.run_local_server(port=0)
   with open('token.pickle', 'wb') as f:
       pickle.dump(creds, f)
   print('完了')
   "

3. ブラウザが開いたら「株式会社威風 tenant@ifoo-oita.com」を選択して認証

4. 以下を実行:

   cd C:\\Users\\kunih\\sateituikyaku-mail-server
   copy C:\\Users\\kunih\\sateituikyaku-admin\\token.pickle token.pickle
   git add token.pickle
   git commit -m "fix: refresh Gmail token.pickle"
   git push origin main

5. RailwayのDashboardでサービスが再デプロイされれば復旧完了

■ 確認方法
Railwayのログに「接続成功！監視を開始します。」と表示されればOKです。
"""
            logging.error(f"[認証エラー] {error_msg}")
            send_alert_email("【緊急】メール監視サーバー認証エラー - 復旧手順", alert_body)
            raise RuntimeError(error_msg)
        with open(TOKEN_FILE, "wb") as token:
            pickle.dump(creds, token)

    return build("gmail", "v1", credentials=creds)


def load_notified_ids():
    """処理済みメールIDをSupabaseから読み込む（フォールバック: ローカルファイル）"""
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            # 7日以内の処理済みIDを取得
            url = f"{SUPABASE_URL}/rest/v1/mail_processed_ids?select=mail_id&created_at=gte.{__import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y-%m-%dT00:00:00Z')}"
            # 全件取得（最新2000件）
            url = f"{SUPABASE_URL}/rest/v1/mail_processed_ids?select=mail_id&order=created_at.desc&limit=2000"
            req = urllib.request.Request(
                url,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
                method="GET",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                rows = json.loads(resp.read().decode("utf-8"))
                ids = set(row["mail_id"] for row in rows)
                logging.info(f"[Supabase] 処理済みID読み込み完了（{len(ids)}件）")
                return ids
        except Exception as e:
            logging.warning(f"[Supabase] 処理済みID読み込み失敗、空セットで続行: {e}")
            return set()
    # フォールバック: ローカルファイル
    local_file = os.path.join(SCRIPT_DIR, "notified_ids_server.json")
    if os.path.exists(local_file):
        with open(local_file, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_notified_ids(ids):
    """処理済みメールIDをSupabaseに保存する（フォールバック: ローカルファイル）"""
    # このメソッドはIDを都度追加するのではなく、add_notified_id()を使う
    pass


def add_notified_id(mail_id: str):
    """処理済みメールIDをSupabaseに1件追加する"""
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            url = f"{SUPABASE_URL}/rest/v1/mail_processed_ids"
            payload = json.dumps({"mail_id": mail_id}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=payload,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=ignore-duplicates",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                pass  # 成功
        except Exception as e:
            logging.warning(f"[Supabase] ID保存失敗 ({mail_id[:8]}...): {e}")
    else:
        # フォールバック: ローカルファイル
        local_file = os.path.join(SCRIPT_DIR, "notified_ids_server.json")
        try:
            existing = set()
            if os.path.exists(local_file):
                with open(local_file, "r", encoding="utf-8") as f:
                    existing = set(json.load(f))
            existing.add(mail_id)
            ids_list = list(existing)[-2000:]
            with open(local_file, "w", encoding="utf-8") as f:
                json.dump(ids_list, f)
        except Exception as e:
            logging.warning(f"[ローカル] ID保存失敗: {e}")


def decode_body(payload):
    """メール本文をデコードする（ネストされたparts対応）"""
    def extract_text_plain(part, collected):
        mime = part.get("mimeType", "")
        if mime == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                collected.append(text)
        elif mime.startswith("multipart/"):
            for sub in part.get("parts", []):
                extract_text_plain(sub, collected)

    def extract_text_html(part, collected):
        """text/htmlからタグを除去してテキストを取得（text/plainが空の場合のフォールバック）"""
        mime = part.get("mimeType", "")
        if mime == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                html = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                text = re.sub(r'<[^>]+>', '', html)
                text = text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
                collected.append(text)
        elif mime.startswith("multipart/"):
            for sub in part.get("parts", []):
                extract_text_html(sub, collected)

    collected = []
    extract_text_plain(payload, collected)

    if collected:
        return "\n".join(collected)

    # text/plainが空の場合はtext/htmlからフォールバック取得
    html_collected = []
    extract_text_html(payload, html_collected)
    if html_collected:
        logging.info("  [本文取得] text/plainが空のためtext/htmlから取得")
        return "\n".join(html_collected)

    return ""


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
                    logging.info(f"  [DB転記] ⏭ スキップ: {result.get('message', 'HOME4Uログアウトなし')}")
                elif result.get("success"):
                    logging.info(f"  [DB転記] ✅ 完了: {result.get('message', 'OK')} ({result.get('sellerNumber', '')})")
                else:
                    logging.info(f"  [DB転記] ❌ 失敗: {result.get('error', '不明なエラー')}")
        except Exception as e:
            logging.info(f"  [DB転記] ❌ エラー: {e}")

    threading.Thread(target=_call, daemon=True).start()


def trigger_lifull_transfer(body: str):
    """LIFULL HOME'Sメール本文をバックエンドに送ってDB即時転記"""
    def _call():
        try:
            logging.info("  [DB転記] /api/sellers/lifull-transfer 呼び出し開始...")
            payload = json.dumps({"body": body}).encode("utf-8")
            req = urllib.request.Request(
                "https://sateituikyaku-admin-backend.vercel.app/api/sellers/lifull-transfer",
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
                    logging.info(f"  [DB転記] ⏭ スキップ: {result.get('message', '重複')}")
                elif result.get("success"):
                    logging.info(f"  [DB転記] ✅ 完了: {result.get('message', 'OK')} ({result.get('sellerNumber', '')})")
                else:
                    logging.info(f"  [DB転記] ❌ 失敗: {result.get('error', '不明なエラー')}")
        except Exception as e:
            logging.info(f"  [DB転記] ❌ エラー: {e}")

    threading.Thread(target=_call, daemon=True).start()


def trigger_ieul_transfer(body: str):
    """イエウールメール本文をバックエンドに送ってDB即時転記 + スプシ同期"""
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
    """新着メールをチェックして転記する"""
    try:
        results = service.users().messages().list(
            userId="me",
            q="newer_than:2d",
            maxResults=20
        ).execute()

        messages = results.get("messages", [])

        for msg in messages:
            msg_id = msg["id"]

            # 処理済みIDはスキップ
            if msg_id in notified_ids:
                continue

            msg_detail = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="full"
            ).execute()

            headers = msg_detail["payload"]["headers"]
            subject = ""
            sender = ""
            for header in headers:
                if header["name"] == "Subject":
                    subject = header["value"]
                if header["name"] == "From":
                    sender = header["value"]

            # 返信・転送はスキップ（ただしHOME4Uは本文チェックで後処理）
            reply_prefix_pattern = re.compile(r'^(Re|Fwd?|FW|RE|転送)\s*:', re.IGNORECASE)
            is_reply = reply_prefix_pattern.match(subject)

            # LIFULLのRe:メールで送信者が自分（社員メモ付き返信）の場合は転記対象にする
            LIFULL_SUBJECT = "【LIFULL HOME'S】＜実名＞査定依頼がありました"
            OWN_EMAIL = "tenant@ifoo-oita.com"
            is_lifull_self_reply = (
                is_reply
                and LIFULL_SUBJECT in subject
                and OWN_EMAIL in sender
            )

            def subject_matches(subject, keyword):
                if keyword == "【すまいステップ 反響通知メール】":
                    return subject.startswith(keyword)
                if keyword == "[HOME4U] 査定依頼":
                    return keyword in subject
                return subject == keyword

            matched = any(subject_matches(subject, keyword) for keyword in SUBJECT_KEYWORDS)

            if matched and not is_reply:
                body = decode_body(msg_detail["payload"])
                logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 新着メール検知: {subject}")
                logging.info(f"  [本文先頭] {repr(body[:120])}")

                if subject == IEUL_SUBJECT:
                    logging.info("  [DB転記] イエウール検知 → ieul-transfer を非同期実行します")
                    trigger_ieul_transfer(body)
                elif HOME4U_SUBJECT_PREFIX in subject:
                    if 'HOME4Uログアウト' in body:
                        logging.info("  [DB転記] HOME4U検知 → home4u-transfer を非同期実行します")
                        trigger_home4u_transfer(body)
                    else:
                        logging.info(f"  [スキップ] HOME4Uだが本文に「HOME4Uログアウト」なし")
                elif LIFULL_SUBJECT in subject:
                    logging.info(f"  [スキップ] LIFULL元メール（Re:なし）→ 社員のRe:返信を待ちます")
                else:
                    logging.info(f"  [スキップ] 転記対象外: {subject[:50]}")

                notified_ids.add(msg_id)
                add_notified_id(msg_id)

            elif is_lifull_self_reply:
                body = decode_body(msg_detail["payload"])
                logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 LIFULL社員メモ付きRe:検知: {subject}")
                logging.info(f"  [本文先頭] {repr(body[:120])}")
                trigger_lifull_transfer(body)
                notified_ids.add(msg_id)
                add_notified_id(msg_id)

            elif HOME4U_SUBJECT_PREFIX in subject:
                body = decode_body(msg_detail["payload"])
                if body and 'HOME4Uログアウト' in body:
                    logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 HOME4U本文検知（Re:含む）: {subject}")
                    logging.info(f"  [本文先頭] {repr(body[:120])}")
                    trigger_home4u_transfer(body)
                notified_ids.add(msg_id)
                add_notified_id(msg_id)

            else:
                notified_ids.add(msg_id)
                add_notified_id(msg_id)

    except Exception as e:
        logging.error(f"[{datetime.now().strftime('%H:%M:%S')}] エラー: {e}")

    return notified_ids


def main():
    logging.info("=" * 50)
    logging.info("メール監視サーバースクリプト 起動中...")
    logging.info(f"チェック間隔: {CHECK_INTERVAL}秒")
    logging.info("=" * 50)

    logging.info("Gmailに接続中...")
    try:
        service = get_gmail_service()
    except RuntimeError as e:
        logging.error(f"起動失敗: {e}")
        sys.exit(1)
    logging.info("接続成功！監視を開始します。\n")

    # 既存の処理済みIDを読み込む（Supabaseから取得 → 再起動後も保持）
    notified_ids = load_notified_ids()
    logging.info(f"処理済みID読み込み完了（{len(notified_ids)}件）")

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
