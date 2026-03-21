with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """      // Phase 2: 更新同期（GASトリガー時はスキップ：全件比較が重いため）
      console.log('\\n⏭️  Phase 2: Seller Update Sync (Skipped for GAS trigger)');
      // 更新同期はVercelの定期同期（5分ごと）で実行される"""

new = """      // Phase 2: 更新同期
      console.log('\\n🔄 Phase 2: Seller Update Sync');
      const updatedSellers = await this.detectUpdatedSellers();
      if (updatedSellers.length > 0) {
        const updateResult = await this.syncUpdatedSellers(updatedSellers);
        updated = updateResult.updatedSellersCount;
        errors.push(...updateResult.errors);
      } else {
        console.log('✅ No updated sellers to sync');
      }"""

if old in text:
    text = text.replace(old, new)
    with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ Phase 2 enabled in runSellersOnlySync')
else:
    print('❌ Target string not found')
    # デバッグ用に前後を表示
    idx = text.find('Phase 2: Seller Update Sync')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(text[idx-50:idx+200]))
    else:
        print('Phase 2 string not found at all')
