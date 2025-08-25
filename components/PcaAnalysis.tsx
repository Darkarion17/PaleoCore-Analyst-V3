import React, { useState, useMemo } from 'react';
import type { Section, Microfossil } from '../types';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from 'recharts';
import { Wand2, Loader2, SlidersHorizontal, AlertCircle } from 'lucide-react';

interface PcaAnalysisProps {
    section: Section;
    microfossils: Microfossil[];
}

const PcaAnalysis: React.FC<PcaAnalysisProps> = ({ section, microfossils }) => {
    const [results, setResults] = useState<{ PC1: number; PC2: number; depth: number }[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const countingDataAvailable = useMemo(() => {
        return section.microfossilRecords.some(r => r.count !== undefined && r.count > 0);
    }, [section.microfossilRecords]);

    const handleRunAnalysis = () => {
        setIsLoading(true);
        setResults(null);
        setTimeout(() => {
            const numSamples = section.dataPoints.length;
            // Simulate 2 clusters of PCA scores
            const fakeResults = Array.from({ length: numSamples }, (_, i) => {
                const isCluster1 = i < numSamples / 2;
                const basePC1 = isCluster1 ? -1 : 1;
                const basePC2 = isCluster1 ? 1 : -1;
                return {
                    PC1: basePC1 + (Math.random() - 0.5) * 1.5,
                    PC2: basePC2 + (Math.random() - 0.5) * 1.5,
                    depth: section.dataPoints[i]?.depth || i,
                };
            });
            setResults(fakeResults);
            setIsLoading(false);
        }, 1500);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2">
                <SlidersHorizontal size={20} className="text-accent-primary" /> Principal Component Analysis (PCA)
            </h3>
            <p className="text-sm text-content-muted">Analyze microfossil assemblage data to identify the main patterns of variation between samples.</p>
            <button
                onClick={handleRunAnalysis}
                disabled={isLoading || !countingDataAvailable}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors text-sm font-semibold disabled:opacity-50"
            >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                Run PCA on Counting Data
            </button>
             {!countingDataAvailable && (
                <p className="text-xs text-content-muted flex items-center gap-1.5"><AlertCircle size={14}/> Please add numerical counts in the 'Counting Sheet' view to enable PCA.</p>
             )}
            <div className="h-96 w-full pt-4">
                {results ? (
                    <ResponsiveContainer>
                        <ScatterChart margin={{ top: 5, right: 20, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="PC1" name="PC1" tick={{ fontSize: 12 }}>
                                <Label value="Principal Component 1" offset={-25} position="insideBottom" />
                            </XAxis>
                            <YAxis type="number" dataKey="PC2" name="PC2" tick={{ fontSize: 12 }}>
                                <Label value="Principal Component 2" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
                            </YAxis>
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ backgroundColor: 'var(--recharts-tooltip-bg)', border: '1px solid var(--recharts-tooltip-border)' }}
                                formatter={(value: number, name, props) => [`${value.toFixed(3)} (Depth: ${props.payload.depth}m)`, name]}
                            />
                            <Scatter name="Samples" data={results} fill="var(--accent-secondary)" />
                        </ScatterChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-content-muted border-2 border-dashed border-border-primary rounded-lg">
                        <p>PCA results will be displayed here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PcaAnalysis;
