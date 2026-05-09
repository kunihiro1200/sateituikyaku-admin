import re

ts_path = r"C:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\utils\printHtmlGenerators.ts"

with open(ts_path, "rb") as f:
    content = f.read().decode("utf-8")

# 壊れた generatePage2Html の開始部分を修正
# "const priceStr = propertyPrice ? propert" + 混入コード を正しい内容に置換
bad_pattern = r"const priceStr = propertyPrice \? propert.*?export function generateViewingPrep2Html\(buyer: Record<string,unknown>, _today: string\): string \{"

# 正しい generatePage2Html の冒頭
correct_start = """const priceStr = propertyPrice ? propertyPrice.toLocaleString('ja-JP') : '';
  const tdStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;';
  const thStyle = 'border:1px solid #000;padding:4px 8px;font-size:9pt;width:140px;';"""

# dotallモードで置換
new_content = re.sub(bad_pattern, correct_start, content, flags=re.DOTALL)

if new_content == content:
    print("ERROR: pattern not found")
    # デバッグ：問題箇所を表示
    idx = content.find("const priceStr = propertyPrice ? propert")
    print(f"Found at idx={idx}")
    print(repr(content[idx:idx+200]))
else:
    with open(ts_path, "wb") as f:
        f.write(new_content.encode("utf-8"))
    print(f"Done! {len(content)} -> {len(new_content)} chars")
