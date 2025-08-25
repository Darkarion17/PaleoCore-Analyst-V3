import React, { useState, useMemo } from 'react';
import type { Section } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label, ReferenceLine } from 'recharts';
import { Wand2, Loader2, GitCommit } from 'lucide-react';

interface CrossCorrelationAnalysisProps {
    section: Section;
    proxyLabels: Record<string, string>;
}

const CrossCorrelationAnalysis: React.FC<CrossCorrelationAnalysisProps> = ({ section, proxyLabels }) => {
    const [proxy1, setProxy1] = useState('');
    const [proxy2, setProxy2] = useState('');
    const [results, setResults] = useState<{ lag: number; correlation: number }[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const availableProxies = useMemo(() => {
        const proxies = new Set<string>();
        section.dataPoints.forEach(dp => {
            Object.keys(dp).forEach(key => {
                if (typeof dp[key] === 'number' && key !== 'depth' && key !== 'age') {
                    proxies.add(key);
                }
            });
        });
        return Array.from(proxies);
    }, [section.dataPoints]);

    React.useEffect(() => {
        if (availableProxies.length > 0) {
            setProxy1(availableProxies[0]);
            if (availableProxies.length > 1) {
                setProxy2(availableProxies[1]);
            }
        }
    }, [availableProxies]);

    const handleRunAnalysis = () => {
        setIsLoading(true);
        setResults(null);
        setTimeout(() => {
            const fakeResults = Array.from({ length: 41 }, (_, i) => {
                const lag = i - 20; // from -20 to 20
                // Simulate a peak correlation at a certain lag
                const peakLag = Math.floor(Math.random() * 10 - 5);
                const correlation = Math.exp(-Math.pow(lag - peakLag, 2) / (2 * Math.pow(5, 2))) * (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.4 + 0.4);
                return { lag, correlation };
            });
            setResults(fakeResults);
            setIsLoading(false);
        }, 1500);
    };
    
    const selectClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8";
    const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                <GitCommit size={20} className="text-accent-primary" /> Cross-Correlation (Leads/Lags)
            </h3>
            <p className="text-sm text-content-muted">Analyze the relationship between two proxies over time to determine which one leads or lags the other.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Proxy 1 (Reference)</label>
                    <select value={proxy1} onChange={e => setProxy1(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                        {availableProxies.map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Proxy 2</label>
                    <select value={proxy2} onChange={e => setProxy2(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                        {availableProxies.filter(p => p !== proxy1).map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                    </select>
                </div>
                <button onClick={handleRunAnalysis} disabled={isLoading || !proxy1 || !proxy2} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors text-sm font-semibold disabled:opacity-50">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Run Analysis
                </button>
            </div>
            <div className="h-96 w-full pt-4">
                 {results ? (
                    <ResponsiveContainer>
                        <LineChart data={results} margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="lag" type="number" domain={['auto', 'auto']} tick={{ fontSize: 12 }}>
                                <Label value={`Lag (positive = ${proxy2} lags ${proxy1})`} offset={-25} position="insideBottom" />
                            </XAxis>
                            <YAxis type="number" domain={[-1, 1]} tick={{ fontSize: 12 }}>
                                <Label value="Correlation Coeff." angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--recharts-tooltip-bg)', border: '1px solid var(--recharts-tooltip-border)' }}
                                labelFormatter={(label) => `Lag: ${label}`}
                            />
                            <ReferenceLine y={0} stroke="var(--border-secondary)" />
                            <Line type="monotone" dataKey="correlation" stroke="var(--accent-secondary)" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                     <div className="flex items-center justify-center h-full text-content-muted border-2 border-dashed border-border-primary rounded-lg">
                        <p>Analysis results will be displayed here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrossCorrelationAnalysis;
