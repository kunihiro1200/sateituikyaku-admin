import { supabase } from '../config/supabase';

export interface ImageComment {
  id: number;
  shared_item_id: string;
  image_number: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export class SharedItemImageCommentsService {
  /**
   * 共有アイテムの全画像コメントを取得
   */
  async getComments(sharedItemId: string): Promise<Record<number, string>> {
    try {
      const { data, error } = await supabase
        .from('shared_item_image_comments')
        .select('*')
        .eq('shared_item_id', sharedItemId)
        .order('image_number');

      if (error) {
        console.error('[SharedItemImageCommentsService] Error fetching comments:', error);
        return {};
      }

      // Record<number, string> 形式に変換
      const comments: Record<number, string> = {};
      if (data) {
        data.forEach((row: ImageComment) => {
          comments[row.image_number] = row.comment || '';
        });
      }

      return comments;
    } catch (error) {
      console.error('[SharedItemImageCommentsService] Unexpected error:', error);
      return {};
    }
  }

  /**
   * 画像コメントを保存・更新（UPSERT）
   */
  async saveComments(sharedItemId: string, comments: Record<number, string>): Promise<void> {
    try {
      const rows = Object.entries(comments).map(([imageNumber, comment]) => ({
        shared_item_id: sharedItemId,
        image_number: parseInt(imageNumber, 10),
        comment: comment || null,
        updated_at: new Date().toISOString(),
      }));

      // 空のコメントは削除、それ以外はUPSERT
      for (const row of rows) {
        if (!row.comment) {
          // 空の場合は削除
          await supabase
            .from('shared_item_image_comments')
            .delete()
            .eq('shared_item_id', sharedItemId)
            .eq('image_number', row.image_number);
        } else {
          // 値がある場合はUPSERT
          const { error } = await supabase
            .from('shared_item_image_comments')
            .upsert(row, {
              onConflict: 'shared_item_id,image_number',
            });

          if (error) {
            console.error('[SharedItemImageCommentsService] Error saving comment:', error);
            throw new Error(`Failed to save comment for image ${row.image_number}`);
          }
        }
      }
    } catch (error) {
      console.error('[SharedItemImageCommentsService] Unexpected error:', error);
      throw error;
    }
  }

  /**
   * 共有アイテム削除時に関連コメントも削除
   */
  async deleteComments(sharedItemId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('shared_item_image_comments')
        .delete()
        .eq('shared_item_id', sharedItemId);

      if (error) {
        console.error('[SharedItemImageCommentsService] Error deleting comments:', error);
        throw error;
      }
    } catch (error) {
      console.error('[SharedItemImageCommentsService] Unexpected error:', error);
      throw error;
    }
  }
}
