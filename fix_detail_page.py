with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「報告」ボタンの前に「レインズ登録、サイト入力」ボタンを追加
old_str = """        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() => window.open(`/property-listings/${propertyNumber}/report`, '_blank')}"""

new_str = """        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => navigate(`/property-listings/${propertyNumber}/reins-registration`)}
            sx={{ borderColor: '#1565c0', color: '#1565c0', '&:hover': { borderColor: '#0d47a1', backgroundColor: '#1565c008' } }}
          >
            レインズ登録、サイト入力
          </Button>
          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() => window.open(`/property-listings/${propertyNumber}/report`, '_blank')}"""

text = text.replace(old_str, new_str)

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
