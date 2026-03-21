with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """      // Phase 2: 更新同期（バックグラウンドで非同期実行してタイムアウトを回避）
      console.log('\\n🔄 Phase 2: Seller Update Sync (background)');
      // Vercelの60秒タイムアウトを回避するため、バックグラウンドで実行
      setImmediate(async () => {
        try {
          console.log('🔄 [Background] Starting Phase 2 update sync...');
          const updatedSellers = await this.detectUpdatedSellers();
          if (updatedSellers.length > 0) {
            const updateResult = await this.syncUpdatedSellers(updatedSellers);
            console.log(`✅ [Background] Phase 2 completed: ${updateResult.updatedSellersCount} updated`);
          } else {
            console.log('✅ [Background] No updated sellers to sync');
          }
        } catch (err: any) {
          console.error('❌ [Background] Phase 2 failed:', err.message);
        }
      });"""

new = """      // Phase 2: 更新同期（GASトリガー時はスキップ：全件比較が重いため）
      console.log('\\n⏭️  Phase 2: Seller Update Sync (Skipped for GAS trigger)');
      // 更新同期はVercelの定期同期（5分ごと）で実行される"""

if old in text:
    text = text.replace(old, new)
    with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ Reverted to original')
else:
    print('❌ Not found')
