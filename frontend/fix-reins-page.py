import re

filepath = 'frontend/src/pages/ReinsRegistrationPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. buildEmailBody関数のテンプレートを更新（suumoUrlを本文に埋め込む）
old_body = '''function buildEmailBody(sellerName: string, suumoUrl: string): string {
  return `${sellerName}様

お世話になっております。
株式会社いふうです。

本日、各サイトに正式に公開されましたので、レインズの登録証明書を送付いたします。
（全国に募集を公開している証明です）

【各サイトのご案内】
■athome
■SUUMO
${suumoUrl}

今後、当社全員で、お客様の大切な物件の販売に努めてまいります。
2週間に1度担当より、進捗状況をご報告させていただきます。

よろしくお願い申し上げます。

***************************
株式会社 いふう
〒870-0044
大分市舞鶴町1丁目3-30
TEL：097-533-2022
FAX：097-529-7160
HP：https://ifoo-oita.com/
店休日：毎週水曜日　年末年始、GW、盆
***************************`;
}'''

new_body = '''function buildEmailBody(sellerName: string, suumoUrl: string): string {
  const suumoLine = suumoUrl ? `■SUUMO\\n${suumoUrl}` : '■SUUMO';
  return `${sellerName}様

お世話になっております。
株式会社いふうです。

本日、各サイトに正式に公開されましたので、レインズの登録証明書を送付いたします。
（全国に募集を公開している証明です）

【各サイトのご案内】
■athome
${suumoLine}

今後、当社全員で、お客様の大切な物件の販売に努めてまいります。
2週間に1度担当より、進捗状況をご報告させていただきます。

よろしくお願い申し上げます。

***************************
株式会社 いふう
〒870-0044
大分市舞鶴町1丁目3-30
TEL：097-533-2022
FAX：097-529-7160
HP：https://ifoo-oita.com/
店休日：毎週水曜日　年末年始、GW、盆
***************************`;
}'''

# 2. handleFileSelectの構文エラーを修正
old_handler = ''' = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };'''

new_handler = '''  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };'''

if old_body in text:
    text = text.replace(old_body, new_body)
    print('✅ buildEmailBody updated')
else:
    print('❌ buildEmailBody not found - checking partial match...')
    # テンプレートリテラルの改行が問題の場合、別の方法で探す
    if 'function buildEmailBody' in text:
        print('  function exists but template mismatch')

if old_handler in text:
    text = text.replace(old_handler, new_handler)
    print('✅ handleFileSelect fixed')
else:
    print('❌ handleFileSelect pattern not found')
    # 別パターンを試す
    alt_old = '\n = (e: React.ChangeEvent<HTMLInputElement>) => {'
    if alt_old in text:
        text = text.replace(alt_old, '\n  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {')
        print('✅ handleFileSelect fixed (alt pattern)')
    else:
        print('  Searching for the broken line...')
        for i, line in enumerate(text.split('\n')):
            if '= (e: React.ChangeEvent' in line and 'const' not in line:
                print(f'  Found at line {i}: {repr(line)}')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
