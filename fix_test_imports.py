import re

files = [
    'frontend/frontend/src/pages/__tests__/CallModePage.email-area-bug.test.ts',
    'frontend/frontend/src/pages/__tests__/CallModePage.email-area-preservation.test.ts',
]

for filepath in files:
    with open(filepath, 'rb') as f:
        content = f.read().decode('utf-8')
    
    content = content.replace(
        "import { describe, test, expect } from '@jest/globals';",
        "import { describe, test, expect } from 'vitest';"
    )
    
    with open(filepath, 'wb') as f:
        f.write(content.encode('utf-8'))
    
    print(f'Fixed: {filepath}')

print('Done')
