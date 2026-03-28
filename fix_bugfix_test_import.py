# BuyerStatusCalculator.bugfix.test.ts の vitest import を jest 用に修正する
# バックエンドは jest を使用しているため

with open('backend/src/services/__tests__/BuyerStatusCalculator.bugfix.test.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# vitest の import を jest 用に変更
# jest では describe, it, expect はグローバルに利用可能なため import 不要
old_import = "import { describe, it, expect } from 'vitest';"
new_import = "// jest では describe, it, expect はグローバルに利用可能"

text = text.replace(old_import, new_import)

# UTF-8 で書き込む（BOMなし）
with open('backend/src/services/__tests__/BuyerStatusCalculator.bugfix.test.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! vitest import を jest 用に変更しました。')
