import subprocess

# 正常だったコミットからファイルを取得
result = subprocess.run(
    ['git', 'show', '2d7c7fe9:backend/src/utils/cityAreaMapping.ts'],
    capture_output=True,
    cwd=r'C:\Users\kunih\sateituikyaku-admin'
)

content = result.stdout.decode('utf-8')

# "新町" を "大分市新町" に変更（①の行のみ）
lines = content.split('\n')
new_lines = []
for line in lines:
    if '"①"' in line:
        line = line.replace('"新町"', '"大分市新町"')
    new_lines.append(line)

new_content = '\n'.join(new_lines)

# UTF-8で書き込む（BOMなし）
with open(r'C:\Users\kunih\sateituikyaku-admin\backend\src\utils\cityAreaMapping.ts', 'wb') as f:
    f.write(new_content.encode('utf-8'))

print('Done!')
# 確認
for line in new_content.split('\n'):
    if '"①"' in line:
        print('①行:', line[:120])
