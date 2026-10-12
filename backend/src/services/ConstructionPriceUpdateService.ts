/**
 * ConstructionPriceUpdateService
 *
 * e-Stat API から取得した建築単価を `construction_unit_prices` テーブルに
 * 「更新候補」として保存し、管理者が承認後に本番査定に反映するフローを管理する。
 *
 * ─ フロー ─────────────────────────────────────────────────────────────────
 * 1. e-Stat API からデータ取得       → EStatBuildingStatsService
 * 2. 既存承認済み単価との比較        → buildCandidates()
 * 3. 検証（単位・構造区分・異常値）  → validateCandidates()
 * 4. Supabase に estat_price 保存   → saveCandidates()
 *    ・is_approved=false で登録 → 管理者の承認待ち
 *    ・既存の price_per_sqm は変更しない
 * 5. 管理者が承認 → approveCandidate() → price_per_sqm を更新
 *
 * ─ 軽量鉄骨の扱い ─────────────────────────────────────────────────────────
 * e-Stat に独立した区分なし。鉄骨造単価に係数を適用して推計。
 * 係数は DB の construction_unit_prices.coefficient で管理。
 * 現行デフォルト: 1.0（NTA の暗黙的扱いと同じ）
 */

import { BaseRepository } from '../repositories/BaseRepository';
import {
  EStatBuildingStatsService,
  EStatYearlyResult,
} from './EStatBuildingStatsService';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

/** DB 上の構造名 */
export type StructureName =
  | '木造'
  | '軽量鉄骨'
  | '鉄骨'
  | '鉄筋コンクリート'
  | '鉄骨鉄筋コンクリート';

/** 更新候補の1件 */
export interface UpdateCandidate {
  year: number;
  structure: StructureName;
  estatPrice: number;           // e-Stat 算出単価 [円/m²]
  ntaPrice: number | null;      // 国税庁公表値（DB に保存済みの場合）
  currentPrice: number | null;  // 現在の承認済み単価
  priceDiff: number | null;     // estatPrice - currentPrice
  pctChange: number | null;     // 変動率 [%]
  isLightSteelEstimate: boolean; // 軽量鉄骨の推計値フラグ
  coefficient: number | null;   // 軽量鉄骨に適用した係数
  validationWarnings: string[];  // 異常値・検証警告
}

/** fetch + save の結果サマリー */
export interface FetchResult {
  year: number;
  fetchedAt: Date;
  availableYears: number[];
  candidates: UpdateCandidate[];
  savedCount: number;
  validationWarnings: string[];
}

// ─── e-Stat → DB 構造名マッピング ────────────────────────────────────────────
const ESTAT_TO_DB: Record<string, StructureName> = {
  木造: '木造',
  RC:   '鉄筋コンクリート',
  SRC:  '鉄骨鉄筋コンクリート',
  鉄骨: '鉄骨',
};

// ─── サービスクラス ───────────────────────────────────────────────────────────

export class ConstructionPriceUpdateService extends BaseRepository {
  private readonly estatService: EStatBuildingStatsService;

  constructor() {
    super();
    this.estatService = new EStatBuildingStatsService();
  }

  /**
   * 指定年度の e-Stat データを取得し、更新候補として DB に保存する。
   *
   * price_per_sqm は変更しない（承認されるまで查定には影響しない）。
   * estat_price カラムにデータを書き込み、is_approved=false で登録する。
   */
  async fetchAndSaveCandidates(year: number): Promise<FetchResult> {
    // ─── 1. e-Stat から取得 ─────────────────────────────────────────
    const estatData = await this.estatService.fetchYearlyData(year, 'all');

    // ─── 2. 既存承認済み単価を取得 ──────────────────────────────────
    const { data: existingRows } = await this.table('construction_unit_prices')
      .select('year, structure, price_per_sqm, nta_price, coefficient')
      .eq('year', year)
      .eq('is_approved', true);

    const existingMap = new Map<string, { price: number; ntaPrice: number | null; coefficient: number | null }>(
      (existingRows ?? []).map(r => [r.structure, {
        price:       r.price_per_sqm,
        ntaPrice:    r.nta_price,
        coefficient: r.coefficient ?? null,
      }])
    );

    // ─── 3. 更新候補を生成 ──────────────────────────────────────────
    const candidates = this.buildCandidates(estatData, existingMap);
    const validationWarnings = this.validateCandidates(candidates);

    // ─── 4. Supabase に保存（upsert: estat_price のみ更新） ─────────
    const savedCount = await this.saveCandidates(year, candidates, estatData.fetchedAt);

    return {
      year,
      fetchedAt:          estatData.fetchedAt,
      availableYears:     estatData.availableYears,
      candidates,
      savedCount,
      validationWarnings,
    };
  }

  /**
   * 更新候補のリストを生成（5構造分）
   */
  private buildCandidates(
    estatData: EStatYearlyResult,
    existingMap: Map<string, { price: number; ntaPrice: number | null; coefficient: number | null }>,
  ): UpdateCandidate[] {
    const candidates: UpdateCandidate[] = [];

    // 4構造（e-Stat直接取得）
    const directStructures: Array<[string, StructureName]> = [
      ['木造', '木造'],
      ['RC',   '鉄筋コンクリート'],
      ['SRC',  '鉄骨鉄筋コンクリート'],
      ['鉄骨', '鉄骨'],
    ];
    for (const [estatKey, dbName] of directStructures) {
      const estatPrice = estatData.structures[estatKey as keyof typeof estatData.structures].unitPrice_yen_per_m2;
      const existing   = existingMap.get(dbName);
      const currentPrice = existing?.price ?? null;
      const priceDiff    = currentPrice !== null ? estatPrice - currentPrice : null;
      const pctChange    = priceDiff !== null && currentPrice !== null
        ? Math.round((priceDiff / currentPrice) * 1000) / 10
        : null;
      const warnings: string[] = [];
      if (estatPrice === 0) warnings.push('単価が0円: データ欠損の可能性');
      if (pctChange !== null && Math.abs(pctChange) > 30) {
        warnings.push(`前年比 ${pctChange > 0 ? '+' : ''}${pctChange}% の大幅変動`);
      }
      candidates.push({
        year:                 estatData.year,
        structure:            dbName,
        estatPrice,
        ntaPrice:             existing?.ntaPrice ?? null,
        currentPrice,
        priceDiff,
        pctChange,
        isLightSteelEstimate: false,
        coefficient:          null,
        validationWarnings:   warnings,
      });
    }

    // 軽量鉄骨（鉄骨造からの推計）
    const steelCandidate = candidates.find(c => c.structure === '鉄骨');
    if (steelCandidate) {
      const steelExisting    = existingMap.get('鉄骨');
      const lsExisting       = existingMap.get('軽量鉄骨');
      const coefficient      = lsExisting?.coefficient ?? 1.0;
      const lsPrice          = this.estatService.estimateLightSteelPrice(
        steelCandidate.estatPrice, coefficient);
      const currentPrice     = lsExisting?.price ?? null;
      const priceDiff        = currentPrice !== null ? lsPrice - currentPrice : null;
      const pctChange        = priceDiff !== null && currentPrice !== null
        ? Math.round((priceDiff / currentPrice) * 1000) / 10
        : null;
      candidates.push({
        year:                 estatData.year,
        structure:            '軽量鉄骨',
        estatPrice:           lsPrice,
        ntaPrice:             null, // NTA に軽量鉄骨独立列なし
        currentPrice,
        priceDiff,
        pctChange,
        isLightSteelEstimate: true,
        coefficient,
        validationWarnings:   [
          `軽量鉄骨は推計値（鉄骨 ${steelCandidate.estatPrice.toLocaleString()}円 × 係数${coefficient}）`,
        ],
      });
    }

    return candidates;
  }

  /**
   * 候補リストを検証し、全体の警告を返す
   */
  private validateCandidates(candidates: UpdateCandidate[]): string[] {
    const warnings: string[] = [];
    for (const c of candidates) {
      warnings.push(...c.validationWarnings.map(w => `[${c.structure}] ${w}`));
    }
    return warnings;
  }

  /**
   * 候補を DB に保存する（estat_price のみ更新・price_per_sqm は変更しない）
   *
   * ・row が存在する → estat_price / fetched_at だけ UPDATE
   * ・row が存在しない → is_approved=false で INSERT
   */
  private async saveCandidates(
    year: number,
    candidates: UpdateCandidate[],
    fetchedAt: Date,
  ): Promise<number> {
    let savedCount = 0;
    for (const c of candidates) {
      // 既存 row があれば estat_price だけ更新
      const { data: existing } = await this.table('construction_unit_prices')
        .select('id, is_approved')
        .eq('year', year)
        .eq('structure', c.structure)
        .maybeSingle();

      if (existing) {
        const { error } = await this.table('construction_unit_prices')
          .update({
            estat_price:  c.estatPrice,
            fetched_at:   fetchedAt.toISOString(),
            // is_provisional を更新（e-Stat データが取得できた年は false に）
            is_provisional: c.isLightSteelEstimate,
            provisional_reason: c.isLightSteelEstimate
              ? `軽量鉄骨は推計値（鉄骨×係数${c.coefficient ?? 1.0}）。e-Statに独立列なし`
              : null,
          })
          .eq('id', existing.id);
        if (!error) savedCount++;
      } else {
        // 新規行（まだ承認されていない候補）
        const { error } = await this.table('construction_unit_prices')
          .insert({
            year:              year,
            structure:         c.structure,
            price_per_sqm:     c.estatPrice,   // 初回登録時のみ estat_price を仮設定
            estat_price:       c.estatPrice,
            nta_price:         c.ntaPrice,
            price_source:      c.isLightSteelEstimate ? 'estat_with_coefficient' : 'estat',
            derivation_note:   c.isLightSteelEstimate
              ? `鉄骨造単価から推計: 鉄骨造×係数${c.coefficient ?? 1.0}で算出。e-Statに軽量鉄骨独立列なし`
              : `e-Stat 0003114547 全用途・全国 ${year}年 実績値`,
            coefficient:       c.isLightSteelEstimate ? (c.coefficient ?? 1.0) : null,
            coefficient_source: c.isLightSteelEstimate
              ? 'NTAの暗黙的扱い（鉄骨造と同値）。係数1.0は暫定。' : null,
            published_year:    year,
            fetched_at:        fetchedAt.toISOString(),
            is_approved:       false,
            is_provisional:    c.isLightSteelEstimate,
            provisional_reason: c.isLightSteelEstimate
              ? `軽量鉄骨は推計値（鉄骨×係数${c.coefficient ?? 1.0}）。e-Statに独立列なし` : null,
            version:           1,
          });
        if (!error) savedCount++;
      }
    }
    return savedCount;
  }

  /**
   * 指定した (year, structure) の更新候補を承認する。
   *
   * estat_price → price_per_sqm に反映し、is_approved=true に設定する。
   * ⚠️ 承認後は ValuationCalculatorService のキャッシュが TTL 切れ後に自動更新される。
   */
  async approveCandidate(year: number, structure: string): Promise<void> {
    const { data, error } = await this.table('construction_unit_prices')
      .select('id, estat_price')
      .eq('year', year)
      .eq('structure', structure)
      .maybeSingle();

    if (error || !data) throw new Error(`候補が見つかりません: ${year}/${structure}`);
    if (!data.estat_price) throw new Error(`estat_price が未設定です: ${year}/${structure}`);

    const { error: updateError } = await this.table('construction_unit_prices')
      .update({
        price_per_sqm: data.estat_price,
        is_approved:   true,
        approved_at:   new Date().toISOString(),
        approved_by:    'admin',
        is_provisional: false,
        price_source:   'estat',
      })
      .eq('id', data.id);

    if (updateError) throw new Error(`承認更新失敗: ${updateError.message}`);
  }

  /**
   * e-Stat データ取得可能な年度一覧を返す
   */
  async getAvailableYears(): Promise<number[]> {
    return this.estatService.fetchAvailableYears();
  }

  /**
   * DB から承認待ちの候補を一覧取得
   */
  async listPendingCandidates(year?: number): Promise<Record<string, unknown>[]> {
    let q = this.table('construction_unit_prices')
      .select('*')
      .eq('is_approved', false)
      .order('year', { ascending: false })
      .order('structure');
    if (year) q = q.eq('year', year);
    const { data, error } = await q;
    if (error) throw new Error(`候補取得失敗: ${error.message}`);
    return data ?? [];
  }
}

export const constructionPriceUpdateService = new ConstructionPriceUpdateService();
