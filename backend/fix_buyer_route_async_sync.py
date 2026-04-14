#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
buyers.ts の PUT /:id ルートを修正する
- updateWithSync (setImmediate) の代わりに
  update (DB更新) → レスポンス → スプレッドシート同期 (非同期) の流れに変更
"""

import re

with open('backend/src/routes/buyers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正対象: updateWithSync を呼んでいるブロックを置き換える
old_block = """    // デフォルト：即時同期を使用（sync=true または sync未指定）
    console.log('[PUT /buyers/:id] Using updateWithSync (default or sync=true)');
    const result = await buyerService.updateWithSync(
      buyerNumber,
      sanitizedData,
      userId,
      userEmail,
      { force: force === 'true' }
    );

    // 🆕 キャッシュを無効化（サイドバーが即座に更新されるように）
    await invalidateBuyerStatusCache();
    console.log('[PUT /buyers/:id] Buyer status cache invalidated');

    // 競合がある場合は409を返す
    if (result.syncResult.conflict && result.syncResult.conflict.length > 0) {
      return res.status(409).json({
        error: 'Conflict detected',
        buyer: result.buyer,
        syncStatus: result.syncResult.syncStatus,
        conflicts: result.syncResult.conflict
      });
    }

    res.json({
      ...result.buyer,
      syncStatus: result.syncResult.syncStatus,
      syncError: result.syncResult.error
    });"""

new_block = """    // DB更新を先に実行してレスポンスを返す（スプレッドシート同期はバックグラウンドで実行）
    // Vercelサーバーレス環境ではsetImmediate/Promiseがレスポンス後に凍結されるため、
    // DB更新→即レスポンス→スプレッドシート同期（非同期）の順で処理する
    console.log('[PUT /buyers/:id] Using update (DB first, then async sync)');
    const updatedBuyer = await buyerService.update(buyerNumber, sanitizedData, userId, userEmail);
    console.log('[PUT /buyers/:id] DB update completed successfully');

    // 🆕 キャッシュを無効化（サイドバーが即座に更新されるように）
    await invalidateBuyerStatusCache();
    console.log('[PUT /buyers/:id] Buyer status cache invalidated');

    // レスポンスを即座に返す（スプレッドシート同期を待たない）
    res.json({
      ...updatedBuyer,
      syncStatus: 'pending',
    });

    // スプレッドシート同期をバックグラウンドで実行（レスポンス後）
    // awaitしないことでVercelサーバーレスでもレスポンスをブロックしない
    buyerService.updateWithSync(
      buyerNumber,
      sanitizedData,
      userId,
      userEmail,
      { force: force === 'true' }
    ).catch((syncError: any) => {
      console.error('[PUT /buyers/:id] Background sync error (non-fatal):', syncError.message);
    });"""

if old_block in text:
    text = text.replace(old_block, new_block)
    print('✓ PUT /:id route updated successfully')
else:
    print('✗ Target block not found - checking for partial match...')
    # 部分的に確認
    if 'updateWithSync' in text:
        print('  updateWithSync found in file')
    if 'Using updateWithSync' in text:
        print('  "Using updateWithSync" found')
    else:
        print('  "Using updateWithSync" NOT found')

with open('backend/src/routes/buyers.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
