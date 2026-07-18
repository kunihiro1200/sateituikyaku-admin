# -*- coding: utf-8 -*-
import urllib.request, json

# 実際のメール本文（改行あり）
body = """HOME4Uログアウト
K対応
査定依頼 株式会社威風 担当者様 HOME4Uをご利用いただきありがとうございます。 貴社への査定依頼がございましたのでお知らせいたします。 【 査定依頼 -- <福岡県> 福岡市西区 】 ■査定ナンバー　　　　　: SA2605-8195678 ■ご依頼日　　　　　　　: 2026/05/30 (土) 06:07:14 ----------------------------------------------------------------- ■査定方法　　　　　　　: 簡易査定 ----------------------------------------------------------------- ■物件種別　　　　　　　: 一戸建て ■物件名称　　　　　　　: ■階数（棟物の場合記載）: ■戸数（棟物の場合記載）: ■土地面積　　　　　　　: 198 平米 ■建物（専有）面積　　　: 142 平米 ■間取り　　　　　　　　: 4LK/4LDK ■物件所在地　　　　　　: 福岡県福岡市西区田尻2丁目4-20 ■築年（西暦）　　　　　: 2022 年 ■現況　　　　　　　　　: 居住中 ■名義　　　　　　　　　: 本人所有 ----------------------------------------------------------------- ■フリガナ　　　　　　　: フクシマ　ユウタ ■お名前　　　　　　　　: 福嶋　悠太 ■年齢　　　　　　　　　: 33 歳 ■ご住所　　　　　　　　: 　　　　　　　　　　　　: 福岡県福岡市西区田尻2丁目4-20 ■電話番号　　　　　　　: 09079805794 ■第二電話番号（任意）　: ■E-mail　　　　　　　　: sa.hajimeyoka@docomo.ne.jp ■査定の理由　　　　　　: 住み替え ■売却の希望時期　　　　: ■要望・質問（自由記入）: ----------------------------------------------------------------- ▼ 簡易査定の作成支援サービスです。是非ご活用ください。 ▼ 株式会社NTTデータ・ウィズ"""

print(f"改行数: {body.count(chr(10))}")

payload = json.dumps({"body": body}).encode("utf-8")
req = urllib.request.Request(
    "https://sateituikyaku-admin-backend.vercel.app/api/sellers/home4u-transfer",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        print(json.dumps(result, ensure_ascii=False, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} {e.reason}")
    body_err = e.read().decode("utf-8", errors="ignore")
    print(f"Response body: {body_err}")
except Exception as e:
    print(f"Error: {e}")
