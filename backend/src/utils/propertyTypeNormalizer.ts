/**
 * sellers.property_type / properties.property_type の表記揺れを正規化するユーティリティ。
 *
 * DB上は1文字表記（土/戸/マ/事/収）と日本語フルネーム（土地/戸建て/マンション等）が混在しており、
 * 既存の複数のサービスファイル（AutoSyncService.ts, EnhancedAutoSyncService.ts, ColumnMapper.ts等）に
 * 同じマッピングが重複実装されている。売却サポートページでは種別分岐（土地・戸建/マンション）が
 * 表示ロジックの根幹になるため、ここに一元化した判定関数を新設する。
 */

export type NormalizedPropertyType = 'land' | 'detached_house' | 'apartment' | 'other';

const TYPE_MAP: Record<string, NormalizedPropertyType> = {
  '土': 'land',
  '土地': 'land',
  '戸': 'detached_house',
  '戸建': 'detached_house',
  '戸建て': 'detached_house',
  'マ': 'apartment',
  'マンション': 'apartment',
  '事': 'other',
  '事業用': 'other',
  '収': 'other',
  '収益': 'other',
};

export function normalizePropertyType(raw: string | null | undefined): NormalizedPropertyType {
  if (!raw) return 'other';
  return TYPE_MAP[raw.trim()] ?? 'other';
}

export function isLandOrDetachedHouse(raw: string | null | undefined): boolean {
  const t = normalizePropertyType(raw);
  return t === 'land' || t === 'detached_house';
}

export function isApartment(raw: string | null | undefined): boolean {
  return normalizePropertyType(raw) === 'apartment';
}
