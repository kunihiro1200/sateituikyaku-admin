#!/usr/bin/env python3
# staff-debug エンドポイントを全件返すよう修正

with open('backend/src/routes/employees.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''    const sampleRows = rows.slice(0, 5).map((row: any) => ({
      イニシャル: row['イニシャル'],
      姓名: row['姓名'],
      電話番号: row['電話番号'],
      固定休: row['固定休'],
      メアド: row['メアド'],
      有効: row['有効'],
      事務あり: row['事務あり'],
      allKeys: Object.keys(row),
    }));
    res.json({ headers, sampleRows, totalRows: rows.length });'''

new = '''    const sampleRows = rows.map((row: any) => ({
      イニシャル: row['イニシャル'],
      姓名: row['姓名'],
      電話番号: row['電話番号'],
      固定休: row['固定休'],
      メアド: row['メアド'],
      有効: row['有効'],
      事務あり: row['事務あり'],
    }));
    res.json({ headers, sampleRows, totalRows: rows.length });'''

if old in text:
    text = text.replace(old, new)
    print('✅ staff-debug: 全件返すよう修正')
else:
    print('❌ 対象箇所が見つかりません')

with open('backend/src/routes/employees.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('employees.ts 書き込み完了')
