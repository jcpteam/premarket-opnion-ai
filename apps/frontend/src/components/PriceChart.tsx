/**
 * Price Chart Component
 * Historical price data visualization with indicators
 * 
 * Requirements: 6.4, 10.3
 */

'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface PricePoint {
  timestamp: string;
  price: number;
  volume: number;
}

interface PriceChartProps {
  marketId: string;
  outcomeId: string;
  outcomeName: string;
}

type TimeRange = '1H' | '24H' | '7D' | '30D' | 'ALL';

export function PriceChart({ marketId, outcomeId, outcomeName }: PriceChartProps) {
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('24H');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPriceHistory();
  }, [marketId, outcomeId, timeRange]);

  const fetchPriceHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/markets/${marketId}/outcomes/${outcomeId}/history?range=${timeRange}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch price history');
      }

      const data = await response.json();
      setPriceData(data.history || []);
    } catch (err: any) {
      setError(err.message);
      setPriceData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp);
    
    switch (timeRange) {
      case '1H':
        return format(date, 'HH:mm');
      case '24H':
        return format(date, 'HH:mm');
      case '7D':
        return format(date, 'MMM dd');
      case '30D':
        return format(date, 'MMM dd');
      case 'ALL':
        return format(date, 'MMM yyyy');
      default:
        return format(date, 'MMM dd');
    }
  };

  const formatYAxis = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900">
            {format(new Date(data.timestamp), 'MMM dd, yyyy HH:mm')}
          </p>
          <p className="text-sm text-gray-600">
            Price: <span className="font-bold text-blue-600">${data.price.toFixed(3)}</span>
          </p>
          <p className="text-sm text-gray-600">
            Volume: <span className="font-medium">{data.volume.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const calculateStats = () => {
    if (priceData.length === 0) return null;

    const prices = priceData.map(p => p.price);
    const currentPrice = prices[prices.length - 1];
    const startPrice = prices[0];
    const change = currentPrice - startPrice;
    const changePercent = (change / startPrice) * 100;
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const totalVolume = priceData.reduce((sum, p) => sum + p.volume, 0);

    return {
      currentPrice,
      change,
      changePercent,
      high,
      low,
      totalVolume,
    };
  };

  const stats = calculateStats();

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{outcomeName} Price Chart</h3>
            {stats && (
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    ${stats.currentPrice.toFixed(3)}
                  </span>
                  <span className={`ml-2 text-sm font-medium ${
                    stats.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(3)} ({stats.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-1">
            {(['1H', '24H', '7D', '30D', 'ALL'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">High: </span>
              <span className="font-medium text-gray-900">${stats.high.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-600">Low: </span>
              <span className="font-medium text-gray-900">${stats.low.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-600">Volume: </span>
              <span className="font-medium text-gray-900">{stats.totalVolume.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading chart...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          </div>
        ) : priceData.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <p className="text-sm text-gray-600">No price history available</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                tickFormatter={formatYAxis}
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                domain={[0, 1]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="Price"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
