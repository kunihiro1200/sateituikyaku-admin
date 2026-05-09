with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 勤続年数行を修正：4列を正しく配置
# 他の行はcolspan=2で2列構成なので、勤続年数行も合計幅が同じになるよう調整
old_row = '''      <tr>
        <td style="${thStyle}">勤続年数</td>
        <td style="${tdStyle}"></td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:80px;">年収</td>
        <td style="${tdStyle}"></td>
      </tr>'''

new_row = '''      <tr>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:140px;">勤続年数</td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;"></td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:80px;">年収</td>
        <td style="border:1px solid #000;padding:4px 8px;font-size:9pt;width:120px;"></td>
      </tr>'''

content = content.replace(old_row, new_row)

# 他の行もcolspan=4に対応するためcolspan="2"をcolspan="4"に変更
content = content.replace(
    '<tr><td colspan="2" style="${tdStyle}">□借家　□持ち家（売却ご予定　ある・なし）</td></tr>',
    '<tr><td colspan="4" style="${tdStyle}">□借家　□持ち家（売却ご予定　ある・なし）</td></tr>'
)

# 他の行（2列）をcolspan="3"で残り3列を結合
for label in ['住所', '連絡先電話番号', 'メールアドレス', '契約名義人氏名', '勤務先']:
    old = f'<tr><td style="${{thStyle}}">{label}</td><td style="${{tdStyle}}"></td></tr>'
    new = f'<tr><td style="${{thStyle}}">{label}</td><td colspan="3" style="${{tdStyle}}"></td></tr>'
    content = content.replace(old, new)

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
