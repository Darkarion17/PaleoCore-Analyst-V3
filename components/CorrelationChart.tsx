import React, { useMemo, useState } from 'react';
import type { Section, DataPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Customized } from 'recharts';

type AiSuggestion = { refDepth: number; targetDepth: number; confidence: number };

interface CorrelationChartProps {
  referenceSection: Section;
  targetSection: Section;
  proxyKey: string;
  yAxisKey: 'depth' | 'age';
  proxyLabels: Record<string, string>;
  suggestions: AiSuggestion[] | null;
  onAcceptSuggestion: (suggestion: AiSuggestion) => void;
}

const SuggestionLines = (props: any) => {
    const { referenceSection, targetSection, proxyKey, suggestions, onAcceptSuggestion, yAxisKey, xAxisMap, yAxisMap } = props;
    const [hoveredSuggestion, setHoveredSuggestion] = useState<AiSuggestion | null>(null);

    if (!suggestions || suggestions.length === 0 || !xAxisMap || !yAxisMap) return null;
    
    const { left: leftAxis, right: rightAxis } = yAxisMap;
    const xAxis = xAxisMap[Object.keys(xAxisMap)[0]];
    if (!leftAxis || !rightAxis || !xAxis) return null;

    const findProxyValue = (section: Section, depth: number) => {
        const closestPoint = section.dataPoints.reduce((
            closest: { dist: number; proxy: string | number | boolean | null },
            p
        ) => {
            const yValue = p[yAxisKey];
            if (yValue === undefined || yValue === null || typeof yValue !== 'number' || p[proxyKey] === undefined) {
                return closest;
            }
            const dist = Math.abs(yValue - depth);
            if (dist < closest.dist) {
                return { dist, proxy: p[proxyKey] };
            }
            return closest;
        }, { dist: Infinity, proxy: null });
        return closestPoint.proxy;
    };
    
    return (
        <g className="suggestion-lines">
            {suggestions.map((s, i) => {
                const refProxy = findProxyValue(referenceSection, s.refDepth);
                const targetProxy = findProxyValue(targetSection, s.targetDepth);
                if (refProxy === null || targetProxy === null) return null;
                
                const p1 = { x: xAxis.scale(refProxy), y: leftAxis.scale(s.refDepth) };
                const p2 = { x: xAxis.scale(targetProxy), y: rightAxis.scale(s.targetDepth) };
                
                const isHovered = hoveredSuggestion === s;

                return (
                    <g 
                        key={i} 
                        onClick={() => onAcceptSuggestion(s)} 
                        onMouseEnter={() => setHoveredSuggestion(s)}
                        onMouseLeave={() => setHoveredSuggestion(null)}
                        style={{ cursor: 'pointer' }}
                    >
                        <line 
                            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
                            stroke={isHovered ? 'var(--accent-primary)' : 'var(--text-muted)'} 
                            strokeWidth={isHovered ? 2.5 : 1.5} 
                            strokeDasharray="4 4" 
                            strokeOpacity={isHovered ? 1 : 0.7}
                        />
                         {isHovered && (
                            <text
                                x={(p1.x + p2.x) / 2}
                                y={(p1.y + p2.y) / 2}
                                textAnchor="middle"
                                dy="-5"
                                fill="var(--accent-primary)"
                                style={{ fontSize: '12px', fontWeight: 'bold', pointerEvents: 'none' }}
                            >
                                {s.confidence}%
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
};


const CorrelationChart: React.FC<CorrelationChartProps> = ({ referenceSection, targetSection, proxyKey, yAxisKey, proxyLabels, suggestions, onAcceptSuggestion }) => {

  const combinedData = useMemo(() => {
    const processData = (section: Section): DataPoint[] =>
        [...section.dataPoints].filter(dp => dp[yAxisKey] !== undefined && dp[yAxisKey] !== null && dp[proxyKey] !== undefined && dp[proxyKey] !== null);

    const refData = processData(referenceSection);
    const targetData = processData(targetSection);
    
    if (refData.length === 0 || targetData.length === 0) return [];

    const data = [];
    for (const p of refData) {
        data.push({ [proxyKey]: p[proxyKey], refValue: p[yAxisKey], targetValue: null });
    }
    for (const p of targetData) {
        data.push({ [proxyKey]: p[proxyKey], refValue: null, targetValue: p[yAxisKey] });
    }
    
    return data.sort((a, b) => (a[proxyKey] as number) - (b[proxyKey] as number));
  }, [referenceSection, targetSection, proxyKey, yAxisKey]);


  if (combinedData.length === 0) {
      return (
          <div className="flex items-center justify-center h-full text-content-muted py-10">
              <p>One or both selected sections lack data for the specified proxy and Y-axis.</p>
          </div>
      );
  }

  const proxyLabel = proxyLabels[proxyKey] || proxyKey;
  const yAxisLabel = yAxisKey === 'age' ? 'Age (ka)' : (proxyLabels.depth || 'Depth (mbsf)');

  return (
    <div style={{ width: '100%', height: 450 }}>
      <ResponsiveContainer>
        <LineChart
            data={combinedData}
            margin={{ top: 5, right: 50, left: 50, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          
          <XAxis 
            dataKey={proxyKey}
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
            label={{ value: proxyLabel, position: 'insideBottom', offset: -20, fontSize: 14 }}
          />

          <YAxis 
            yAxisId="left"
            dataKey="refValue"
            type="number"
            domain={['dataMin', 'dataMax']} 
            reversed 
            tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
            label={{ value: `${referenceSection.name} (${yAxisLabel})`, angle: -90, position: 'insideLeft', fontSize: 14, dx: -35 }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            dataKey="targetValue"
            type="number"
            domain={['dataMin', 'dataMax']}
            reversed 
            tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}
            label={{ value: `${targetSection.name} (${yAxisLabel})`, angle: 90, position: 'insideRight', fontSize: 14, dx: 35 }}
          />
          
          <Tooltip 
             contentStyle={{ 
                backgroundColor: 'var(--recharts-tooltip-bg)',
                borderColor: 'var(--recharts-tooltip-border)',
                color: 'var(--recharts-tooltip-text)'
            }}
             labelFormatter={(label) => `${proxyLabel}: ${Number(label).toFixed(3)}`}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />

          <Line
            yAxisId="left"
            dataKey="refValue"
            stroke="#8884d8"
            name={`${referenceSection.name}`}
            dot={false}
            type="monotone"
            connectNulls
          />
          <Line
            yAxisId="right"
            dataKey="targetValue"
            stroke="#82ca9d"
            name={`${targetSection.name}`}
            dot={false}
            type="monotone"
            connectNulls
          />
           <Customized component={(props: any) => (
               <SuggestionLines {...(props || {})} 
                  referenceSection={referenceSection} 
                  targetSection={targetSection} 
                  proxyKey={proxyKey}
                  yAxisKey={yAxisKey}
                  suggestions={suggestions} 
                  onAcceptSuggestion={onAcceptSuggestion} 
                />
            )} 
            />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CorrelationChart;