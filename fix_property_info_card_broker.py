#!/usr/bin/env python3
# PropertyInfoCardにbroker_response表示を追加するスクリプト

with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. PropertyFullDetailsインターフェースにbroker_responseを追加
old_interface = '''  pre_viewing_notes?: string; // 内覧前伝達事項（物件リストから取得）
}'''

new_interface = '''  pre_viewing_notes?: string; // 内覧前伝達事項（物件リストから取得）
  broker_response?: string; // 業者対応日付
}'''

if old_interface not in text:
    print('ERROR: Interface target not found')
    exit(1)

text = text.replace(old_interface, new_interface, 1)

# 2. Property Details の先頭（Grid container の最初の Grid item の前）に broker_response 表示を追加
# 「1行目: 物件番号 + atbb_status + 配信日」のコメントの直前に挿入
old_grid_start = '''        {/* 1行目: 物件番号 + atbb_status + 配信日 */}'''

new_grid_start = '''        {/* 業者対応日付（今日より後の場合のみ目立つ表示） */}
        {property.broker_response && (() => {
          try {
            let brokerDateValue: any = property.broker_response;

            // Excelシリアル値の場合は変換
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
                <Grid item xs={12}>
                  <Box
                    sx={{
                      px: 3,
                      py: 1.5,
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
                        fontSize: '1.3rem',
                        letterSpacing: '0.05em',
                        textAlign: 'center',
                      }}
                    >
                      ⚠️ 業者対応: {formattedDate} ⚠️
                    </Typography>
                  </Box>
                </Grid>
              );
            }
          } catch (error) {
            console.error('Failed to parse broker_response date:', error);
          }
          return null;
        })()}

        {/* 1行目: 物件番号 + atbb_status + 配信日 */}'''

if old_grid_start not in text:
    print('ERROR: Grid start target not found')
    exit(1)

text = text.replace(old_grid_start, new_grid_start, 1)

with open('frontend/frontend/src/components/PropertyInfoCard.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! broker_response display added to PropertyInfoCard.tsx')
