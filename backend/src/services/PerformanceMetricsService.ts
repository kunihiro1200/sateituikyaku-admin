import { BaseRepository } from '../repositories/BaseRepository';
import { FiscalYearUtils } from '../utils/FiscalYearUtils';

export interface RepresentativeMetric {
  representative: string;
  count: number;
  rate: number;
  numerator?: number;        // 専任件数（分子）
  denominator?: number;      // 訪問数 - 一般媒介数（分母）
  visitCount?: number;       // 訪問数
  generalAgencyCount?: number; // 一般媒介数
}

export interface RepresentativeMetricWithAverage extends RepresentativeMetric {
  fiscalYearMonthlyAverage: number;
}

export interface PerformanceMetrics {
  month: string;
  visitAppraisalCount: number;
  visitAppraisalRate: number;
  exclusiveContracts: {
    byRepresentative: RepresentativeMetric[];
    total: {
      count: number;
      rate: number;
      numerator?: number;        // 専任件数（分子）
      denominator?: number;      // 訪問数 - 一般媒介数（分母）
      visitCount?: number;       // 訪問数
      generalAgencyCount?: number; // 一般媒介数
      target?: number;
    };
  };
  competitorLossUnvisited: {
    count: number;
    rate: number;
  };
  competitorLossVisited: {
    byRepresentative: RepresentativeMetric[];
    total: {
      count: number;
      rate: number;
    };
  };
}

export interface EnhancedPerformanceMetrics {
  month: string;
  visitAppraisalRate: {
    currentValue: number;
    fiscalYearMonthlyAverage: number;
    target: 28;
    numerator: number;   // 訪問査定取得数
    denominator: number; // 依頼件数
  };
  exclusiveContracts: {
    byRepresentative: RepresentativeMetricWithAverage[];
    total: {
      count: number;
      rate: number;
      fiscalYearMonthlyAverage: number;
      target: 48;
      numerator: number;        // 専任件数
      denominator: number;      // 訪問査定取得数 - 一般媒介件数
      visitCount: number;       // 訪問査定取得数
      generalAgencyCount: number; // 一般媒介件数
    };
  };
  competitorLossUnvisited: {
    currentValue: number;
    fiscalYearMonthlyAverage: number;
    previousYearMonthlyAverage: number;
    numerator: number;   // 未訪問他決件数
    denominator: number; // 未訪問依頼件数
  };
  competitorLossVisited: {
    byRepresentative: RepresentativeMetricWithAverage[];
    total: {
      count: number;
      rate: number;
      fiscalYearMonthlyAverage: number;
      previousYearMonthlyAverage: number;
      numerator: number;   // 訪問済み他決件数
      denominator: number; // 訪問査定取得数
    };
  };
}

export class PerformanceMetricsService extends BaseRepository {
  /**
   * 拡張されたメトリクス計算（月平均を含む）
   */
  async calculateEnhancedMetrics(month: string): Promise<EnhancedPerformanceMetrics> {
    const [year, monthNum] = month.split('-').map(Number);

    // 現在月のメトリクスを並列計算
    const [visitAppraisalRateResult, exclusiveContracts, competitorLossUnvisited, competitorLossVisited] =
      await Promise.all([
        this.calculateVisitAppraisalRate(year, monthNum),
        this.calculateExclusiveContracts(year, monthNum),
        this.calculateCompetitorLossUnvisited(year, monthNum),
        this.calculateCompetitorLossVisited(year, monthNum),
      ]);

    const visitAppraisalRate = visitAppraisalRateResult.rate;

    // 年度月平均・前年度月平均・担当者別月平均を全て並列計算
    const [
      visitAppraisalRateAvg,
      exclusiveContractsRateAvg,
      competitorLossUnvisitedAvg,
      competitorLossVisitedAvg,
      competitorLossUnvisitedPrevYearAvg,
      competitorLossVisitedPrevYearAvg,
      exclusiveByRepWithAvg,
      competitorLossVisitedByRepWithAvg,
    ] = await Promise.all([
      this.calculateFiscalYearMonthlyAverage(
        year,
        monthNum,
        async (y, m) => {
          const result = await this.calculateVisitAppraisalRate(y, m);
          return result.rate;
        }
      ),
      this.calculateFiscalYearMonthlyAverage(
        year,
        monthNum,
        async (y, m) => {
          const result = await this.calculateExclusiveContracts(y, m);
          return result.total.rate;
        }
      ),
      this.calculateFiscalYearMonthlyAverage(
        year,
        monthNum,
        async (y, m) => {
          const result = await this.calculateCompetitorLossUnvisited(y, m);
          return result.rate;
        }
      ),
      this.calculateFiscalYearMonthlyAverage(
        year,
        monthNum,
        async (y, m) => {
          const result = await this.calculateCompetitorLossVisited(y, m);
          return result.total.rate;
        }
      ),
      this.calculatePreviousYearMonthlyAverage(
        year,
        monthNum,
        async (y, m) => {
          const result = await this.calculateCompetitorLossUnvisited(y, m);
          return result.rate;
        }
      ),
      this.calculatePreviousYearMonthlyAverage(
        year,
        monthNum,
        async (y, m) => {
          const result = await this.calculateCompetitorLossVisited(y, m);
          return result.total.rate;
        }
      ),
      this.calculateRepresentativeMonthlyAverages(
        year,
        monthNum,
        exclusiveContracts.byRepresentative,
        (y, m) => this.calculateExclusiveContracts(y, m)
      ),
      this.calculateRepresentativeMonthlyAverages(
        year,
        monthNum,
        competitorLossVisited.byRepresentative,
        (y, m) => this.calculateCompetitorLossVisited(y, m)
      ),
    ]);

    return {
      month,
      visitAppraisalRate: {
        currentValue: visitAppraisalRate,
        fiscalYearMonthlyAverage: visitAppraisalRateAvg,
        target: 28,
        numerator: visitAppraisalRateResult.numerator,
        denominator: visitAppraisalRateResult.denominator,
      },
      exclusiveContracts: {
        byRepresentative: exclusiveByRepWithAvg,
        total: {
          count: exclusiveContracts.total.count,
          rate: exclusiveContracts.total.rate,
          fiscalYearMonthlyAverage: exclusiveContractsRateAvg,
          target: 48,
          numerator: exclusiveContracts.total.count,
          denominator: exclusiveContracts.total.denominator,
          visitCount: exclusiveContracts.total.visitCount,
          generalAgencyCount: exclusiveContracts.total.generalAgencyCount,
        },
      },
      competitorLossUnvisited: {
        currentValue: competitorLossUnvisited.rate,
        fiscalYearMonthlyAverage: competitorLossUnvisitedAvg,
        previousYearMonthlyAverage: competitorLossUnvisitedPrevYearAvg,
        numerator: competitorLossUnvisited.numerator,
        denominator: competitorLossUnvisited.denominator,
      },
      competitorLossVisited: {
        byRepresentative: competitorLossVisitedByRepWithAvg,
        total: {
          count: competitorLossVisited.total.count,
          rate: competitorLossVisited.total.rate,
          fiscalYearMonthlyAverage: competitorLossVisitedAvg,
          previousYearMonthlyAverage: competitorLossVisitedPrevYearAvg,
          numerator: competitorLossVisited.total.numerator,
          denominator: competitorLossVisited.total.denominator,
        },
      },
    };
  }

  /**
   * 年度内の月平均を計算
   */
  private async calculateFiscalYearMonthlyAverage(
    year: number,
    month: number,
    calculateMonthMetric: (y: number, m: number) => Promise<number>
  ): Promise<number> {
    const monthRange = FiscalYearUtils.getFiscalYearMonthRange(year, month);
    const monthsElapsed = monthRange.monthsElapsed;

    const startYear = monthRange.startMonth.getFullYear();
    const startMonth = monthRange.startMonth.getMonth() + 1; // 1-indexed

    // 全月を並列計算
    const promises = Array.from({ length: monthsElapsed }, (_, i) => {
      const currentMonth = startMonth + i;
      let currentYear = startYear;
      let adjustedMonth = currentMonth;
      if (currentMonth > 12) {
        currentYear = startYear + 1;
        adjustedMonth = currentMonth - 12;
      }
      return calculateMonthMetric(currentYear, adjustedMonth).catch(error => {
        console.error(`Error calculating metric for ${currentYear}-${adjustedMonth}:`, error);
        return 0;
      });
    });

    const values = await Promise.all(promises);
    const sum = values.reduce((acc, v) => acc + v, 0);
    return monthsElapsed > 0 ? sum / monthsElapsed : 0;
  }

  /**
   * 前年度同期間の月平均を計算
   */
  private async calculatePreviousYearMonthlyAverage(
    year: number,
    month: number,
    calculateMonthMetric: (y: number, m: number) => Promise<number>
  ): Promise<number> {
    const prevYearRange = FiscalYearUtils.getPreviousFiscalYearRange(year, month);
    const monthsElapsed = FiscalYearUtils.getMonthsElapsedInFiscalYear(year, month);

    const startYear = prevYearRange.startDate.getFullYear();
    const startMonth = prevYearRange.startDate.getMonth() + 1; // 1-indexed

    // 全月を並列計算
    const promises = Array.from({ length: monthsElapsed }, (_, i) => {
      const currentMonth = startMonth + i;
      let currentYear = startYear;
      let adjustedMonth = currentMonth;
      if (currentMonth > 12) {
        currentYear = startYear + 1;
        adjustedMonth = currentMonth - 12;
      }
      return calculateMonthMetric(currentYear, adjustedMonth).catch(error => {
        console.error(`Error calculating previous year metric for ${currentYear}-${adjustedMonth}:`, error);
        return 0;
      });
    });

    const values = await Promise.all(promises);
    const sum = values.reduce((acc, v) => acc + v, 0);
    return monthsElapsed > 0 ? sum / monthsElapsed : 0;
  }

  /**
   * 担当者別の月平均を計算
   */
  private async calculateRepresentativeMonthlyAverages(
    year: number,
    month: number,
    currentRepMetrics: RepresentativeMetric[],
    calculateMonthMetric: (y: number, m: number) => Promise<{
      byRepresentative: RepresentativeMetric[];
      total: { count: number; rate: number };
    }>
  ): Promise<RepresentativeMetricWithAverage[]> {
    const monthRange = FiscalYearUtils.getFiscalYearMonthRange(year, month);
    const monthsElapsed = monthRange.monthsElapsed;

    const startYear = monthRange.startMonth.getFullYear();
    const startMonth = monthRange.startMonth.getMonth() + 1; // 1-indexed

    // 全月を並列計算
    const promises = Array.from({ length: monthsElapsed }, (_, i) => {
      const currentMonth = startMonth + i;
      let currentYear = startYear;
      let adjustedMonth = currentMonth;
      if (currentMonth > 12) {
        currentYear = startYear + 1;
        adjustedMonth = currentMonth - 12;
      }
      return calculateMonthMetric(currentYear, adjustedMonth).catch(error => {
        console.error(`Error calculating representative metrics for ${currentYear}-${adjustedMonth}:`, error);
        return null;
      });
    });

    const results = await Promise.all(promises);

    // 担当者ごとの合計を集計
    const repSums = new Map<string, number>();
    const repCounts = new Map<string, number>();
    for (const result of results) {
      if (!result) continue;
      result.byRepresentative.forEach(rep => {
        repSums.set(rep.representative, (repSums.get(rep.representative) || 0) + rep.rate);
        repCounts.set(rep.representative, (repCounts.get(rep.representative) || 0) + 1);
      });
    }

    // 現在月の担当者に月平均を追加
    return currentRepMetrics.map(rep => ({
      ...rep,
      fiscalYearMonthlyAverage: repCounts.get(rep.representative)
        ? (repSums.get(rep.representative) || 0) / (repCounts.get(rep.representative) || 1)
        : 0,
    }));
  }

  /**
   * 指定月のパフォーマンスメトリクスを計算
   */
  async calculateMetrics(month: string): Promise<PerformanceMetrics> {
    const [year, monthNum] = month.split('-').map(Number);

    const visitAppraisalCount = await this.calculateVisitAppraisalCount(year, monthNum);
    const visitAppraisalRateResult = await this.calculateVisitAppraisalRate(year, monthNum);
    const visitAppraisalRate = visitAppraisalRateResult.rate;
    const exclusiveContracts = await this.calculateExclusiveContracts(year, monthNum);
    const competitorLossUnvisited = await this.calculateCompetitorLossUnvisited(year, monthNum);
    const competitorLossVisited = await this.calculateCompetitorLossVisited(year, monthNum);

    return {
      month,
      visitAppraisalCount,
      visitAppraisalRate,
      exclusiveContracts,
      competitorLossUnvisited,
      competitorLossVisited,
    };
  }

  /**
   * 訪問査定取得数を計算
   * visit_acquisition_date が指定月の範囲内の件数をカウント
   */
  async calculateVisitAppraisalCount(year: number, month: number): Promise<number> {
    // Use UTC dates to avoid timezone issues
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

    const { count, error } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .gte('visit_acquisition_date', startDate)
      .lte('visit_acquisition_date', endDate)
      .is('deleted_at', null)
      .or('confidence_level.is.null,and(confidence_level.neq.D,confidence_level.neq.ダブり)');

    if (error) {
      console.error('Error calculating visit appraisal count:', error);
      throw new Error(`Failed to calculate visit appraisal count: ${error.message || JSON.stringify(error)}`);
    }

    return count || 0;
  }

  /**
   * 訪問査定取得割合を計算
   */
  async calculateVisitAppraisalRate(year: number, month: number): Promise<{ rate: number; numerator: number; denominator: number }> {
    const visitCount = await this.calculateVisitAppraisalCount(year, month);

    // Use UTC dates to avoid timezone issues
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

    const { count, error } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .gte('inquiry_date', startDate)
      .lte('inquiry_date', endDate)
      .is('deleted_at', null)
      .or('confidence_level.is.null,and(confidence_level.neq.D,confidence_level.neq.ダブり)');

    if (error) {
      console.error('Error calculating inquiry count:', error);
      throw error;
    }

    const inquiryCount = count || 0;
    const rate = inquiryCount === 0 ? 0 : (visitCount / inquiryCount) * 100;

    return { rate, numerator: visitCount, denominator: inquiryCount };
  }

  /**
   * 専任媒介件数と割合を計算
   * 条件: 
   * - status が '専任媒介'
   * - visit_assignee が存在
   * - contract_year_month が指定月
   * - confidence が "D" または "ダブり" でない
   */
  async calculateExclusiveContracts(
    year: number,
    month: number
  ): Promise<{
    byRepresentative: RepresentativeMetric[];
    total: { count: number; rate: number; denominator?: number; visitCount?: number; generalAgencyCount?: number };
  }> {
    // Use UTC dates to avoid timezone issues
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

    // 専任媒介の件数を取得（contract_year_month が指定月、status が '専任媒介'）
    const { data: exclusiveData, error: exclusiveError } = await this.table('sellers')
      .select('visit_assignee')
      .eq('status', '専任媒介')
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '')
      .gte('contract_year_month', startDate)
      .lte('contract_year_month', endDate)
      .or('confidence_level.is.null,and(confidence_level.neq.D,confidence_level.neq.ダブり)');

    if (exclusiveError) {
      console.error('Error calculating exclusive contracts:', exclusiveError);
      throw exclusiveError;
    }

    // 一般媒介の件数を取得（分母から除外するため）
    const { data: generalData, error: generalError } = await this.table('sellers')
      .select('visit_assignee')
      .eq('status', '一般媒介')
      .gte('contract_year_month', startDate)
      .lte('contract_year_month', endDate)
      .or('confidence_level.is.null,and(confidence_level.neq.D,confidence_level.neq.ダブり)');

    if (generalError) {
      console.error('Error calculating general agency contracts:', generalError);
      throw generalError;
    }

    const exclusiveCount = exclusiveData?.length || 0;
    const generalCount = generalData?.length || 0;

    // 訪問査定取得数を取得（割合計算用）
    const visitAppraisalCount = await this.calculateVisitAppraisalCount(year, month);

    // 分母 = 訪問査定取得数 - 一般媒介件数
    const denominator = visitAppraisalCount - generalCount;
    const totalRate = denominator > 0 ? (exclusiveCount / denominator) * 100 : 0;

    // 営担別の集計
    const byRepresentative: RepresentativeMetric[] = [];
    if (exclusiveData && exclusiveData.length > 0) {
      const exclusiveCounts = new Map<string, number>();
      exclusiveData.forEach(row => {
        const rep = row.visit_assignee;
        if (rep) {
          exclusiveCounts.set(rep, (exclusiveCounts.get(rep) || 0) + 1);
        }
      });

      // 営担別の一般媒介件数を集計
      const generalCounts = new Map<string, number>();
      if (generalData) {
        generalData.forEach(row => {
          const rep = row.visit_assignee;
          if (rep) {
            generalCounts.set(rep, (generalCounts.get(rep) || 0) + 1);
          }
        });
      }

      exclusiveCounts.forEach((count, representative) => {
        const repGeneral = generalCounts.get(representative) || 0;
        const repDenominator = visitAppraisalCount - repGeneral;
        const rate = repDenominator > 0 ? (count / repDenominator) * 100 : 0;
        byRepresentative.push({
          representative,
          count,
          rate,
        });
      });

      // 件数でソート
      byRepresentative.sort((a, b) => b.count - a.count);
    }

    return {
      byRepresentative,
      total: {
        count: exclusiveCount,
        rate: totalRate,
        denominator,
        visitCount: visitAppraisalCount,
        generalAgencyCount: generalCount,
      },
    };
  }

  /**
   * 他決割合（未訪問）を計算
   * 条件: contract_year_month が指定月、status に "他決" を含む、visit_assignee が空欄
   */
  async calculateCompetitorLossUnvisited(
    year: number,
    month: number
  ): Promise<{ count: number; rate: number; numerator: number; denominator: number }> {
    // Use UTC dates to avoid timezone issues
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

    // 未訪問で他決になった件数
    // contract_year_month（契約年月）が指定月で、status に "他決" を含み、営担が空欄
    const { count: lossCount, error: lossError } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .gte('contract_year_month', startDate)
      .lte('contract_year_month', endDate)
      .like('status', '%他決%')
      .or('visit_assignee.is.null,visit_assignee.eq.')
      .or('confidence_level.is.null,and(confidence_level.neq.D,confidence_level.neq.ダブり)');

    if (lossError) {
      console.error('Error calculating competitor loss unvisited:', lossError);
      throw lossError;
    }

    // 未訪問の依頼件数（確度D・ダブりを除く）
    const { count: inquiryCount, error: inquiryError } = await this.table('sellers')
      .select('*', { count: 'exact', head: true })
      .gte('inquiry_date', startDate)
      .lte('inquiry_date', endDate)
      .or('confidence_level.is.null,and(confidence_level.neq.D,confidence_level.neq.ダブり)')
      .is('visit_acquisition_date', null);

    if (inquiryError) {
      console.error('Error calculating inquiry count:', inquiryError);
      throw inquiryError;
    }

    const numerator = lossCount || 0;
    const denominator = inquiryCount || 0;
    const rate = denominator > 0 ? (numerator / denominator) * 100 : 0;

    return {
      count: numerator,
      rate,
      numerator,
      denominator,
    };
  }

  /**
   * 他決割合（訪問済み）を計算
   * 
   * 修正された計算式:
   * 分子: 「契約年月 他決は分かった時点」が指定月 かつ 「状況(当社)」に"他決"を含む件数
   * 分母: (visit_acquisition_dateが指定月の営担の総件数 - contract_year_monthが指定月 AND 「状況(当社)」が"一般媒介"の件数)
   * 
   * 例: 2025年11月の営担 I の場合
   * 分子: 2件（contract_year_monthが11月で他決の件数）
   * 分母: 12 - 1 = 11件（visit_acquisition_dateが11月の営担Iの総件数 - contract_year_monthが11月で一般媒介の件数）
   * 結果: 2 ÷ 11 ≈ 18.2%
   * 
   * 例: 2025年11月の営担 U の場合
   * 分子: 1件（contract_year_monthが11月で他決の件数）
   * 分母: 9 - 1 = 8件（visit_acquisition_dateが11月の営担Uの総件数 - contract_year_monthが11月で一般媒介の件数）
   * 結果: 1 ÷ 8 ≈ 12.5%
   */
  async calculateCompetitorLossVisited(
    year: number,
    month: number
  ): Promise<{
    byRepresentative: RepresentativeMetric[];
    total: { count: number; rate: number; numerator: number; denominator: number };
  }> {
    // Use UTC dates to avoid timezone issues
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();

    // 営担別の訪問済み他決件数を取得（分子）
    // 「契約年月 他決は分かった時点」が指定月で、「状況（当社）」に"他決"を含む
    const { data: lossData, error: lossError } = await this.table('sellers')
      .select('visit_assignee')
      .gte('contract_year_month', startDate)
      .lte('contract_year_month', endDate)
      .like('status', '%他決%');

    if (lossError) {
      console.error('Error calculating competitor loss visited:', lossError);
      throw lossError;
    }

    // 営担別の訪問査定取得数を取得（分母）
    // visit_acquisition_date が指定月のすべての件数
    const { data: totalData, error: totalError } = await this.table('sellers')
      .select('visit_assignee')
      .gte('visit_acquisition_date', startDate)
      .lte('visit_acquisition_date', endDate)
      .not('visit_assignee', 'is', null)
      .neq('visit_assignee', '');

    if (totalError) {
      console.error('Error calculating total count for loss rate:', totalError);
      throw totalError;
    }

    // 営担別に集計
    const lossCounts = new Map<string, number>();
    const totalCounts = new Map<string, number>();

    // 他決件数を集計
    if (lossData) {
      lossData.forEach(row => {
        const rep = row.visit_assignee;
        if (rep) {
          lossCounts.set(rep, (lossCounts.get(rep) || 0) + 1);
        }
      });
    }

    // 訪問査定取得数を集計
    if (totalData) {
      totalData.forEach(row => {
        const rep = row.visit_assignee;
        if (rep) {
          totalCounts.set(rep, (totalCounts.get(rep) || 0) + 1);
        }
      });
    }

    // 営担別のメトリクスを計算
    const byRepresentative: RepresentativeMetric[] = [];
    const allRepresentatives = new Set([...lossCounts.keys(), ...totalCounts.keys()]);

    allRepresentatives.forEach(representative => {
      const lossCount = lossCounts.get(representative) || 0;
      const total = totalCounts.get(representative) || 0;

      // 分母 = 訪問査定取得数
      const rate = total > 0 ? (lossCount / total) * 100 : 0;

      byRepresentative.push({
        representative,
        count: lossCount,
        rate,
      });
    });

    // 件数でソート（降順）
    byRepresentative.sort((a, b) => b.count - a.count);

    // 合計を計算
    const totalLossCount = Array.from(lossCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalVisitCount = Array.from(totalCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalRate = totalVisitCount > 0 ? (totalLossCount / totalVisitCount) * 100 : 0;

    return {
      byRepresentative,
      total: {
        count: totalLossCount,
        rate: totalRate,
        numerator: totalLossCount,
        denominator: totalVisitCount,
      },
    };
  }
}
