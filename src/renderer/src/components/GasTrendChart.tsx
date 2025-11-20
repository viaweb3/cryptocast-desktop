import React from 'react';

interface GasTrendChartProps {
  data?: Array<{
    date: string;
    gasUsed: number;
    gasCostUSD: number;
  }>;
}

export default function GasTrendChart({ data = mockData }: GasTrendChartProps) {
  const maxGasCost = Math.max(...data.map(d => d.gasCostUSD));
  const maxGasUsed = Math.max(...data.map(d => d.gasUsed));

  return (
    <div className="p-6 bg-white border border-border rounded-lg">
      <h3 className="text-lg font-semibold text-dark mb-4">Gas消耗趋势图</h3>
      <div className="relative h-48">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-gray-500">
          <span>0.1 ETH</span>
          <span>0.05</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-10 mr-4 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-b border-gray-200"></div>
            <div className="border-b border-gray-200"></div>
            <div className="border-b border-gray-200"></div>
          </div>

          {/* Chart bars and line */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Gradient area */}
            <defs>
              <linearGradient id="gasGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Area under the line */}
            <path
              d={`M 10,90 L 30,70 L 50,40 L 70,60 L 90,50 L 90,100 L 10,100 Z`}
              fill="url(#gasGradient)"
            />

            {/* Line chart */}
            <path
              d={`M 10,90 L 30,70 L 50,40 L 70,60 L 90,50`}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
            />

            {/* Data points */}
            <circle cx="10" cy="90" r="3" fill="#3B82F6" />
            <circle cx="30" cy="70" r="3" fill="#3B82F6" />
            <circle cx="50" cy="40" r="3" fill="#3B82F6" />
            <circle cx="70" cy="60" r="3" fill="#3B82F6" />
            <circle cx="90" cy="50" r="3" fill="#3B82F6" />
          </svg>

          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-2">
            <span>11-01</span>
            <span>11-05</span>
            <span>11-10</span>
            <span>11-15</span>
            <span>11-19</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-gray-600">Gas消耗量 (ETH)</span>
        </div>
        <div className="text-gray-500">
          总计: 0.45 ETH (~$1,125)
        </div>
      </div>
    </div>
  );
}

// Mock data for demonstration
const mockData = [
  { date: '11-01', gasUsed: 0.02, gasCostUSD: 50 },
  { date: '11-05', gasUsed: 0.05, gasCostUSD: 125 },
  { date: '11-10', gasUsed: 0.08, gasCostUSD: 200 },
  { date: '11-15', gasUsed: 0.04, gasCostUSD: 100 },
  { date: '11-19', gasUsed: 0.06, gasCostUSD: 150 },
];