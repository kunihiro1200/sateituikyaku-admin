"""
メール通知スクリプト
Gmail APIでメールを監視し、特定の件名のメールが来たらWindowsに通知を出す
+ URLを自動でブラウザで開く
+ イエウールメールはバックエンドAPI経由でDB即時転記（GASのスプシ転記と並行）
"""

import os
import json
import time
import base64
import pickle
import re
import webbrowser
import sys
import logging
import threading
import urllib.request
from datetime import datetime

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from win10toast import ToastNotifier

# ===== 設定 =====
# 監視するメールアドレス
TARGET_EMAIL = "tenant@ifoo-oita.com"

# 通知対象の件名（完全一致）
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
CHECK_INTERVAL = 3

# ファイルパス
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.path.join(SCRIPT_DIR, "credentials.json")
TOKEN_FILE = os.path.join(SCRIPT_DIR, "token.pickle")
NOTIFIED_IDS_FILE = os.path.join(SCRIPT_DIR, "notified_ids.json")
LOG_FILE = os.path.join(SCRIPT_DIR, "mail_notify.log")

# ログ設定（UTF-8で書き込む）
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

# ===== イエウール即時転記設定 =====
IEUL_SUBJECT = "【イエウール】不動産査定依頼のお知らせ"
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
BACKEND_IEUL_TRANSFER_URL = "https://sateituikyaku-admin-backend.vercel.app/api/sellers/ieul-transfer"
BACKEND_HOME4U_TRANSFER_URL = "https://sateituikyaku-admin-backend.vercel.app/api/sellers/home4u-transfer"
CRON_SECRET = "a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s="
# =================================


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
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

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


def extract_urls(text):
    """テキストからURLを抽出する"""
    url_pattern = r'https?://[^\s\u3000\u3001\u3002\uff01\uff09\u300d]+'
    return re.findall(url_pattern, text)


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
    別スレッドで非同期実行するのでメール監視をブロックしない。
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


def check_new_emails(service, toaster, notified_ids):
    """新着メールをチェックして通知を出す"""
    try:
        # 直近10件を検索（既読・未読問わず）
        results = service.users().messages().list(
            userId="me",
            q="newer_than:1d",
            maxResults=10
        ).execute()

        messages = results.get("messages", [])

        for msg in messages:
            msg_id = msg["id"]

            # 通知済みならスキップ
            if msg_id in notified_ids:
                continue

            msg_detail = service.users().messages().get(
                userId="me",
                id=msg_id,
                format="full"
            ).execute()

            # ヘッダーから件名を取得
            headers = msg_detail["payload"]["headers"]
            subject = ""
            for header in headers:
                if header["name"] == "Subject":
                    subject = header["value"]
                    break

            # 件名キーワードと一致するか確認
            # 「Re:」「Fw:」などの返信・転送プレフィックスがある場合は除外
            reply_prefix_pattern = re.compile(r'^(Re|Fwd?|FW|RE|転送)\s*:', re.IGNORECASE)
            if reply_prefix_pattern.match(subject):
                matched = False
            else:
                def subject_matches(subject, keyword):
                    # 【すまいステップ 反響通知メール】は前方一致（日付が後ろにつく場合があるため）
                    if keyword == "【すまいステップ 反響通知メール】":
                        return subject.startswith(keyword)
                    # その他は完全一致
                    return subject == keyword

                matched = any(subject_matches(subject, keyword) for keyword in SUBJECT_KEYWORDS)

            if matched:
                # 本文を取得
                body = decode_body(msg_detail["payload"])
                body_preview = body[:150].strip() if body else "（本文なし）"

                # URLを抽出
                urls = extract_urls(body)

                logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 新着メール検知！")
                logging.info(f"  件名: {subject}")
                if urls:
                    logging.info(f"  URL: {urls[0]}")

                # Windows通知を表示
                toaster.show_toast(
                    title=f"📧 {subject[:60]}",
                    msg=body_preview,
                    duration=8,
                    threaded=True
                )

                # URLがあれば自動でブラウザを開く
                if urls:
                    time.sleep(0.5)  # 通知表示を少し待つ
                    webbrowser.open(urls[0])
                    logging.info(f"  ブラウザで開きました: {urls[0]}")

                # イエウールの場合はDB即時転記を起動
                if subject == IEUL_SUBJECT:
                    logging.info("  [DB転記] イエウール検知 → ieul-transfer を非同期実行します")
                    trigger_ieul_transfer(body)
                # HOME4Uの場合はDB即時転記を起動
                elif any(subject_matches(subject, s) for s in HOME4U_SUBJECTS):
                    logging.info("  [DB転記] HOME4U検知 → home4u-transfer を非同期実行します")
                    trigger_home4u_transfer(body)

                # 通知済みとして記録（matchedの場合も必ず記録する）
                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)

            # HOME4Uは件名Re:でも本文に「HOME4Uログアウト」があれば必ず処理
            else:
                body = decode_body(msg_detail["payload"])
                if body and 'HOME4Uログアウト' in body:
                    logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 HOME4U本文検知（Re:スキップ回避）: {subject}")
                    trigger_home4u_transfer(body)

                # 通知済みとして記録
                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)

    except Exception as e:
        logging.info(f"[{datetime.now().strftime('%H:%M:%S')}] エラー: {e}")

    return notified_ids


def main():
    logging.info("=" * 50)
    logging.info("メール通知スクリプト 起動中...")
    logging.info(f"監視キーワード: {SUBJECT_KEYWORDS}")
    logging.info(f"チェック間隔: {CHECK_INTERVAL}秒")
    logging.info("=" * 50)

    logging.info("Gmailに接続中...")
    service = get_gmail_service()
    logging.info("接続成功！監視を開始します。\n")

    toaster = ToastNotifier()
    notified_ids = load_notified_ids()

    # 起動時点の全メール（既読・未読問わず）をスキップ登録
    # → 起動後に届いたメールだけ通知する
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
        logging.info(f"スキップ登録完了（合計 {len(notified_ids)} 件）。これ以降に届くメールを通知します。")
    except Exception as e:
        logging.info(f"スキップ処理エラー: {e}")

    logging.info("新着メールの監視を開始します...\n")

    while True:
        try:
            notified_ids = check_new_emails(service, toaster, notified_ids)
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            logging.info("\n停止しました。")
            break
        except Exception as e:
            logging.info(f"予期しないエラー: {e}")
            time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
