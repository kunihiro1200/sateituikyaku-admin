import re

# ===== CallModePage.tsx: 重複importを修正 =====
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 重複したimportを1つに
text = text.replace(
    "import PageNavigation from '../components/PageNavigation';\nimport PageNavigation from '../components/PageNavigation';",
    "import PageNavigation from '../components/PageNavigation';"
)

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
print('CallModePage.tsx: Fixed duplicate import')
