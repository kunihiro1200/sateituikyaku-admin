with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# DialogをMUIのimportに追加
old = "  Link,\n} from '@mui/material';"
new = "  Link,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n} from '@mui/material';"
text = text.replace(old, new)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
