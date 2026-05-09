import re

ts_path = r"C:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\utils\printHtmlGenerators.ts"

with open(ts_path, "rb") as f:
    content = f.read().decode("utf-8")

# 104行目あたりから始まる「偽のgeneratePage2Html（実はviewingPrep2の中身）」ブロックを削除する
# パターン：
#   // ============================================================\n// ページ2: 買付申込書\n// ===...
#   export function generatePage2Html(...) {
#     const priceStr = ...
#     const tdStyle = ...
#     const thStyle = ...
#     const rawName = ...   ← ここからviewingPrep2の中身
#     ...
#   }
# この偽ブロックだけを削除し、その後に来る正しいgeneratePage2Htmlは残す

# 偽ブロックの特徴：generatePage2Html の中に "const rawName = (buyer.name" が含まれている
# 正しいブロックの特徴：generatePage2Html の中に "return `<div" が含まれている

# 偽ブロックを正規表現で特定して削除
# 偽ブロック = "// ページ2" コメント + generatePage2Html宣言 + rawNameを含む中身 + 閉じ}
bad_block_pattern = (
    r'// ={60}\n// ページ2: 買付申込書\n// ={60}\n'
    r'export function generatePage2Html\(propertyAddress: string, propertyPrice: number \| null\): string \{'
    r'.*?'  # 中身（non-greedy）
    r'const rawName'  # 偽ブロックの特徴
    r'.*?'
    r'\n\}\n\n'  # 関数の閉じ
)

match = re.search(bad_block_pattern, content, re.DOTALL)
if match:
    print(f"Found bad block at {match.start()}:{match.end()}")
    print("Preview:", repr(content[match.start():match.start()+100]))
    new_content = content[:match.start()] + content[match.end():]
    with open(ts_path, "wb") as f:
        f.write(new_content.encode("utf-8"))
    print(f"Done! {len(content)} -> {len(new_content)} chars")
else:
    print("Pattern not found, trying alternative...")
    # 別アプローチ：generatePage2Html が2回出現する場合、1回目から2回目の直前まで削除
    idx1 = content.find("export function generatePage2Html(")
    idx2 = content.find("export function generatePage2Html(", idx1 + 1)
    if idx2 == -1:
        print("Only one generatePage2Html found - no duplicate")
    else:
        # idx1の前のコメントブロックも含めて削除
        comment_start = content.rfind("// ===", 0, idx1)
        print(f"Removing from {comment_start} to {idx2}")
        new_content = content[:comment_start] + content[idx2:]
        with open(ts_path, "wb") as f:
            f.write(new_content.encode("utf-8"))
        print(f"Done! {len(content)} -> {len(new_content)} chars")
