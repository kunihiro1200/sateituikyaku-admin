/**
 * 担当者イニシャルの正規化ユーティリティ。
 *
 * employees テーブルの initials / name をもとに、担当カラム（営担・査定担当・
 * 1番電話など）に入っている生の文字列を「現行イニシャル」に寄せる。
 *
 * - フルネーム（例: 国広智子）→ イニシャル（K）
 * - 全角英字 → 半角、小文字 → 大文字
 *
 * 既存の sellers.ts の buildNormalizeInitialMap と同一ロジックを共有化したもの。
 * ランキングAPIおよび営業会議「他決数推移」担当別集計APIで使う。
 */

export type NormalizeInitialFn = (raw: string) => string;

export interface EmployeeMaster {
  /** employees の現行イニシャル集合（正規化後の大文字/全角寄せ済み判定に使う） */
  initialSet: Set<string>;
  /** 生文字列 → 現行イニシャル への変換関数 */
  normalize: NormalizeInitialFn;
}

/**
 * employees テーブルから「名前→イニシャル」の正規化関数と現行イニシャル集合を構築する。
 * employees が取得できない場合は、trim だけする素通し関数を返す。
 */
export async function buildEmployeeMaster(supabase: any): Promise<EmployeeMaster> {
  try {
    const { data: employees } = await supabase
      .from('employees')
      .select('initials, name')
      .not('initials', 'is', null);

    // 名前→イニシャルのマップ（例: "国広智子" → "K"）
    const nameToInitial = new Map<string, string>();
    // イニシャルの正規化マップ（例: "ｗ" → "W", "k" → "K"）
    const normalizedInitials = new Map<string, string>();
    // 現行イニシャル集合（正規化後の値）
    const initialSet = new Set<string>();

    for (const emp of employees || []) {
      const initial: string = emp.initials ? String(emp.initials).trim() : '';
      const name: string = emp.name ? String(emp.name).trim() : '';
      if (!initial) continue;

      if (name) {
        nameToInitial.set(name, initial);
      }

      const halfWidth = initial.replace(/[Ａ-Ｚａ-ｚ]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
      const upper = halfWidth.toUpperCase();
      if (halfWidth !== initial) normalizedInitials.set(initial, upper);
      if (upper !== initial && upper !== halfWidth)
        normalizedInitials.set(halfWidth.toLowerCase(), upper);
      normalizedInitials.set(initial.toLowerCase(), upper);
      normalizedInitials.set(halfWidth, upper);
      normalizedInitials.set(upper, upper);

      initialSet.add(upper);
    }

    const normalize: NormalizeInitialFn = (raw: string): string => {
      const trimmed = (raw ?? '').trim();

      // 1. フルネーム→イニシャル
      if (nameToInitial.has(trimmed)) {
        return nameToInitial.get(trimmed)!;
      }

      // 2. 全角・小文字等の表記ゆれ正規化
      const halfWidth = trimmed.replace(/[Ａ-Ｚａ-ｚ]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
      const upper = halfWidth.toUpperCase();
      if (normalizedInitials.has(upper)) return normalizedInitials.get(upper)!;
      if (normalizedInitials.has(trimmed)) return normalizedInitials.get(trimmed)!;

      // 3. マッチしない場合は変換結果をそのまま返す（未知の値はそのまま）
      return upper || trimmed;
    };

    return { initialSet, normalize };
  } catch (err) {
    console.error('[buildEmployeeMaster] エラー:', err);
    return {
      initialSet: new Set<string>(),
      normalize: (raw: string) => (raw ?? '').trim(),
    };
  }
}
