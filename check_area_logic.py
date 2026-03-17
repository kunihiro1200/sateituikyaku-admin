import re

OITA_CITY_AREA_MAP = {
    "①": ["大道町","要町","新町","末広町","太平町","田室町","西大道","東大道","王子北町","王子新町","王子中町","王子西町","王子町","王子港町","王子南町","王子山の手町","新春日町","勢家町","中春日町","西春日町","東春日町","南春日町","上春日町","季の坂","椎迫","志手","にじが丘","ほたるの杜団地","新川"],
    "②": ["新貝","新栄町","高城新町","高城本町","高松","高松東","花高松","原川","原新町","日岡","日吉町","松原町","向原沖","向原西","向原東","岡","岡新町","乙津港町","千歳","千歳団地","高城西町","高城南町","寺崎町","仲西町","三川上","三川下","三川新町","桃園団地","山津","山津町","小池原","下郡"],
    "③": ["久保山団地","新明治","横尾東町","パークヒルズ久保山","猪野","猪野南","葛木","森","横尾","法勝台","小池原","公園通り","京が丘","大津留","毛井","松岡"],
    "④": ["鶴崎コスモス団地","森","葛木","金谷","下徳丸","関園","常行","南","関門","迫","堂園","鶴瀬","丸亀","亀甲","上徳丸","つるさき陽光台","宮河内ハイランド","リバーサイド若葉台","種具","広内","宮河内","杵河内","迫阿蘇入","新田","浄土寺","宮谷"],
    "⑥": ["賀来北","賀来西","賀来南","国分新町","国分台","国分団地","東野台","賀来","国分","東院","中尾","カームタウン野田","野田","森ノ木","脇","宮苑","平横瀬","餅田"],
    "⑦": ["今市","石合","一本櫟","今市町","上石合","白家","摺","練ケ迫","山中","入蔵","吉熊","日方羽原","太田","田ノ口","原村","上詰","湛水","沢田","下原","高原","竹矢","辻原","荷尾杵","野津原","福宗","廻栖野","田尻","ふじが丘","富士見が丘"],
    "⑧": ["安藤","河原内","竹中","端登"],
}

address = "大分市大字迫1103番地の1"
print(f"住所: {address}")
print()

# getOitaCityAreas のシミュレーション
matched = set()
for area_num, towns in OITA_CITY_AREA_MAP.items():
    for town in towns:
        if town in address:
            matched.add(area_num)
            print(f"  マッチ: {area_num} - 町名: '{town}'")
            break

print(f"getOitaCityAreas結果: {list(matched)}")
final = list(matched) + ["㊵"]
print(f"最終エリア番号: {final}")
print(f"join結果: {''.join(final)}")
print()

# ⑤が出る可能性を調査
print("=== ⑤が出る可能性の調査 ===")
print()

# extractAreaNumbers のシミュレーション
def number_to_circled(num):
    if 1 <= num <= 20:
        return chr(0x2460 + num - 1)
    if 21 <= num <= 35:
        return chr(0x3251 + num - 21)
    if 36 <= num <= 50:
        return chr(0x32B1 + num - 36)
    return None

def extract_area_numbers(area_string):
    circled = re.findall(r'[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶]', area_string)
    number_matches = re.findall(r'\b(\d+)\b', area_string)
    for num_str in number_matches:
        num = int(num_str)
        c = number_to_circled(num)
        if c:
            circled.append(c)
    return list(set(circled))

# distribution_areasが空の場合
distribution_areas = ""
print(f"distribution_areas: '{distribution_areas}'")
extracted = extract_area_numbers(distribution_areas)
print(f"extractAreaNumbers結果: {extracted}")
print()

# ⑤の文字コード確認
print(f"⑤ の文字コード: U+{ord('⑤'):04X}")
print(f"④ の文字コード: U+{ord('④'):04X}")
print(f"⑥ の文字コード: U+{ord('⑥'):04X}")
print()

# 「南」が④にマッチする問題
print("=== 「南」が④にマッチする問題 ===")
test_addresses = [
    "大分市大字迫1103番地の1",
    "大分市南1-1-1",
    "大分市関門1-1",
]
for addr in test_addresses:
    m = set()
    for area_num, towns in OITA_CITY_AREA_MAP.items():
        for town in towns:
            if town in addr:
                m.add(area_num)
                print(f"  '{addr}' → {area_num} ('{town}'にマッチ)")
    if not m:
        print(f"  '{addr}' → マッチなし")
