import { supabase } from '../config/supabase';

export interface SharedItemImage {
  id: number;
  shared_item_id: string;
  image_number: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export class SharedItemImagesService {
  /**
   * 共有アイテムの画像5〜10を取得
   */
  async getImages(sharedItemId: string): Promise<Record<number, string>> {
    try {
      const { data, error } = await supabase
        .from('shared_item_images')
        .select('*')
        .eq('shared_item_id', sharedItemId)
        .gte('image_number', 5)
        .lte('image_number', 10)
        .order('image_number');

      if (error) {
        console.error('[SharedItemImagesService] Error fetching images:', error);
        return {};
      }

      // Record<number, string> 形式に変換
      const images: Record<number, string> = {};
      if (data) {
        data.forEach((row: SharedItemImage) => {
          images[row.image_number] = row.image_url;
        });
      }

      return images;
    } catch (error) {
      console.error('[SharedItemImagesService] Unexpected error:', error);
      return {};
    }
  }

  /**
   * 画像5〜10を保存・更新（UPSERT）
   */
  async saveImages(sharedItemId: string, images: Record<number, string>): Promise<void> {
    try {
      // 画像5〜10のみ処理
      const filteredImages = Object.entries(images).filter(([num]) => {
        const imageNum = parseInt(num, 10);
        return imageNum >= 5 && imageNum <= 10;
      });

      for (const [imageNumber, imageUrl] of filteredImages) {
        const imageNum = parseInt(imageNumber, 10);
        
        if (!imageUrl) {
          // 空の場合は削除
          await supabase
            .from('shared_item_images')
            .delete()
            .eq('shared_item_id', sharedItemId)
            .eq('image_number', imageNum);
        } else {
          // 値がある場合はUPSERT
          const { error } = await supabase
            .from('shared_item_images')
            .upsert({
              shared_item_id: sharedItemId,
              image_number: imageNum,
              image_url: imageUrl,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'shared_item_id,image_number',
            });

          if (error) {
            console.error('[SharedItemImagesService] Error saving image:', error);
            throw new Error(`Failed to save image ${imageNum}`);
          }
        }
      }
    } catch (error) {
      console.error('[SharedItemImagesService] Unexpected error:', error);
      throw error;
    }
  }

  /**
   * 共有アイテム削除時に関連画像も削除
   */
  async deleteImages(sharedItemId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('shared_item_images')
        .delete()
        .eq('shared_item_id', sharedItemId);

      if (error) {
        console.error('[SharedItemImagesService] Error deleting images:', error);
        throw error;
      }
    } catch (error) {
      console.error('[SharedItemImagesService] Unexpected error:', error);
      throw error;
    }
  }
}
