"""
GmailDistributionButton.tsx の残存する DEFAULT_SENDER 参照を
getSenderByPropertyNumber(propertyNumber) に一括置換し、
FI物件の署名を「株式会社くじら不動産（株式会社いふう）」形式に変更する
ReinsRegistrationPage.tsx も同様に変更する
（非FI物件はいふうのまま変更なし）
"""

# ============================================================
# 1. GmailDistributionButton.tsx
# ============================================================
PATH1 = r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\components\GmailDistributionButton.tsx'

with open(PATH1, 'rb') as f:
    text = f.read().decode('utf-8')

# --- FI署名を「くじら不動産（いふう）」形式に変更 ---
OLD_SIG_KUJIRA = ('const SIGNATURE_KUJIRA = `\u3012810-0073\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u9db43-1-10\u30aa\u30d5\u30a3\u30b9\u30cb\u30e5\u30fc\u30ac\u30a4\u30a2\u30bb\u30ec\u30b9\u8d64\u5742\u9580No.19-201\n'
                  '\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\n'
                  'TEL:092-401-5331\n'
                  'Mail:tenant@ifoo-oita.com`;')

NEW_SIG_KUJIRA = ('const SIGNATURE_KUJIRA = `\u3012810-0073\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u9db43-1-10\u30aa\u30d5\u30a3\u30b9\u30cb\u30e5\u30fc\u30ac\u30a4\u30a2\u30bb\u30ec\u30b9\u8d64\u5742\u9580No.19-201\n'
                  '\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\uff08\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046\uff09\n'
                  'TEL:092-401-5331\n'
                  'Mail:tenant@ifoo-oita.com`;')

if OLD_SIG_KUJIRA in text:
    text = text.replace(OLD_SIG_KUJIRA, NEW_SIG_KUJIRA)
    print('SIGNATURE_KUJIRA updated OK')
else:
    # フォールバック: 直接文字列で検索
    import re
    old_str = 'const SIGNATURE_KUJIRA = `\u3012810-0073\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u9db43-1-10\u30aa\u30d5\u30a3\u30b9\u30cb\u30e5\u30fc\u30ac\u30a4\u30a2\u30bb\u30ec\u30b9\u8d64\u5742\u9580No.19-201\n\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\nTEL:092-401-5331\nMail:tenant@ifoo-oita.com`;'
    new_str = 'const SIGNATURE_KUJIRA = `\u3012810-0073\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u9db43-1-10\u30aa\u30d5\u30a3\u30b9\u30cb\u30e5\u30fc\u30ac\u30a4\u30a2\u30bb\u30ec\u30b9\u8d64\u5742\u9580No.19-201\n\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\uff08\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046\uff09\nTEL:092-401-5331\nMail:tenant@ifoo-oita.com`;'
    if old_str in text:
        text = text.replace(old_str, new_str)
        print('SIGNATURE_KUJIRA updated OK (fallback)')
    else:
        print('SIGNATURE_KUJIRA NOT FOUND - printing current KUJIRA lines:')
        for i, line in enumerate(text.split('\n')):
            if 'KUJIRA' in line or '\u304f\u3058\u3089' in line:
                print(f'  line {i+1}: {repr(line)}')

# --- DEFAULT_SENDER残存 → getSenderByPropertyNumber(propertyNumber) に一括置換 ---
old = 'setSenderAddress(DEFAULT_SENDER)'
new = 'setSenderAddress(getSenderByPropertyNumber(propertyNumber))'
count = text.count(old)
if count > 0:
    text = text.replace(old, new)
    print(f'setSenderAddress(DEFAULT_SENDER) replaced: {count} occurrences')
else:
    print('No remaining DEFAULT_SENDER references found')

with open(PATH1, 'wb') as f:
    f.write(text.encode('utf-8'))
print('GmailDistributionButton.tsx saved\n')

# ============================================================
# 2. ReinsRegistrationPage.tsx
# ============================================================
PATH2 = r'c:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\ReinsRegistrationPage.tsx'

with open(PATH2, 'rb') as f:
    text2 = f.read().decode('utf-8')

# FI署名を「くじら不動産（いふう）」形式に変更
old2 = 'const COMPANY_INFO_KUJIRA = `\u3012810-0073\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u9db43-1-10\u30aa\u30d5\u30a3\u30b9\u30cb\u30e5\u30fc\u30ac\u30a4\u30a2\u30bb\u30ec\u30b9\u8d64\u5742\u9580No.19-201\n\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\nTEL:092-401-5331\nMail:tenant@ifoo-oita.com`;'
new2 = 'const COMPANY_INFO_KUJIRA = `\u3012810-0073\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u9db43-1-10\u30aa\u30d5\u30a3\u30b9\u30cb\u30e5\u30fc\u30ac\u30a4\u30a2\u30bb\u30ec\u30b9\u8d64\u5742\u9580No.19-201\n\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\uff08\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046\uff09\nTEL:092-401-5331\nMail:tenant@ifoo-oita.com`;'
if old2 in text2:
    text2 = text2.replace(old2, new2)
    print('COMPANY_INFO_KUJIRA in ReinsRegistrationPage updated OK')
else:
    print('COMPANY_INFO_KUJIRA NOT FOUND in ReinsRegistrationPage')

# 本文の会社名「株式会社くじら不動産」→「株式会社くじら不動産（株式会社いふう）」
old3 = "  const companyName = isFI ? '\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523' : '\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046';"
new3 = "  const companyName = isFI ? '\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\uff08\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046\uff09' : '\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046';"
if old3 in text2:
    text2 = text2.replace(old3, new3)
    print('companyName in ReinsRegistrationPage updated OK')
else:
    print('companyName NOT FOUND in ReinsRegistrationPage')

# 件名も同様に更新
old4 = "          ? '\u30b5\u30a4\u30c8\u516c\u958b\uff06\u30ec\u30a4\u30f3\u30ba\u767b\u9332\u8a3c\u660e\u66f8\u306e\u3054\u6848\u5185\uff08\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\uff09'"
new4 = "          ? '\u30b5\u30a4\u30c8\u516c\u958b\uff06\u30ec\u30a4\u30f3\u30ba\u767b\u9332\u8a3c\u660e\u66f8\u306e\u3054\u6848\u5185\uff08\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523\uff08\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046\uff09\uff09'"
if old4 in text2:
    text2 = text2.replace(old4, new4)
    print('email subject in ReinsRegistrationPage updated OK')
else:
    print('email subject NOT FOUND in ReinsRegistrationPage')

with open(PATH2, 'wb') as f:
    f.write(text2.encode('utf-8'))
print('ReinsRegistrationPage.tsx saved\n')

print('=== All done ===')
