with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ヘッダーの左右ボックスの間に業者対応マークを中央に追加
# 左ボックスの終わり（</Box>）の後、右ボックス（<Box sx={{ display: 'flex', gap: 2 }}>）の前に挿入

old = """        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => window.open(`/property-listings/${propertyNumber}/reins-registration`, '_blank', 'noopener,noreferrer')}"""

new = """        </Box>

        {/* 業者対応マーク - ヘッダー中央 */}
        {data.broker_response && (() => {
          try {
            let brokerDateValue: any = data.broker_response;
            if (typeof brokerDateValue === 'number' || !isNaN(Number(brokerDateValue))) {
              const serialNumber = Number(brokerDateValue);
              const excelEpoch = new Date(1900, 0, 1);
              const daysOffset = serialNumber - 2;
              brokerDateValue = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            const now = new Date();
            const tokyoNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
            const tokyoToday = new Date(tokyoNow.getFullYear(), tokyoNow.getMonth(), tokyoNow.getDate());
            const brokerDate = new Date(brokerDateValue);
            const tokyoBrokerDate = new Date(brokerDate.getFullYear(), brokerDate.getMonth(), brokerDate.getDate());
            if (tokyoBrokerDate > tokyoToday) {
              const formattedDate = `${tokyoBrokerDate.getFullYear()}/${String(tokyoBrokerDate.getMonth() + 1).padStart(2, '0')}/${String(tokyoBrokerDate.getDate()).padStart(2, '0')}`;
              return (
                <Box
                  sx={{
                    px: 3,
                    py: 1,
                    background: '#ffeb3b',
                    borderRadius: 1,
                    border: '3px solid #d32f2f',
                    boxShadow: '0 0 20px rgba(244, 67, 54, 0.6)',
                    animation: 'blink 1.5s infinite, shake 0.5s infinite',
                    '@keyframes blink': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.8 },
                    },
                    '@keyframes shake': {
                      '0%, 100%': { transform: 'translateX(0)' },
                      '25%': { transform: 'translateX(-2px)' },
                      '75%': { transform: 'translateX(2px)' },
                    },
                  }}
                >
                  <Typography
                    sx={{
                      color: '#d32f2f',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      letterSpacing: '0.05em',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⚠️ 業者対応: {formattedDate} ⚠️
                  </Typography>
                </Box>
              );
            }
          } catch (e) {
            console.error('Failed to parse broker_response date:', e);
          }
          return null;
        })()}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => window.open(`/property-listings/${propertyNumber}/reins-registration`, '_blank', 'noopener,noreferrer')}"""

if old in text:
    text = text.replace(old, new, 1)
    print('業者対応マーク追加: OK')
else:
    print('ERROR: 対象箇所が見つかりません')
    idx = text.find('display: \'flex\', gap: 2')
    print(repr(text[idx-200:idx+200]))

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
