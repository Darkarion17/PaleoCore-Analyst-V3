import React, { useState, useMemo } from 'react';
import type { Section } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { Wand2, Loader2, AreaChart, AlertCircle } from 'lucide-react';

interface SpectralAnalysisProps {
    section: Section;
    proxyLabels: Record<string, string>;
}

const SpectralAnalysis: React.FC<SpectralAnalysisProps> = ({ section, proxyLabels }) => {
    const [selectedProxy, setSelectedProxy] = useState('');
    const [selectedDomain, setSelectedDomain] = useState<'age' | 'depth'>('depth');
    const [results, setResults] = useState<{ frequency: number; power: number; period: number; }[] | null>(null);
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
        if (availableProxies.length > 0 && !availableProxies.includes(selectedProxy)) {
            setSelectedProxy(availableProxies[0]);
        }
    }, [availableProxies, selectedProxy]);

    const handleRunAnalysis = () => {
        setIsLoading(true);
        setResults(null);
        // Simulate an API call and complex calculation
        setTimeout(() => {
            // Generate plausible but fake periodogram data
            const fakeResults = Array.from({ length: 50 }, (_, i) => {
                const baseFrequency = (i + 1) * 0.002;
                let power = Math.random() * 0.2;
                // Add some peaks to simulate cycles (e.g., Milankovitch)
                if (Math.abs(1 / baseFrequency - 23) < 2) power += Math.random() * 0.5 + 0.3; // Precession
                if (Math.abs(1 / baseFrequency - 41) < 2) power += Math.random() * 0.8 + 0.5; // Obliquity
                if (Math.abs(1 / baseFrequency - 100) < 5) power += Math.random() * 1.2 + 0.8; // Eccentricity
                return {
                    frequency: baseFrequency,
                    period: 1 / baseFrequency,
                    power: power,
                };
            });
            setResults(fakeResults);
            setIsLoading(false);
        }, 1500);
    };
    
    const hasAgeData = useMemo(() => section.dataPoints.some(dp => dp.age !== undefined && dp.age !== null), [section.dataPoints]);
    const selectClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8";
    const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                <AreaChart size={20} className="text-accent-primary" /> Spectral Analysis (Periodogram)
            </h3>
            <p className="text-sm text-content-muted">Detect cyclical patterns in your data, such as Milankovitch cycles, by analyzing their frequency components.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Proxy</label>
                    <select value={selectedProxy} onChange={e => setSelectedProxy(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                        {availableProxies.map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-xs font-medium text-content-secondary mb-1">Domain</label>
                    <select value={selectedDomain} onChange={e => setSelectedDomain(e.target.value as any)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                        <option value="depth">Depth</option>
                        <option value="age" disabled={!hasAgeData}>Age (ka)</option>
                    </select>
                </div>
                <button onClick={handleRunAnalysis} disabled={isLoading || !selectedProxy} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors text-sm font-semibold disabled:opacity-50">
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Run Analysis
                </button>
            </div>
            <div className="h-96 w-full pt-4">
                {results ? (
                    <ResponsiveContainer>
                        <BarChart data={results} margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" type="number" domain={[0, 'dataMax']} tickFormatter={(tick) => tick.toFixed(0)} tick={{ fontSize: 12 }}>
                                <Label value={`Period (${selectedDomain === 'age' ? 'ka' : 'm'})`} offset={-25} position="insideBottom" />
                            </XAxis>
                            <YAxis tick={{ fontSize: 12 }}>
                                <Label value="Spectral Power" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--recharts-tooltip-bg)', border: '1px solid var(--recharts-tooltip-border)' }}
                                labelFormatter={(label) => `Period: ${Number(label).toFixed(1)}`}
                            />
                            <Bar dataKey="power" fill="var(--accent-secondary)" />
                        </BarChart>
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

export default SpectralAnalysis;
