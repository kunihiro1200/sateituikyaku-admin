import re

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 問題の行を修正（改行が混入している箇所）
fixed = re.sub(
    r"\{ label: 'リフォーム予算', text: 'リフォーム込みの予算（最高額[\s\n]+）：' \}",
    "{ label: 'リフォーム予算', text: 'リフォーム込みの予算（最高額）：' }",
    content
)

if fixed == content:
    print('NO CHANGE - pattern not found')
else:
    with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'w', encoding='utf-8') as f:
        f.write(fixed)
    print('FIXED')
