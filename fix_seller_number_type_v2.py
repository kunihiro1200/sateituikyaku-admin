# -*- coding: utf-8 -*-
"""
gas_complete_code.jsのrowToObject関数を修正
売主番号を必ず文字列型に変換する
"""

with open('gas_complete_code.js', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード（正確な位置を特定）
old_code = """    } else {
      obj[headerName] = val;
    }
  }
  return obj;
}

function postToBackend(path, payload) {"""

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
}

function postToBackend(path, payload) {"""

# 置換
if old_code in text:
    text = text.replace(old_code, new_code)
    print('✅ 修正完了: rowToObject関数で売主番号を必ず文字列型に変換')
else:
    print('❌ エラー: 置換対象のコードが見つかりません')
    print('デバッグ: 該当箇所を探します...')
    # デバッグ用に該当箇所を探す
    if 'obj[headerName] = val;' in text:
        print('✅ obj[headerName] = val; は存在します')
    if 'return obj;' in text:
        print('✅ return obj; は存在します')

# UTF-8で書き込む（BOMなし）
with open('gas_complete_code.js', 'wb') as f:
    f.write(text.encode('utf-8'))

print('📝 gas_complete_code.jsをGASスクリプトエディタにコピペしてください')
