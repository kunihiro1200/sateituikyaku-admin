import re

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
    # \b(\d+)\b で数字を抽出
    number_matches = re.findall(r'\b(\d+)\b', area_string)
    print(f"  数字マッチ: {number_matches}")
    for num_str in number_matches:
        num = int(num_str)
        c = number_to_circled(num)
        if c:
            print(f"  数字 {num} → 丸数字 {c}")
            circled.append(c)
    return list(set(circled))

# distribution_areasが空の場合（Step 1はスキップ）
# Step 2: 住所からエリア番号を取得
# getOitaCityAreasは住所文字列を使う（extractAreaNumbersは使わない）

# しかし、distribution_areasフィールドに何か入っている場合は extractAreaNumbers を使う
# distribution_areas = null → distributionAreas = '' → extractAreaNumbers('') → []

print("=== distribution_areas が空の場合 ===")
result = extract_area_numbers('')
print(f"結果: {result}")
print()

# もし distribution_areas に数字が含まれていたら？
print("=== distribution_areas に '5' が含まれていたら ===")
result = extract_area_numbers('5')
print(f"結果: {result}")
print()

print("=== distribution_areas に '④' が含まれていたら ===")
result = extract_area_numbers('④')
print(f"結果: {result}")
print()

# 実際のAPIレスポンスで distribution_areas が何になるか確認
# BuyerCandidateService.ts の getCandidatesForProperty:
# distribution_areas: propertyAreaNumbers.join('')
# propertyAreaNumbers = await this.getAreaNumbersForProperty(property)
# getAreaNumbersForProperty:
#   1. property.distribution_areas || property.distribution_area || '' → ''
#   2. address = '大分市大字迫1103番地の1'
#      → getOitaCityAreas('大分市大字迫1103番地の1') → ['④']
#      → areaNumbers.add('④')
#      → areaNumbers.add('㊵')
#   result = ['④', '㊵']
#   join → '④㊵'

print("=== 正しい計算結果 ===")
print("getAreaNumbersForProperty('大分市大字迫1103番地の1') → ['④', '㊵']")
print("join → '④㊵'")
print()

# ⑤が出る可能性: distribution_areas フィールドに '5' という文字列が入っている場合
# extractAreaNumbers('5') → ['⑤']
print("=== もし distribution_areas = '5' だったら ===")
result = extract_area_numbers('5')
print(f"結果: {result}")
print()

# または distribution_areas = '⑤' だったら
print("=== もし distribution_areas = '⑤' だったら ===")
result = extract_area_numbers('⑤')
print(f"結果: {result}")
