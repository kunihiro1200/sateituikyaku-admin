file_path = r'frontend\frontend\src\components\NearbyBuyersList.tsx'

with open(file_path, 'rb') as f:
    content = f.read().decode('utf-8')

# 画面上の名前セル: 黒塗りスタイルを横棒スタイルに変更
old = """                      <Typography
                        variant="body2"
                        sx={isNameHidden ? {
                          backgroundColor: 'black',
                          color: 'black',
                          borderRadius: '2px',
                          userSelect: 'none',
                        } : {}}
                      >{buyer.name || '-'}</Typography>"""

new = """                      {isNameHidden ? (
                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                          <Typography variant="body2" sx={{ visibility: 'hidden', userSelect: 'none' }}>
                            {buyer.name || '-'}
                          </Typography>
                          <Box sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            height: '6px',
                            backgroundColor: 'black',
                            borderRadius: '1px',
                          }} />
                        </Box>
                      ) : (
                        <Typography variant="body2">{buyer.name || '-'}</Typography>
                      )}"""

content = content.replace(old, new)

with open(file_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print('Done!')
with open(file_path, 'rb') as f:
    print('BOM check:', repr(f.read(3)))
