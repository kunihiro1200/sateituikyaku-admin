import re

with open('backend/src/services/BuyerCandidateService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# getAreaNumbersForProperty内のextractAreaNumbers呼び出しを、
# 丸数字のみ抽出するシンプルな処理に変更する
old_str = '''      // 1. distribution_areasフィールドから丸数字を抽出
      const distributionAreas = property.distribution_areas || property.distribution_area || '';
      if (distributionAreas) {
        const extracted = this.extractAreaNumbers(distributionAreas);
        extracted.forEach(num => areaNumbers.add(num));
      }'''

new_str = '''      // 1. distribution_areasフィールドから丸数字のみ抽出（数字→丸数字変換は行わない）
      const distributionAreas = property.distribution_areas || property.distribution_area || '';
      if (distributionAreas) {
        const extracted = distributionAreas.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯㊵㊶㊷㊸]/g) || [];
        extracted.forEach((num: string) => areaNumbers.add(num));
      }'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ distribution_areas抽出ロジックを修正しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用に周辺を表示
    idx = text.find('distribution_areasフィールドから丸数字を抽出')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-50:idx+300]))

with open('backend/src/services/BuyerCandidateService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
