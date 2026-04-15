file_path = r'frontend\frontend\src\components\nearbyBuyersPrintUtils.ts'

with open(file_path, 'rb') as f:
    content = f.read().decode('utf-8')

# 名前セルのスタイルを変更
# 変更前: セル全体を黒塗り
old = "      <td style=\"border:1px solid #ccc; padding:4px; ${isNameHidden ? 'background-color:black;color:black;' : ''}\">\n        ${buyer.name || '-'}\n      </td>"

# 変更後: テキストの上に黒い太い横棒を重ねる（position:relativeのdivで囲み、::afterで棒を表示）
# HTMLではpseudo要素が使えないので、spanを2つ重ねる方式
new = """      <td style="border:1px solid #ccc; padding:4px;">
        ${isNameHidden
          ? `<span style="display:inline-block; position:relative; white-space:nowrap;">
               <span style="visibility:hidden;">${buyer.name || '-'}</span>
               <span style="position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); height:6px; background:black; display:block;"></span>
             </span>`
          : (buyer.name || '-')
        }
      </td>"""

content = content.replace(old, new)

with open(file_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')
with open(file_path, 'rb') as f:
    print('BOM check:', repr(f.read(3)))
