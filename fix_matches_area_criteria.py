import subprocess
import os

# BuyerService.tsを読み込んでmatchesAreaCriteriaを修正する
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
filepath = os.path.join(backend_dir, 'src', 'services', 'BuyerService.ts')

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧: matchesAreaCriteria（㊶対応なし）
old_method = """  private matchesAreaCriteria(buyer: any, propertyAreaNumbers: string[]): boolean {
    const desiredArea = (buyer.desired_area || '').trim();
    if (!desiredArea) return true;
    if (propertyAreaNumbers.length === 0) return false;
    const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);
    return propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
  }"""

# 新: ㊶（別府市全域）と㊸（別府市広域）の特別処理を追加
new_method = """  // 別府市エリア番号一覧（㊶別府市全域・㊸別府市広域の判定に使用）
  private readonly BEPPU_AREA_NUMBERS = ['\\u2468', '\\u2469', '\\u246A', '\\u246B', '\\u246C', '\\u246D', '\\u246E', '\\u32B7', '\\u32B8'];
  // ⑨=U+2468, ⑩=U+2469, ⑪=U+246A, ⑫=U+246B, ⑬=U+246C, ⑭=U+246D, ⑮=U+246E, ㊷=U+32B7, ㊸=U+32B8

  private matchesAreaCriteria(buyer: any, propertyAreaNumbers: string[]): boolean {
    const desiredArea = (buyer.desired_area || '').trim();
    if (!desiredArea) return true;
    if (propertyAreaNumbers.length === 0) return false;
    const buyerAreaNumbers = this.extractAreaNumbers(desiredArea);

    // ㊶（U+32B6）= 別府市全域: 物件が別府市エリア（⑨〜⑮㊷㊸）のいずれかであれば該当
    const BEPPU_ALL = '\\u32B6'; // ㊶
    if (buyerAreaNumbers.includes(BEPPU_ALL)) {
      const isBeppuProperty = propertyAreaNumbers.some(a => this.BEPPU_AREA_NUMBERS.includes(a));
      if (isBeppuProperty) return true;
    }

    // 通常のエリアマッチング
    return propertyAreaNumbers.some(area => buyerAreaNumbers.includes(area));
  }"""

if old_method in text:
    text = text.replace(old_method, new_method)
    print("OK: matchesAreaCriteria を修正しました")
else:
    print("ERROR: 対象文字列が見つかりません")
    # デバッグ用に前後を表示
    idx = text.find('matchesAreaCriteria')
    if idx >= 0:
        print("現在の実装:")
        print(text[idx:idx+400])

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done.")
