
import React, { useState, useMemo, useEffect } from 'react';
import type { Section, DataPoint, Source } from '../types';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Label, Line, Customized } from 'recharts';
import { GitMerge, Loader2, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
import { interpretProxyCorrelation } from '../services/geminiService';

interface ProxyCorrelationTabProps {
  section: Section;
  proxyLabels: Record<string, string>;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean }) => void;
  initialProxyX?: string | null;
  initialProxyY?: string | null;
}

const RegressionAnnotation = ({ points, data, rSquared }: { points: any[], data: any, rSquared: number }) => {
    if (!points || points.length === 0 || !data || !rSquared) return null;
    const { width, height } = data;
    const xPos = points[0].x + (width / 20);
    const yPos = height / 10;
    
    return (
        <g>
            <text x={xPos} y={yPos} className="regression-annotation">
                R² = {rSquared.toFixed(4)}
            </text>
        </g>
    );
};


const ProxyCorrelationTab: React.FC<ProxyCorrelationTabProps> = ({ section, proxyLabels, setToast, initialProxyX, initialProxyY }) => {
    const [proxyX, setProxyX] = useState<string>('');
    const [proxyY, setProxyY] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [interpretation, setInterpretation] = useState<{ summary: string; sources: Source[] } | null>(null);

    const availableProxies = useMemo(() => {
        const proxies = new Set<string>();
        section.dataPoints.forEach(dp => {
            Object.keys(dp).forEach(key => {
                if (typeof dp[key] === 'number' && key !== 'depth' && key !== 'age' && key !== 'subsection') {
                    proxies.add(key);
                }
            });
        });
        return Array.from(proxies);
    }, [section.dataPoints]);

    useEffect(() => {
        if (initialProxyX && initialProxyY && availableProxies.includes(initialProxyX) && availableProxies.includes(initialProxyY)) {
            setProxyX(initialProxyX);
            setProxyY(initialProxyY);
        } else if (availableProxies.length > 0) {
            setProxyX(availableProxies.includes('delta18O') ? 'delta18O' : availableProxies[0]);
            if (availableProxies.length > 1) {
                const secondProxy = availableProxies.find(p => p !== (availableProxies.includes('delta18O') ? 'delta18O' : availableProxies[0]));
                setProxyY(secondProxy || '');
            } else {
                setProxyY('');
            }
        } else {
            setProxyX('');
            setProxyY('');
        }
    }, [availableProxies, initialProxyX, initialProxyY, section.id]);

    const { correlationData, regressionLineData, rSquared } = useMemo(() => {
        if (!proxyX || !proxyY) return { correlationData: [], regressionLineData: [], rSquared: 0 };
        const data = section.dataPoints
            .filter(dp => typeof dp[proxyX] === 'number' && typeof dp[proxyY] === 'number')
            .map(dp => ({
                x: dp[proxyX] as number,
                y: dp[proxyY] as number,
            }));
        
        if (data.length < 2) return { correlationData: data, regressionLineData: [], rSquared: 0 };
        
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        data.forEach(({ x, y }) => {
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
            sumY2 += y * y;
        });

        const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const b = (sumY - m * sumX) / n;
        const r = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const R2 = r * r;

        const xValues = data.map(p => p.x);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);

        const lineData = [
            { x: minX, y: m * minX + b },
            { x: maxX, y: m * maxX + b },
        ];
        
        return { correlationData: data, regressionLineData: lineData, rSquared: R2 };
    }, [section.dataPoints, proxyX, proxyY]);
    
    const handleInterpret = async () => {
        if (!proxyX || !proxyY || correlationData.length === 0) {
            setToast({ message: 'Please select two different proxies with available data.', type: 'error', show: true });
            return;
        }
        setIsLoading(true);
        setError(null);
        setInterpretation(null);
        try {
            const result = await interpretProxyCorrelation(proxyLabels[proxyX] || proxyX, proxyLabels[proxyY] || proxyY, correlationData);
            setInterpretation(result);
        } catch (err: any) {
            setError(err.message);
            setToast({ message: `Error getting interpretation: ${err.message}`, type: 'error', show: true });
        } finally {
            setIsLoading(false);
        }
    };
    
    const selectClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8";
    const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;


    if (availableProxies.length < 2) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-background-tertiary/50 rounded-xl text-content-muted border border-border-primary/50">
                <GitMerge size={48} className="mb-4" />
                <h3 className="text-lg font-semibold text-content-primary">Not Enough Data for Correlation</h3>
                <p>This section needs at least two different measured proxies to perform a correlation analysis.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label htmlFor="proxyX" className="block text-sm font-medium text-content-secondary mb-1">X-Axis Proxy</label>
                        <select id="proxyX" value={proxyX} onChange={e => setProxyX(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                            {availableProxies.map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="proxyY" className="block text-sm font-medium text-content-secondary mb-1">Y-Axis Proxy</label>
                        <select id="proxyY" value={proxyY} onChange={e => setProxyY(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                            {availableProxies.filter(p => p !== proxyX).map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                        </select>
                    </div>
                </div>

                <div className="h-96 w-full">
                    <ResponsiveContainer>
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="x" name={proxyLabels[proxyX] || proxyX} domain={['dataMin', 'dataMax']} tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}>
                                <Label value={proxyLabels[proxyX] || proxyX} offset={-25} position="insideBottom" />
                            </XAxis>
                            <YAxis type="number" dataKey="y" name={proxyLabels[proxyY] || proxyY} domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'var(--recharts-axis-stroke)' }}>
                                <Label value={proxyLabels[proxyY] || proxyY} angle={-90} offset={-25} position="insideLeft" style={{ textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name={`${section.name} data`} data={correlationData} fill="var(--accent-primary)" />
                             {regressionLineData.length > 0 && (
                                <Line
                                    data={regressionLineData}
                                    dataKey="y"
                                    stroke="var(--accent-secondary)"
                                    strokeWidth={2}
                                    dot={false}
                                    name="Linear Regression"
                                    isAnimationActive={false}
                                />
                            )}
                            {rSquared > 0 && (
                               <Customized component={(props: any) => <RegressionAnnotation {...props} rSquared={rSquared} />} />
                            )}
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50">
                 <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-3"><Sparkles size={20} className="text-accent-primary"/> AI Interpretation</h3>
                 <button onClick={handleInterpret} disabled={isLoading || !proxyX || !proxyY} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/80 text-accent-primary-text hover:bg-accent-primary transition-colors text-sm font-semibold disabled:bg-background-interactive disabled:cursor-wait">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isLoading ? 'Interpreting...' : 'Interpret Relationship with AI'}
                </button>
                {error && <p className="text-danger-primary text-xs mt-2">{error}</p>}
                {interpretation && (
                    <div className="mt-4 p-4 bg-background-primary/50 rounded-lg animate-fade-in-fast space-y-4">
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 text-content-secondary">
                             {interpretation.summary.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                        </div>
                         {interpretation.sources.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-content-secondary mb-2">Relevant Sources:</h4>
                                <ul className="space-y-1">
                                    {interpretation.sources.map((source, i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs">
                                            <ExternalLink size={12} className="text-accent-secondary flex-shrink-0" />
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-content-muted hover:text-accent-secondary hover:underline truncate" title={source.title}>
                                                {source.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
             <style>{`
                @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ProxyCorrelationTab;
