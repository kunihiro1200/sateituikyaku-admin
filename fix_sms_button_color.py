with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# SMSボタンの色を暗い色に変更（Emailより優先度低を視覚的に表現）
text = text.replace(
    "backgroundColor: '#e65100',\n                      color: '#fff',\n                      fontWeight: 'bold',\n                      '&:hover': { backgroundColor: '#bf360c' },\n                      animation: 'preDayPulse 1.5s ease-in-out infinite',\n                      '@keyframes preDayPulse': {\n                        '0%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0.6)' },\n                        '70%': { boxShadow: '0 0 0 10px rgba(230, 81, 0, 0)' },\n                        '100%': { boxShadow: '0 0 0 0 rgba(230, 81, 0, 0)' },\n                      },",
    "backgroundColor: '#546e7a',\n                      color: '#fff',\n                      fontWeight: 'bold',\n                      '&:hover': { backgroundColor: '#37474f' },\n                      animation: 'smsPulse 1.5s ease-in-out infinite',\n                      '@keyframes smsPulse': {\n                        '0%': { boxShadow: '0 0 0 0 rgba(84, 110, 122, 0.6)' },\n                        '70%': { boxShadow: '0 0 0 10px rgba(84, 110, 122, 0)' },\n                        '100%': { boxShadow: '0 0 0 0 rgba(84, 110, 122, 0)' },\n                      },"
)

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
