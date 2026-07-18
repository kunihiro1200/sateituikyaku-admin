import urllib.request
import json

body = """株式会社威風 ご担当者様 お世話になっております。 イエウール運営事務局でございます。 ユーザーより不動産査定依頼がございましたのでお知らせいたします。 詳細は下記URLでご確認ください。 https://partner.ieul.jp/detail/4761562
============================================================
■ 査定依頼情報
依頼日時　　　　: 2026-05-18 10:37:57
同時査定社数　　: 1
■ 不動産情報
物件種別　　　　: 一戸建て
物件住所　　　　: 大分県大分市明野南２丁目20-4
マンション名　　: 
部屋番号　　　　: 
建物名　　　　　: 
専有面積　　　　: 
建物面積　　　　: 172.0平米(52.0坪)
土地面積　　　　: 272.0平米(82.3坪)
延べ床面積　　　: 
間取り　　　　　: 4LK / 4LDK
築年数　　　　　: 2002年(平成14年)
物件の状況　　　: 居住中
物件との関係　　: 物件の名義人です
■ ユーザ情報
氏名　　　　　　: 是松 マチ子
フリガナ　　　　: これまつまちこ
年齢　　　　　　: 69歳
住所　　　　　　: 大分県大分市明野南２丁目20-4
電話番号　　　　: 09087685872
Email 　　　　　: agano.rv.515@icloud.com
希望連絡時間　　:  指定なし
査定理由　　　　: 価格によって売却を検討したいから（資産整理）
査定会社への要望: 
買い替え有無　　: 
査定方法　　　　: 机上査定
コメント　　　　: 予想価格: 8,000万円~
============================================================
"""

payload = json.dumps({"body": body}).encode("utf-8")
req = urllib.request.Request(
    "https://sateituikyaku-admin-backend.vercel.app/api/sellers/ieul-transfer",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=",
    },
    method="POST",
)

with urllib.request.urlopen(req, timeout=120) as resp:
    result = json.loads(resp.read().decode("utf-8"))
    print(result)
