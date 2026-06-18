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
from datetime import datetime, timezone

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
    # アットホーム反響メール（買主向け）- 部分一致で検知
    "【反響】アットホーム",
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
BACKEND_ATHOME_BUYER_TRANSFER_URL = os.environ.get(
    "BACKEND_ATHOME_BUYER_TRANSFER_URL",
    "https://sateituikyaku-admin-backend.vercel.app/api/buyers/athome-buyer-transfer"
)
BACKEND_LIFULL_TRANSFER_URL = os.environ.get(
    "BACKEND_LIFULL_TRANSFER_URL",
    "https://sateituikyaku-admin-backend.vercel.app/api/sellers/lifull-transfer"
)
HOME4U_SUBJECT_PREFIX = "[HOME4U] 査定依頼"
# HOME4Uは件名部分一致で検知（地域を問わず全て対応）
# ※本文に「HOME4Uログアウト」が含まれることが絶対条件（バックエンド側でもチェック）
ATHOME_BUYER_SUBJECT_PREFIX = "【反響】アットホーム"
# アットホーム反響メールは件名部分一致で検知（買主リストに転記）
LIFULL_SUBJECT_KEYWORD = "【LIFULL HOME'S】＜実名＞査定依頼がありました"
# LIFULL HOME'Sは件名完全一致で検知
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
NOTIFIED_IDS_FILE = os.path.join(SCRIPT_DIR, "notified_ids_server.json")
HOME4U_PROCESSED_THREADS_FILE = os.path.join(SCRIPT_DIR, "home4u_processed_threads.json")
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
            # サーバー環境では対話的認証不可 → アラートメールを送信して終了
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


def load_home4u_processed_threads():
    """HOME4U処理済みスレッドIDを読み込む（同一スレッドの重複転記防止）"""
    if os.path.exists(HOME4U_PROCESSED_THREADS_FILE):
        with open(HOME4U_PROCESSED_THREADS_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_home4u_processed_threads(thread_ids):
    """HOME4U処理済みスレッドIDを保存する（最新200件のみ保持）
    Railway環境ではエフェメラルストレージのためリセットされる場合があるが、
    バックエンド側のUNIQUE制約が最終防壁となるためベストエフォートで保存する。
    """
    try:
        ids_list = list(thread_ids)[-200:]
        with open(HOME4U_PROCESSED_THREADS_FILE, "w", encoding="utf-8") as f:
            json.dump(ids_list, f)
    except Exception as e:
        logging.warning(f"[HOME4U] 処理済みスレッドIDの保存失敗（無視）: {e}")


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
                # <br>, <br/>, <p>, <div>, <tr> タグを改行に変換（改行構造を保持するため）
                text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
                text = re.sub(r'</?p[^>]*>', '\n', text, flags=re.IGNORECASE)
                text = re.sub(r'</?div[^>]*>', '\n', text, flags=re.IGNORECASE)
                text = re.sub(r'</?tr[^>]*>', '\n', text, flags=re.IGNORECASE)
                text = re.sub(r'<td[^>]*>', ' ', text, flags=re.IGNORECASE)
                # 残りのHTMLタグを除去
                text = re.sub(r'<[^>]+>', '', text)
                # HTMLエンティティを変換
                text = text.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&#39;', "'").replace('&quot;', '"')
                # 連続する空行を2行以内に圧縮
                text = re.sub(r'\n{3,}', '\n\n', text)
                collected.append(text)
        elif mime.startswith("multipart/"):
            for sub in part.get("parts", []):
                extract_text_html(sub, collected)

    # まずtext/plainを試みる
    collected = []
    extract_text_plain(payload, collected)

    if collected:
        # Re:メールはスレッド内の全パートが収集されるため、
        # HOME4Uログアウトを含む最初のパートだけを使用する
        # （複数パートを結合すると同じ内容が重複して「コメントが段々増える」問題が発生）
        
        # HOME4Uログアウトを含むパートを優先して返す
        for part_text in collected:
            if 'HOME4Uログアウト' in part_text:
                return part_text
        
        # HOME4Uログアウトが含まれない場合は全パートを結合
        plain_text = "\n".join(collected)

        # text/plainが空白・改行のみの場合はtext/htmlにフォールバック
        if not plain_text.strip():
            logging.info("  [本文取得] text/plainが空白のみ→text/htmlにフォールバック")
            html_collected = []
            extract_text_html(payload, html_collected)
            if html_collected:
                return "\n".join(html_collected)
            return ""

        return plain_text

    # text/plainが空の場合はtext/htmlからフォールバック取得
    html_collected = []
    extract_text_html(payload, html_collected)
    if html_collected:
        logging.info("  [本文取得] text/plainが空のためtext/htmlから取得")
        html_text = "\n".join(html_collected)
        # HOME4Uログアウト周辺をデバッグ出力
        if 'HOME4Uログアウト' in html_text:
            lines = html_text.split('\n')
            for idx, line in enumerate(lines):
                if 'HOME4Uログアウト' in line:
                    surrounding = lines[max(0, idx-1):idx+8]
                    logging.info(f"  [HTML本文] HOME4Uログアウト周辺: {surrounding}")
                    break
        else:
            logging.info(f"  [HTML本文] HOME4Uログアウトが見つからない。先頭200文字: {repr(html_text[:200])}")
        return html_text

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
                    logging.info(f"  [DB転記] ⏭ スキップ（重複）: {result.get('message', 'HOME4Uログアウトなしまたは重複')}")
                elif result.get("success"):
                    logging.info(f"  [DB転記] ✅ 完了: {result.get('message', 'OK')} ({result.get('sellerNumber', '')})")
                else:
                    logging.info(f"  [DB転記] ❌ 失敗: {result.get('error', '不明なエラー')}")
        except Exception as e:
            logging.info(f"  [DB転記] ❌ エラー: {e}")

    threading.Thread(target=_call, daemon=True).start()


def trigger_athome_buyer_transfer(body: str):
    """アットホーム反響メール（買主向け）本文をバックエンドに送って買主リストに転記"""
    def _call():
        try:
            logging.info("  [DB転記] /api/buyers/athome-buyer-transfer 呼び出し開始...")
            payload = json.dumps({"body": body}).encode("utf-8")
            req = urllib.request.Request(
                BACKEND_ATHOME_BUYER_TRANSFER_URL,
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
                    logging.info(f"  [DB転記] ⏭ スキップ（重複）: {result.get('message', '')}")
                elif result.get("success"):
                    logging.info(f"  [DB転記] ✅ 買主リスト転記完了: {result.get('message', 'OK')} (買主番号: {result.get('buyerNumber', '')})")
                else:
                    logging.info(f"  [DB転記] ❌ 失敗: {result.get('error', '不明なエラー')}")
        except Exception as e:
            logging.info(f"  [DB転記] ❌ エラー: {e}")

    threading.Thread(target=_call, daemon=True).start()


def trigger_lifull_transfer(body: str):
    """LIFULL HOME'Sメール本文をバックエンドに送ってDB即時転記 + スプシ同期"""
    def _call():
        try:
            logging.info("  [DB転記] /api/sellers/lifull-transfer 呼び出し開始...")
            payload = json.dumps({"body": body}).encode("utf-8")
            req = urllib.request.Request(
                BACKEND_LIFULL_TRANSFER_URL,
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
                    logging.info(f"  [DB転記] ⏭ スキップ（重複）: {result.get('message', '')}")
                elif result.get("success"):
                    logging.info(f"  [DB転記] ✅ LIFULL転記完了: {result.get('message', 'OK')} ({result.get('sellerNumber', '')})")
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


def check_new_emails(service, notified_ids, start_timestamp_ms=None, home4u_processed_threads=None):
    """新着メールをチェックしてイエウールならDB転記する"""
    if home4u_processed_threads is None:
        home4u_processed_threads = set()
    try:
        results = service.users().messages().list(
            userId="me",
            q="newer_than:1d",
            maxResults=50
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

            # 起動時刻より前のメールはスキップ（再起動時の二重転記防止）
            # internalDateはget()レスポンスにのみ含まれる（list()には含まれない）
            if start_timestamp_ms is not None:
                msg_ts = int(msg_detail.get("internalDate", 0))
                if msg_ts < start_timestamp_ms:
                    notified_ids.add(msg_id)
                    continue

            headers = msg_detail["payload"]["headers"]
            subject = ""
            for header in headers:
                if header["name"] == "Subject":
                    subject = header["value"]
                    break

            reply_prefix_pattern = re.compile(r'^(Re|Fwd?|FW|RE|転送)\s*:', re.IGNORECASE)

            # HOME4Uの処理方針：
            # - 「Re: [HOME4U] 査定依頼」かつ送信者が自分（tenant@ifoo-oita.com）= スタッフがコメントを書いた返信メール → 転記する
            # - それ以外（HOME4U自身が送るRe:付きメール、Re:なし自動通知）→ スキップ
            is_reply = bool(reply_prefix_pattern.match(subject))
            
            # 送信者を取得
            sender = ""
            for header in headers:
                if header["name"] == "From":
                    sender = header["value"]
                    break
            is_from_self = "tenant@ifoo-oita.com" in sender

            # HOME4U以外のRe:/転送メールはスキップ
            if is_reply and HOME4U_SUBJECT_PREFIX not in subject and LIFULL_SUBJECT_KEYWORD not in subject:
                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)
                continue

            def subject_matches(subject, keyword):
                if keyword == "【すまいステップ 反響通知メール】":
                    return subject.startswith(keyword)
                if keyword == "[HOME4U] 査定依頼":
                    return keyword in subject
                if keyword == "【反響】アットホーム":
                    return keyword in subject  # 部分一致
                if keyword == "【LIFULL HOME'S】＜実名＞査定依頼がありました":
                    return keyword in subject  # 部分一致（Re:付きで届く場合があるため）
                return subject == keyword

            matched = any(subject_matches(subject, keyword) for keyword in SUBJECT_KEYWORDS)

            if matched:
                body = decode_body(msg_detail["payload"])
                logging.info(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔔 新着メール検知: {subject}")
                logging.info(f"  [本文先頭] {repr(body[:100])}")

                # イエウールのみDB転記
                if subject == IEUL_SUBJECT:
                    logging.info("  [DB転記] イエウール検知 → ieul-transfer を非同期実行します")
                    trigger_ieul_transfer(body)
                elif HOME4U_SUBJECT_PREFIX in subject:
                    # HOME4Uは「Re:」付き かつ 送信者が自分（tenant@ifoo-oita.com）のメールだけ転記する
                    # HOME4U自身も「Re:」付きで送ってくる場合があるため、送信者で判別する
                    if not is_reply or not is_from_self:
                        logging.info(f"  [スキップ] HOME4U: Re:なし または 自分以外からの送信 (sender={sender[:30]}): {subject[:50]}")
                    elif 'HOME4Uログアウト' in body:
                        # 同一スレッドの最新メールのみ転記する
                        # （スレッドに複数のRe:メールが蓄積されている場合、最新1通だけ処理）
                        thread_id = msg_detail.get("threadId", msg_id)
                        msg_ts = int(msg_detail.get("internalDate", 0))
                        # 同一スレッドの他のメールを確認して、これが最新かチェック
                        try:
                            thread_detail = service.users().threads().get(
                                userId="me", id=thread_id, format="metadata",
                                metadataHeaders=["Subject"]
                            ).execute()
                            thread_messages = thread_detail.get("messages", [])
                            # Re:付きHOME4Uメールの中で最新のinternalDateを取得
                            latest_ts = max(
                                int(m.get("internalDate", 0))
                                for m in thread_messages
                                if any(
                                    h["name"] == "Subject" and HOME4U_SUBJECT_PREFIX in h["value"]
                                    for h in m.get("payload", {}).get("headers", [])
                                )
                            ) if thread_messages else msg_ts
                            if msg_ts < latest_ts:
                                logging.info(f"  [スキップ] HOME4U Re:あり だが同スレッドに新しいメールあり（このメールは古い）")
                                notified_ids.add(msg_id)
                                save_notified_ids(notified_ids)
                                continue
                        except Exception as e:
                            logging.info(f"  [警告] スレッド確認失敗（処理継続）: {e}")
                        # 同一スレッドを2回転記しない（同じRe:メールが複数IDで返ってくる場合の対策）
                        if thread_id in home4u_processed_threads:
                            logging.info(f"  [スキップ] HOME4U: スレッド {thread_id[:16]}... は既に処理済み")
                        else:
                            home4u_processed_threads.add(thread_id)
                            save_home4u_processed_threads(home4u_processed_threads)
                            logging.info("  [DB転記] HOME4U(Re:あり)検知 → home4u-transfer を非同期実行します")
                            body_lines = body.replace('\r\n', '\n').replace('\r', '\n').split('\n')
                            for idx, line in enumerate(body_lines):
                                if 'HOME4Uログアウト' in line:
                                    surrounding = body_lines[max(0, idx-1):idx+6]
                                    logging.info(f"  [コメント確認] HOME4Uログアウト周辺: {surrounding}")
                                    break
                            trigger_home4u_transfer(body)
                    else:
                        logging.info(f"  [スキップ] HOME4Uだが本文に「HOME4Uログアウト」なし: {subject[:50]}")
                elif ATHOME_BUYER_SUBJECT_PREFIX in subject:
                    logging.info("  [DB転記] アットホーム反響（買主）検知 → athome-buyer-transfer を非同期実行します")
                    trigger_athome_buyer_transfer(body)
                elif LIFULL_SUBJECT_KEYWORD in subject:
                    # LIFULLは「Re:」付き かつ 送信者が自分（tenant@ifoo-oita.com）のメールだけ転記する
                    # LIFULL自身が送る元メール（Re:なし）はダブり防止のためスキップ
                    if not is_reply or not is_from_self:
                        logging.info(f"  [スキップ] LIFULL: Re:なし または 自分以外からの送信 (sender={sender[:30]}): {subject[:50]}")
                    else:
                        logging.info("  [DB転記] LIFULL HOME'S(Re:あり)検知 → lifull-transfer を非同期実行します")
                        trigger_lifull_transfer(body)
                else:
                    logging.info(f"  [スキップ] イエウール・HOME4U・アットホーム反響・LIFULL以外のため転記なし: {subject[:50]}")

                # 通知済みとして記録（matchedの場合も必ず記録する）
                notified_ids.add(msg_id)
                save_notified_ids(notified_ids)

            # matched=Falseの場合: HOME4U以外は何もしない
            # （HOME4UのRe:メールはsubject_matchesでmatched=Trueになるため、ここには来ない）
            else:
                if HOME4U_SUBJECT_PREFIX in subject:
                    # Re:なしHOME4Uがここに来るケースは通常ない（matched=Trueになるはず）
                    # 念のためスキップログだけ記録
                    logging.info(f"  [未処理] HOME4U件名だが件名マッチせず: {subject[:80]}")

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
    try:
        service = get_gmail_service()
    except RuntimeError as e:
        logging.error(f"起動失敗: {e}")
        sys.exit(1)
    logging.info("接続成功！監視を開始します。\n")
    # 起動時刻を記録（これより前のメールはcheck_new_emails内でスキップする）
    start_timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    logging.info(f"起動時刻タイムスタンプ: {start_timestamp_ms}（これより前のメールは処理しない）")

    # 過去の通知済みIDを読み込む（DB登録済みメールの二重転記防止）
    notified_ids = load_notified_ids()
    logging.info(f"通知済みID読み込み: {len(notified_ids)}件")

    # HOME4U処理済みスレッドIDを読み込む（同一案件の重複転記防止）
    home4u_processed_threads = load_home4u_processed_threads()
    logging.info(f"HOME4U処理済みスレッド読み込み: {len(home4u_processed_threads)}件")

    logging.info("新着メールの監視を開始します...\n")

    while True:
        try:
            notified_ids = check_new_emails(service, notified_ids, start_timestamp_ms, home4u_processed_threads)
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            logging.info("\n停止しました。")
            break
        except Exception as e:
            logging.error(f"予期しないエラー: {e}")
            time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
