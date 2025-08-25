import React from 'react';
import type { DataPoint, LabAnalysis } from '../types';
import { Table } from 'lucide-react';

interface DataTableProps {
  data: DataPoint[];
  averages?: LabAnalysis | null;
  proxyLabels: Record<string, string>;
}

const QC_FLAG_STYLES = {
    0: { color: 'transparent', title: 'OK' },
    1: { color: '#f97316', title: 'Suspect' }, // orange-500
    2: { color: '#ef4444', title: 'Exclude' }, // red-500
};

const DataTable: React.FC<DataTableProps> = ({ data, averages, proxyLabels }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-background-tertiary/20 rounded-lg text-content-muted border-2 border-dashed border-border-primary">
        <Table size={40} className="mb-2" />
        <p className="font-semibold">No data series to display.</p>
        <p className="text-sm">Upload a CSV or add points manually in the 'Data Entry' tab.</p>
      </div>
    );
  }

  const allHeaders = new Set<string>();
  data.forEach(dp => Object.keys(dp).forEach(key => allHeaders.add(key)));

  const priorityOrder = ['subsection', 'depth', 'age', 'qcFlag'];
  let headers = [
      ...priorityOrder.filter(h => allHeaders.has(h)),
      ...Array.from(allHeaders).filter(h => !priorityOrder.includes(h))
  ];

  const getAverage = (header: string): string | null => {
    if (!averages) return null;
    if (!(header in averages)) return null;
    const averageValue = averages[header as keyof LabAnalysis];
    if (typeof averageValue === 'number') {
        return averageValue.toFixed(4);
    }
    return null;
  };
  
  const hasAverages = averages && Object.values(averages).some(val => val !== null && val !== undefined);

  return (
    <div className="max-h-96 overflow-y-auto pr-2 relative">
      <table className="w-full text-sm text-left text-content-secondary">
        <thead className="text-xs text-content-muted uppercase bg-background-tertiary sticky top-0 z-10">
          <tr>
            {headers.map(header => (
              <th key={header} scope="col" className="px-6 py-3 whitespace-nowrap font-semibold">
                {proxyLabels[header] || header.replace(/([A-Z])/g, ' $1').toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {data.map((dp, index) => (
            <tr key={dp.subsection || index} className="bg-background-secondary hover:bg-background-tertiary/60">
              {headers.map(header => (
                <td key={header} className="px-6 py-3 font-mono">
                  {header === 'qcFlag' ? (
                    dp.qcFlag !== undefined && dp.qcFlag !== null ? (
                        <div className="flex items-center justify-center">
                            <span
                                className="w-3 h-3 rounded-full border border-border-secondary"
                                style={{ backgroundColor: QC_FLAG_STYLES[dp.qcFlag]?.color || 'transparent' }}
                                title={QC_FLAG_STYLES[dp.qcFlag]?.title || 'Unknown'}
                            />
                        </div>
                    ) : (
                        '-'
                    )
                  ) : (
                    dp[header] === null || dp[header] === undefined ? '-' : typeof dp[header] === 'number' ? (dp[header] as number).toFixed(4) : String(dp[header])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasAverages && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-background-primary/80 backdrop-blur-sm border-t-2 border-accent-primary shadow-lg">
                {headers.map(header => (
                  <td key={`avg-${header}`} className="px-6 py-3 font-mono font-bold text-accent-primary whitespace-nowrap">
                    {header.toLowerCase() === 'subsection' ? (
                        <span className="text-content-primary font-bold uppercase text-xs">Average</span>
                    ) : (
                        getAverage(header) || '—'
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
        )}
      </table>
    </div>
  );
};

export default DataTable;
