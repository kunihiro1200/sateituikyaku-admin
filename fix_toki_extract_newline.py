with open('backend/src/services/TokiExtractService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 改行を含む文字列リテラルを修正
# パターン: ' + 改行 + ' を '\n' に置換
import re

# ''\n'' のパターン（シングルクォートで囲まれた改行）を '\n' に置換
# mergedCoOwners = mergedCoOwners + '\n' + r.coOwners; のような形に修正
text = text.replace("mergedCoOwners + '\n' + r.coOwners", "mergedCoOwners + '\\n' + r.coOwners")
text = text.replace("differentOwners.join('\n')", "differentOwners.join('\\n')")
text = text.replace("mergedCoOwners + '\n' + additionalInfo", "mergedCoOwners + '\\n' + additionalInfo")

# 実際の改行を含む文字列リテラルを修正
# パターン: + '\n(改行)' + を + '\n' + に
import re

# シングルクォート内の実際の改行を \n に置換
def fix_string_literals(text):
    result = []
    i = 0
    while i < len(text):
        if text[i] == "'":
            # 文字列リテラルの開始
            j = i + 1
            string_content = ["'"]
            while j < len(text):
                if text[j] == '\\':
                    string_content.append(text[j])
                    string_content.append(text[j+1])
                    j += 2
                elif text[j] == "'":
                    string_content.append("'")
                    j += 1
                    break
                elif text[j] == '\n':
                    # 実際の改行を \n に置換
                    string_content.append('\\n')
                    j += 1
                else:
                    string_content.append(text[j])
                    j += 1
            result.append(''.join(string_content))
            i = j
        else:
            result.append(text[i])
            i += 1
    return ''.join(result)

text = fix_string_literals(text)

with open('backend/src/services/TokiExtractService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
