# -*- coding: utf-8 -*-
import urllib.request, json

body = """株式会社威風本店
ご担当者様

お世話になっております。
イエウール運営事務局でございます。

ユーザーより不動産査定依頼がございましたのでお知らせいたします。

詳細は下記URLでご確認ください。
https://partner.ieul.jp/detail/4791384

============================================================
■ 査定依頼情報
依頼日時　　　　: 2026-05-30 09:35:11
同時査定社数　　: 4
■ 不動産情報
物件種別　　　　: 分譲マンション
物件住所　　　　: 福岡県福岡市博多区銀天町３丁目6-29
マンション名　　: ヒューマインド南福岡
部屋番号　　　　: -
建物名　　　　　:
専有面積　　　　: 84.0平米(25.4坪)
建物面積　　　　:
土地面積　　　　:
延べ床面積　　　:
間取り　　　　　: 4LK / 4LDK
築年数　　　　　: 2014年(平成26年)
物件の状況　　　: 居住中
物件との関係　　: 物件の名義人です
■ ユーザ情報
氏名　　　　　　: 浦 満久
フリガナ　　　　: うらみつひさ
年齢　　　　　　: 44歳
住所　　　　　　: 福岡県福岡市博多区銀天町３丁目6-29ヒューマインド南福岡-
電話番号　　　　: 09075342245
Email　　　　　 : modsmitsu@gmail.com
希望連絡時間　　:  指定なし
査定理由　　　　: 価格によって売却を検討したいから（住み替え）
査定会社への要望:
買い替え有無　　:
査定方法　　　　:
コメント　　　　: 予想価格: 選択なし 周辺環境: 駅が徒歩10分以内、バス停が徒歩5分以内、コンビニが徒歩5分以内、スーパーが徒歩10分以内、夜間診療がある病院が近い、小学校が徒歩15分以内、中学校が徒歩15分以内、保育園・幼稚園が徒歩15分以内、公園が徒歩10分以内、警察署・交番が近くにある 住宅ローン残年数: 残り 〜20年 接面状況: 1つ以上の公道 買取査定: 希望しない 賃料査定: 希望する 「高く売った場合」と「早く売った場合」の査定額: 気になる 過去～将来の値動き: 気になる 査定額から税金を引いた手元に残る金額: 気になる マンションタイプ: 中高層マンション 建物構造: わからない
============================================================
今後とも、イエウールをどうぞ宜しくお願い致します。
イエウール運営事務局
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
