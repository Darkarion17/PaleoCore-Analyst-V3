
import React from 'react';
import { LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DynamicChartRendererProps {
    config: any;
    data: any[];
    proxyLabels: Record<string, string>;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#FFBB28'];

const DynamicChartRenderer: React.FC<DynamicChartRendererProps> = ({ config, data, proxyLabels }) => {
    
    if (!config || data.length === 0) {
        return <div className="text-center text-content-muted">No data to display for this configuration.</div>;
    }
    
    const { chartType, xAxis, yAxis, dataSeries } = config;
    
    const commonProps = {
        data: data,
        margin: { top: 5, right: 30, left: 30, bottom: 20 },
    };

    const renderChart = () => {
        if (chartType === 'scatter') {
            return (
                <ScatterChart {...commonProps}>
                    <CartesianGrid />
                    <XAxis type="number" dataKey={xAxis.key} name={xAxis.label} reversed={xAxis.reversed} />
                    <YAxis type="number" dataKey={yAxis.key} name={yAxis.label} reversed={yAxis.reversed} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend />
                    {dataSeries.map((series: any, index: number) => (
                         <Scatter key={series.label} dataKey={series.label} fill={COLORS[index % COLORS.length]} name={series.label} />
                    ))}
                </ScatterChart>
            );
        }
        
        return (
            <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                    dataKey={xAxis.key} 
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    reversed={xAxis.reversed}
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    label={{ value: xAxis.label, position: 'insideBottom', offset: -20, fontSize: 14 }}
                    allowDuplicatedCategory={false}
                />
                <YAxis 
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    domain={['auto', 'auto']}
                    reversed={yAxis.reversed}
                    label={{ value: yAxis.label, angle: -90, position: 'insideLeft', fontSize: 14, dx: -10 }}
                />
                <Tooltip 
                    formatter={(value: any, name: any) => [typeof value === 'number' ? value.toFixed(3) : value, name]}
                    labelFormatter={(label) => `${xAxis.label}: ${Number(label).toFixed(3)}`}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {dataSeries.map((series: any, index: number) => (
                    <Line
                        key={series.label}
                        type="monotone"
                        dataKey={series.label}
                        name={series.label}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                        isAnimationActive={true}
                        animationDuration={1000}
                    />
                ))}
            </LineChart>
        );
    };

    return (
        <div style={{ width: '100%', height: 500 }}>
            <ResponsiveContainer>
                {renderChart()}
            </ResponsiveContainer>
        </div>
    );
};

export default DynamicChartRenderer;
