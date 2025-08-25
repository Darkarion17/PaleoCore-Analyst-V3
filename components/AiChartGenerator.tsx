import React, { useState, useMemo } from 'react';
import type { Core, Section } from '../types';
import { generateChartConfigFromQuery } from '../services/geminiService';
import { Loader2, AlertCircle, LineChart as LineChartIcon, Sparkles } from 'lucide-react';
import DynamicChartRenderer from './DynamicChartRenderer';

interface AiChartGeneratorProps {
    cores: Core[];
    allUserSections: Section[];
    proxyLabels: Record<string, string>;
    setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean }) => void;
}

const AiChartGenerator: React.FC<AiChartGeneratorProps> = ({ cores, allUserSections, proxyLabels, setToast }) => {
    const [query, setQuery] = useState('');
    const [chartConfig, setChartConfig] = useState<any | null>(null);
    const [chartData, setChartData] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableProxies = useMemo(() => {
        const proxies = new Set<string>();
        allUserSections.forEach(section => {
            section.dataPoints.forEach(dp => {
                Object.keys(dp).forEach(key => {
                    if (key !== 'subsection') proxies.add(key);
                });
            });
        });
        return Array.from(proxies);
    }, [allUserSections]);

    const handleGenerateChart = async () => {
        if (!query.trim()) {
            setToast({ message: 'Please enter a description for the chart you want to generate.', type: 'info', show: true });
            return;
        }

        setIsLoading(true);
        setError(null);
        setChartConfig(null);
        setChartData(null);

        try {
            const config = await generateChartConfigFromQuery(query, cores, allUserSections, availableProxies);
            setChartConfig(config);

            const processedData = processChartData(config, allUserSections);
            setChartData(processedData);

        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    // This is the core data processing logic
    const processChartData = (config: any, sections: Section[]): any[] => {
        if (!config || !config.dataSeries || !config.xAxis?.key) return [];
        
        const xAxisKey = config.xAxis.key;
        const mergedData = new Map<any, any>();

        for (const series of config.dataSeries) {
            const section = sections.find(s => s.core_id === series.coreId && s.name === series.sectionName);
            if (!section) continue;

            let dataPoints = [...section.dataPoints];

            // Apply filters if any
            if (series.filters) {
                for (const filter of series.filters) {
                    dataPoints = dataPoints.filter(dp => {
                        const value = dp[filter.key];
                        if (value === undefined || value === null) return false;
                        if (filter.condition === 'lessThan') return value < filter.value;
                        if (filter.condition === 'greaterThan') return value > filter.value;
                        return true;
                    });
                }
            }
            
            // Merge data into the map
            for (const point of dataPoints) {
                const xValue = point[xAxisKey];
                const yValue = point[config.yAxis.key];

                if (xValue !== undefined && xValue !== null && yValue !== undefined && yValue !== null) {
                    const existingEntry = mergedData.get(xValue) || { [xAxisKey]: xValue };
                    mergedData.set(xValue, { ...existingEntry, [series.label]: yValue });
                }
            }
        }

        // Convert map to sorted array
        return Array.from(mergedData.values()).sort((a, b) => a[xAxisKey] - b[xAxisKey]);
    };


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-content-primary flex items-center gap-3"><Sparkles /> AI Chart Generator</h1>
            <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
                <h2 className="text-xl font-semibold text-content-primary">Describe the Chart You Want to Create</h2>
                <p className="text-sm text-content-muted mt-1 mb-4">
                    For example: "Plot δ¹⁸O for ODP-982A and V28-238 vs age for the last 500ka"
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Describe your desired chart here..."
                        rows={3}
                        className="w-full bg-background-interactive border border-border-secondary rounded-lg p-3 text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleGenerateChart}
                        disabled={isLoading}
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-accent-primary text-accent-primary-text font-bold hover:bg-accent-primary-hover transition-all duration-200 shadow-lg disabled:bg-background-interactive disabled:cursor-wait"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                        Generate
                    </button>
                </div>
            </div>

            <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50 min-h-[500px] flex flex-col justify-center items-center">
                {isLoading && (
                    <div className="text-content-muted text-center">
                        <Loader2 size={32} className="animate-spin mb-4 mx-auto" />
                        <p className="font-semibold">PaleoAI is thinking...</p>
                        <p className="text-sm">Generating chart configuration and processing data.</p>
                    </div>
                )}
                {error && !isLoading && (
                     <div className="text-danger-primary text-center">
                        <AlertCircle size={32} className="mb-4 mx-auto" />
                        <p className="font-semibold">Chart Generation Failed</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                {!isLoading && !error && !chartData && (
                    <div className="text-content-muted text-center">
                        <LineChartIcon size={48} className="mb-4 mx-auto" />
                        <h3 className="text-lg font-semibold text-content-primary">Your Chart Will Appear Here</h3>
                        <p>Describe your chart above to get started.</p>
                    </div>
                )}
                {chartData && chartConfig && !isLoading && (
                    <div className="w-full animate-fade-in">
                        <h3 className="text-xl font-bold text-content-primary text-center mb-4">{chartConfig.title}</h3>
                        <DynamicChartRenderer config={chartConfig} data={chartData} proxyLabels={proxyLabels} />
                    </div>
                )}
            </div>
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.4s ease-out; }
            `}</style>
        </div>
    );
};

export default AiChartGenerator;
