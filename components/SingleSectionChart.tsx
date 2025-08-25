import React, { useMemo } from 'react';
import type { DataPoint, PaleoEvent, Section, ProcessingPipeline } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea, Label, Brush, ReferenceLine } from 'recharts';

interface SingleSectionChartProps {
  section: Section;
  xAxisKey: 'depth' | 'age';
  yAxisKey: string;
  events?: PaleoEvent[];
  proxyLabels: Record<string, string>;
  hoveredValue: number | null;
  setHoveredValue: (value: number | null) => void;
}

const applyPipeline = (data: DataPoint[], pipeline: ProcessingPipeline): DataPoint[] => {
    let processedData = [...data];
    const sourceKey = pipeline.sourceProxy;

    pipeline.steps.forEach(step => {
        if (step.type === 'movingAverage') {
            const window = step.window;
            const halfWindow = Math.floor(window / 2);
            processedData = processedData.map((point, index, arr) => {
                const start = Math.max(0, index - halfWindow);
                const end = Math.min(arr.length, index + halfWindow + 1);
                const slice = arr.slice(start, end);
                const values = slice.map(p => p[sourceKey]).filter(v => typeof v === 'number') as number[];
                if (values.length > 0) {
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    return { ...point, [pipeline.name]: avg };
                }
                return { ...point, [pipeline.name]: null };
            });
        }
    });

    return processedData;
};

const SingleSectionChart: React.FC<SingleSectionChartProps> = ({ section, xAxisKey, yAxisKey, events = [], proxyLabels, hoveredValue, setHoveredValue }) => {
  
  const chartData = useMemo(() => {
    let dataToProcess = [...section.dataPoints];
    let finalYKey = yAxisKey;
    
    const virtualProxyPipeline = section.pipelines?.find(p => p.name === yAxisKey);

    if (virtualProxyPipeline) {
        dataToProcess = applyPipeline(dataToProcess, virtualProxyPipeline);
        finalYKey = virtualProxyPipeline.name;
    }
    
    return dataToProcess
        .filter(dp => dp[xAxisKey] !== undefined && dp[finalYKey] !== undefined && dp[xAxisKey] !== null && dp[finalYKey] !== null)
        .sort((a, b) => (a[xAxisKey] as number) - (b[xAxisKey] as number));
  }, [section, xAxisKey, yAxisKey]);
  
  const handleMouseMove = (e: any) => {
      if (e && e.activePayload && e.activePayload.length > 0) {
          const payload = e.activePayload[0].payload;
          if (xAxisKey === 'depth') {
              setHoveredValue(payload.depth);
          } else { // xAxisKey is 'age'
              // Find the closest point in the original (unsorted) data to get the depth
              const point = section.dataPoints.find(p => p.age === payload.age);
              if (point && point.depth !== undefined) {
                  setHoveredValue(point.depth);
              }
          }
      }
  };

  const handleMouseLeave = () => {
      setHoveredValue(null);
  };

  const referenceLineValue = useMemo(() => {
    if (hoveredValue === null) return null;
    if (xAxisKey === 'depth') return hoveredValue;
    
    // Find the age corresponding to the hovered depth for the reference line
    const closestPoint = section.dataPoints.reduce((
        closest: { dist: number; age: number | null | undefined },
        current
    ) => {
        if (current.depth === undefined || current.depth === null) return closest;
        const dist = Math.abs(current.depth - hoveredValue);
        if (dist < closest.dist) {
            return { dist, age: current.age };
        }
        return closest;
    }, { dist: Infinity, age: null as number | null | undefined });

    return closestPoint.age;

  }, [hoveredValue, xAxisKey, section.dataPoints]);


  if (chartData.length === 0) {
    return (
        <div className="flex items-center justify-center h-80 text-content-muted">
            <p>No valid data for the selected proxy '{proxyLabels[yAxisKey] || yAxisKey}' to display.</p>
        </div>
    );
  }

  const yAxisLabel = proxyLabels[yAxisKey] || yAxisKey;
  const xAxisLabel = xAxisKey === 'age' ? 'Age (ka)' : (proxyLabels.depth || 'Depth (mbsf)');

  return (
    <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
            <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 30, bottom: 40 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                    dataKey={xAxisKey} 
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    reversed={xAxisKey === 'age'} // Palaeo charts often show age increasing to the left (0 on the right)
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    label={{ value: xAxisLabel, position: 'insideBottom', offset: -25, fontSize: 14, fill: 'var(--recharts-axis-stroke)' }}
                    allowDuplicatedCategory={false}
                />
                <YAxis
                    tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
                    domain={['auto', 'auto']}
                    label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 14, fill: 'var(--recharts-axis-stroke)', dx: -10 }}
                />
                <Tooltip
                    formatter={(value: any, name: any) => [typeof value === 'number' ? value.toFixed(3) : value, proxyLabels[name] || name]}
                    labelFormatter={(label) => `${xAxisLabel}: ${Number(label).toFixed(3)}`}
                    animationDuration={150}
                />
                <Legend wrapperStyle={{ paddingTop: '35px' }} />
                
                {xAxisKey === 'age' && events.map((event, index) => (
                    <ReferenceArea 
                        key={index} 
                        x1={event.endAge} // X-axis is reversed
                        x2={event.startAge} // X-axis is reversed
                        stroke="var(--event-annotation-stroke)"
                        fill="var(--event-annotation-fill)"
                        strokeOpacity={0.6}
                        fillOpacity={0.2}
                    >
                      <Label value={event.eventName} position="top" fill="var(--event-annotation-stroke)" fontSize={12} offset={10} />
                    </ReferenceArea>
                ))}
                
                {referenceLineValue !== null && (
                    <ReferenceLine 
                        x={referenceLineValue} 
                        stroke="var(--accent-secondary)" 
                        strokeWidth={1.5} 
                        strokeDasharray="4 4" 
                    />
                )}

                <Line 
                    type="monotone" 
                    dataKey={yAxisKey} 
                    stroke="var(--accent-primary)" 
                    strokeWidth={2}
                    dot={false}
                    name={yAxisLabel}
                    connectNulls
                    isAnimationActive={true}
                    animationDuration={1000}
                />
                <Brush 
                    dataKey={xAxisKey} 
                    height={30} 
                    stroke="var(--accent-secondary)" 
                    fill="var(--bg-tertiary)"
                    y={360}
                />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default SingleSectionChart;