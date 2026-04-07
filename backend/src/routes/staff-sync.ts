import { Router, Request, Response } from 'express';
import { StaffSyncService } from '../services/StaffSyncService';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * スタッフ管理シートからemployeesテーブルに同期
 * POST /api/staff-sync
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    console.log('[StaffSyncAPI] スタッフ同期リクエストを受信');
    
    const staffSyncService = new StaffSyncService();
    await staffSyncService.syncStaff();
    
    res.json({
      success: true,
      message: 'スタッフ同期が完了しました',
    });
  } catch (error) {
    console.error('[StaffSyncAPI] スタッフ同期エラー:', error);
    res.status(500).json({
      error: {
        code: 'STAFF_SYNC_ERROR',
        message: 'スタッフ同期に失敗しました',
        retryable: true,
      },
    });
  }
});

/**
 * 特定のスタッフを同期
 * POST /api/staff-sync/:initials
 */
router.post('/:initials', authenticate, async (req: Request, res: Response) => {
  try {
    const { initials } = req.params;
    console.log(`[StaffSyncAPI] スタッフ「${initials}」の同期リクエストを受信`);
    
    const staffSyncService = new StaffSyncService();
    await staffSyncService.syncSingleStaff(initials);
    
    res.json({
      success: true,
      message: `スタッフ「${initials}」の同期が完了しました`,
    });
  } catch (error) {
    console.error('[StaffSyncAPI] スタッフ同期エラー:', error);
    res.status(500).json({
      error: {
        code: 'STAFF_SYNC_ERROR',
        message: 'スタッフ同期に失敗しました',
        retryable: true,
      },
    });
  }
});

export default router;
