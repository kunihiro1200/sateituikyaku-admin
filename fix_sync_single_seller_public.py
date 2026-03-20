with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read().decode('utf-8')

content = content.replace(
    '  private async syncSingleSeller(sellerNumber: string, row: any): Promise<void> {',
    '  public async syncSingleSeller(sellerNumber: string, row: any): Promise<void> {'
)

with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(content.encode('utf-8'))

print('✅ syncSingleSeller -> public')
