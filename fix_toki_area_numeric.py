with open('backend/src/services/TokiExtractService.ts', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# TokiKodateExtractResultのlandsにareaNumericを追加
old = """  // 土地情報（表題部：土地）複数対応
  lands: Array<{
    location: string | null;         // A91以降（所在）
    lotNumber: string | null;        // C91以降（地番）
    landType: string | null;         // D91以降（地目）
    area: string | null;             // E91以降（地積）
  }>;"""

new = """  // 土地情報（表題部：土地）複数対応
  lands: Array<{
    location: string | null;         // A91以降（所在）
    lotNumber: string | null;        // C91以降（地番）
    landType: string | null;         // D91以降（地目）
    area: string | null;             // E91以降（地積）
    areaNumeric: number | null;      // ソート用（書き込みには使わない）
  }>;"""

if old in text:
    text = text.replace(old, new)
    print('Fix applied: areaNumeric added to TokiKodateExtractResult.lands')
else:
    # パターンを探す
    idx = text.find('lands: Array<{')
    print(f'Pattern not found. First lands: Array<{{> at index {idx}')
    print(repr(text[idx:idx+200]))

with open('backend/src/services/TokiExtractService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
