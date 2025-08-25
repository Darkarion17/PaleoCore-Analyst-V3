import React, { useState, useEffect } from 'react';
import type { Section, AiInsight } from '../types';
import { generateProactiveInsights } from '../services/geminiService';
import { Loader2, AlertCircle, Lightbulb, GitMerge, BarChart, Info, ArrowRight } from 'lucide-react';

interface AiInsightsPanelProps {
    section: Section;
    proxyLabels: Record<string, string>;
    onNavigateToCorrelation: (proxyX: string, proxyY: string) => void;
}

const InsightCard: React.FC<{ insight: AiInsight; onAction: () => void; }> = ({ insight, onAction }) => {
    const icons: Record<AiInsight['type'], React.ReactNode> = {
        anomaly: <BarChart size={20} />,
        correlation: <GitMerge size={20} />,
        comparison: <Info size={20} />,
        info: <Lightbulb size={20} />,
    };

    const actionText: Partial<Record<AiInsight['type'], string>> = {
        correlation: 'Run Correlation',
    };

    const hasAction = insight.type === 'correlation' && insight.details?.proxy1 && insight.details?.proxy2;

    return (
        <div className="bg-background-primary/40 p-3 rounded-lg border border-border-primary/50 transition-all hover:border-accent-primary/50">
            <div className="flex justify-between items-start gap-3">
                <div className="flex-shrink-0 text-accent-primary pt-1">{icons[insight.type]}</div>
                <div className="flex-grow">
                    <h4 className="font-bold text-content-primary text-sm">{insight.title}</h4>
                    <p className="text-xs text-content-secondary mt-1">{insight.summary}</p>
                    {hasAction && (
                        <button
                            onClick={onAction}
                            className="text-xs font-bold text-accent-primary hover:text-accent-primary-hover mt-2 flex items-center gap-1.5 transition-colors"
                        >
                            {actionText[insight.type]} <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({ section, proxyLabels, onNavigateToCorrelation }) => {
    const [insights, setInsights] = useState<AiInsight[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchInsights = async () => {
            if (!section || section.dataPoints.length < 5) {
                setInsights([{
                    type: 'info',
                    title: 'More Data Needed',
                    summary: 'Not enough data points in this section to generate meaningful insights. Add at least 5 data points.'
                }]);
                setIsLoading(false);
                return;
            }
            
            setIsLoading(true);
            setError(null);
            try {
                const results = await generateProactiveInsights(section);
                setInsights(results);
            } catch (err: any) {
                setError(err.message || "Failed to fetch insights.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
    }, [section]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center gap-3 text-content-muted">
                    <Loader2 size={20} className="animate-spin" />
                    <span>Analyzing data for insights...</span>
                </div>
            );
        }
        if (error) {
            return (
                <div className="flex items-center gap-3 text-danger-primary">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            );
        }
        if (insights.length === 0) {
            return (
                <div className="flex items-center gap-3 text-content-muted">
                    <Lightbulb size={20} />
                    <span>No specific insights found for this section.</span>
                </div>
            );
        }
        return (
            <div className="space-y-3">
                {insights.map((insight, index) => (
                    <InsightCard
                        key={index}
                        insight={insight}
                        onAction={() => {
                            if (insight.type === 'correlation' && insight.details?.proxy1 && insight.details?.proxy2) {
                                onNavigateToCorrelation(insight.details.proxy1, insight.details.proxy2);
                            }
                        }}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50 min-h-[150px]">
             <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-4">
                <Lightbulb size={20} className="text-accent-primary"/> AI Insights
            </h3>
            {renderContent()}
        </div>
    );
};

export default AiInsightsPanel;