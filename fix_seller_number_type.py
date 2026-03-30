# -*- coding: utf-8 -*-
"""
gas_complete_code.jsのrowToObject関数を修正
売主番号を必ず文字列型に変換する
"""

with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード
old_code = """    } else {
      obj[headerName] = val;
    }
  }
  return obj;
}"""

# 修正後のコード（売主番号は必ず文字列型に変換）
new_code = """    } else {
      // 売主番号は必ず文字列型に変換（数値型のまま保持すると、別のGASで文字列連結バグが発生する）
      if (headerName === '売主番号' && val !== null && val !== undefined && val !== '') {
        obj[headerName] = String(val);
      } else {
        obj[headerName] = val;
      }
    }
  }
  return obj;
}"""

# 置換
text = text.replace(old_code, new_code)

# UTF-8で書き込む（BOMなし）
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了: rowToObject関数で売主番号を必ず文字列型に変換')
print('📝 gas_complete_code.jsをGASスクリプトエディタにコピペしてください')
