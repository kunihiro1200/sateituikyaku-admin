import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { ComparisonIndicator } from './ComparisonIndicator';

interface MetricCardProps {
  title: string;
  currentValue: number;
  monthlyAverage: number;
  target?: number;
  previousYearAverage?: number;
  unit?: string;
  showProgressBar?: boolean;
  formula?: string;
  formulaValues?: string;
  children?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  currentValue,
  monthlyAverage,
  target,
  previousYearAverage,
  unit = '%',
  showProgressBar = false,
  formula,
  formulaValues,
  children,
}) => {
  const [showFormula, setShowFormula] = useState(false);

  const achievementRate = target !== undefined ? (currentValue / target) * 100 : undefined;
  const differenceFromAverage = currentValue - monthlyAverage;

  return (
    <div className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow">

      {/* タイトル行 + 条件式ボタン */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
        {formula && (
          <button
            onClick={() => setShowFormula(v => !v)}
            className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            条件式
          </button>
        )}
      </div>

      {/* 当月ハイライト */}
      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px' }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 500 }}>当月</span>
          <span style={{ fontSize: '30px', fontWeight: 700, color: '#1d4ed8' }}>
            {currentValue.toFixed(1)}
          </span>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#2563eb' }}>{unit}</span>
          <span style={{ fontSize: '13px', color: '#93c5fd' }}>
            （月平均 {monthlyAverage.toFixed(1)}{unit}）
          </span>
          {Math.abs(differenceFromAverage) > 0.5 && (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
              backgroundColor: differenceFromAverage > 0 ? '#dcfce7' : '#fee2e2',
              color: differenceFromAverage > 0 ? '#15803d' : '#b91c1c',
            }}>
              {differenceFromAverage > 0 ? '+' : ''}{differenceFromAverage.toFixed(1)}{unit}
            </span>
          )}
        </div>

        {/* 目標・達成度（ハイライト内に1行のみ） */}
        {target !== undefined && achievementRate !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px' }}>
            <span style={{ color: '#93c5fd' }}>目標 {target}{unit}</span>
            <span style={{ fontWeight: 600, color: '#2563eb' }}>達成度 {achievementRate.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* プログレスバー */}
      {showProgressBar && target !== undefined && (
        <div className="mb-3">
          <ProgressBar current={currentValue} target={target} showPercentage={false} />
        </div>
      )}

      {/* 前年度平均との比較 */}
      {previousYearAverage !== undefined && (
        <div className="mb-2">
          <ComparisonIndicator
            current={currentValue}
            average={previousYearAverage}
            label="前年度平均"
          />
        </div>
      )}

      {/* 条件式（トグル表示） */}
      {showFormula && formula && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600">
          <div className="font-medium text-gray-500 mb-1">計算式</div>
          <div>{formula}</div>
          {formulaValues && (
            <div className="mt-1 text-gray-400">{formulaValues}</div>
          )}
        </div>
      )}

      {/* 子要素（テーブルなど） */}
      {children && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};
