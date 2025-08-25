import React from 'react';
import type { TiePoint, Section } from '../types';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line } from 'recharts';

interface AgeDepthChartProps {
  tiePoints: TiePoint[];
  sections: Section[];
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#FFBB28'];

const AgeDepthChart: React.FC<AgeDepthChartProps> = ({ tiePoints, sections }) => {
  if (tiePoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-content-muted">
        <p>Add tie-points to visualize the age-depth model.</p>
      </div>
    );
  }

  const sectionData = sections.map((section, index) => {
    const points = tiePoints
      .filter(tp => tp.sectionId === section.id)
      .sort((a, b) => a.depth - b.depth);
    return {
      name: section.name,
      data: points,
      color: COLORS[index % COLORS.length],
    };
  }).filter(s => s.data.length > 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 30 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="age"
          name="Age"
          unit=" ka"
          domain={['dataMin', 'dataMax']}
          reversed
          label={{ value: 'Age (ka)', position: 'insideBottom', offset: -25, fontSize: 14 }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="depth"
          name="Depth"
          unit=" mbsf"
          domain={['dataMin', 'dataMax']}
          reversed
          label={{ value: 'Depth (mbsf)', angle: -90, position: 'insideLeft', fontSize: 14, dx: -10 }}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ backgroundColor: 'var(--recharts-tooltip-bg)', border: '1px solid var(--recharts-tooltip-border)' }}
        />
        <Legend wrapperStyle={{ paddingTop: '30px' }} />
        
        {sectionData.map(s => (
          <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} />
        ))}

        {sectionData.map(s => (
            <Line key={`line-${s.name}`} data={s.data} dataKey="depth" stroke={s.color} strokeWidth={2} dot={false} legendType="none" />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
};

export default AgeDepthChart;
