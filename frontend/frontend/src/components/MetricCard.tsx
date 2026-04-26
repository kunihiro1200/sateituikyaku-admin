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

      {/* タイトル */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-600">{title}</h3>
        {formula && (
          <button
            onClick={() => setShowFormula(v => !v)}
            className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            条件式
          </button>
        )}
      </div>

      {/* 当月ハイライト */}
      <div className="bg-blue-50 rounded-lg px-4 py-3 mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-xs text-blue-500 font-medium">当月</span>
          <span className="text-3xl font-bold text-blue-700 ml-1">
            {currentValue.toFixed(1)}
          </span>
          <span className="text-lg font-semibold text-blue-600">{unit}</span>
        </div>
        {target !== undefined && achievementRate !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-blue-400">目標 {target}{unit}</span>
            <span className="text-xs font-semibold text-blue-600">達成度 {achievementRate.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* プログレスバー */}
      {showProgressBar && target !== undefined && (
        <div className="mb-3">
          <ProgressBar current={currentValue} target={target} />
        </div>
      )}

      {/* 月平均・差分 */}
      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="text-gray-500">月平均 {monthlyAverage.toFixed(1)}{unit}</span>
        {Math.abs(differenceFromAverage) > 0.5 && (
          <span className={`font-semibold text-xs px-1.5 py-0.5 rounded ${
            differenceFromAverage > 0
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {differenceFromAverage > 0 ? '+' : ''}{differenceFromAverage.toFixed(1)}{unit}
          </span>
        )}
      </div>

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
