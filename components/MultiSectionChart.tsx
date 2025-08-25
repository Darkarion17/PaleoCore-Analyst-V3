import React, { useState, useMemo } from 'react';
import type { Section, DataPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

interface MultiSectionChartProps {
  sections: Section[];
  spliceData: DataPoint[];
  proxyKey: string;
  xAxisKey: 'depth' | 'age';
  showLr04: boolean;
  lr04Data: { age: number; d18O: number }[];
  proxyLabels: Record<string, string>;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#FFBB28', '#a4de6c', '#d0ed57', '#ffc658'];
const LR04_COLOR = 'var(--text-muted)';
const SPLICE_COLOR = 'var(--accent-primary)';


const CustomTooltip = ({ active, payload, label, xAxisLabel }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip-wrapper">
                <p className="tooltip-label">{`${xAxisLabel}: ${Number(label).toFixed(3)}`}</p>
                {payload.map((pld: any, index: number) => (
                    <div key={index} className="tooltip-item" style={{ color: pld.color }}>
                        <div className="tooltip-color-swatch" style={{ backgroundColor: pld.stroke }} />
                        <span className="tooltip-item-name">{pld.name}:</span>
                        <span className="tooltip-item-value">{Number(pld.value).toFixed(3)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};


const MultiSectionChart: React.FC<MultiSectionChartProps> = ({ sections, spliceData, proxyKey, xAxisKey, showLr04, lr04Data, proxyLabels }) => {
    const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

    const toggleSeries = (dataKey: any) => {
        setHiddenSeries(prev => ({ ...prev, [dataKey.value]: !prev[dataKey.value] }));
    };

    const yAxisLabel = proxyLabels[proxyKey] || proxyKey;
    const xAxisLabel = xAxisKey === 'age' ? 'Age (ka)' : (proxyLabels.depth || 'Depth (mbsf)');

    const allDataPoints = useMemo(() => {
        const combined = new Map<number, any>();
        
        sections.forEach(section => {
            section.dataPoints.forEach(dp => {
                const key = dp[xAxisKey] as number;
                if (key !== undefined && dp[proxyKey] !== undefined) {
                    if (!combined.has(key)) combined.set(key, { [xAxisKey]: key });
                    combined.get(key)[section.name] = dp[proxyKey];
                }
            });
        });
        
        spliceData.forEach(dp => {
            const key = dp[xAxisKey] as number;
            if (key !== undefined && dp[proxyKey] !== undefined) {
                 if (!combined.has(key)) combined.set(key, { [xAxisKey]: key });
                 combined.get(key)['Composite Splice'] = dp[proxyKey];
            }
        });
        
        if (showLr04 && xAxisKey === 'age') {
            lr04Data.forEach(dp => {
                const key = dp.age;
                if (!combined.has(key)) combined.set(key, { [xAxisKey]: key });
                combined.get(key)['LR04 Benthic Stack'] = dp.d18O;
            });
        }

        return Array.from(combined.values()).sort((a, b) => a[xAxisKey] - b[xAxisKey]);

    }, [sections, spliceData, proxyKey, xAxisKey, showLr04, lr04Data]);

  return (
    <div style={{ width: '100%', height: 500 }}>
        <ResponsiveContainer>
            <LineChart data={allDataPoints} margin={{ top: 5, right: 40, left: 30, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey={xAxisKey}
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    label={{ value: xAxisLabel, position: 'insideBottom', offset: -25, fontSize: 14 }}
                    allowDuplicatedCategory={false}
                    reversed={xAxisKey === 'age'}
                />
                <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    domain={['auto', 'auto']}
                    label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 14, dx: -10 }}
                />
                {showLr04 && xAxisKey === 'age' && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    reversed // d18O is typically plotted with enriched (colder) values downwards
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    domain={['dataMin - 0.2', 'dataMax + 0.2']}
                    label={{ value: "LR04 δ¹⁸O (‰)", angle: 90, position: 'insideRight', fontSize: 14, dx: 10 }}
                  />
                )}
                <Tooltip
                    content={<CustomTooltip xAxisLabel={xAxisLabel} />}
                    cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Legend wrapperStyle={{ paddingTop: '50px' }} onClick={toggleSeries} />

                 {sections.map((section, index) => (
                    <Line
                        key={section.id}
                        yAxisId="left"
                        dataKey={section.name}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                        type="monotone"
                        hide={hiddenSeries[section.name]}
                        isAnimationActive={true}
                        animationDuration={800}
                    />
                ))}

                {spliceData.length > 0 && (
                    <Line
                        yAxisId="left"
                        dataKey="Composite Splice"
                        stroke={SPLICE_COLOR}
                        strokeWidth={3}
                        dot={false}
                        connectNulls
                        type="monotone"
                        hide={hiddenSeries['Composite Splice']}
                        isAnimationActive={true}
                        animationDuration={1200}
                    />
                )}

                {showLr04 && xAxisKey === 'age' && (
                    <Line
                        yAxisId="right"
                        dataKey="LR04 Benthic Stack"
                        stroke={LR04_COLOR}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls
                        type="monotone"
                        hide={hiddenSeries['LR04 Benthic Stack']}
                        isAnimationActive={true}
                        animationDuration={1000}
                    />
                )}
                <Brush 
                    dataKey={xAxisKey} 
                    height={30} 
                    stroke="var(--accent-secondary)" 
                    fill="var(--bg-tertiary)"
                    y={460}
                />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default MultiSectionChart;