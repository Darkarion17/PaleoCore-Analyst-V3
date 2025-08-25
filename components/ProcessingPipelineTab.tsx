import React, { useState, useMemo } from 'react';
import type { Section, ProcessingPipeline } from '../types';
import { TestTube, PlusCircle, Save, Trash2 } from 'lucide-react';

interface ProcessingPipelineTabProps {
    section: Section;
    onUpdateSection: (section: Section) => void;
    proxyLabels: Record<string, string>;
}

const ProcessingPipelineTab: React.FC<ProcessingPipelineTabProps> = ({ section, onUpdateSection, proxyLabels }) => {
    const [pipelines, setPipelines] = useState<ProcessingPipeline[]>(section.pipelines || []);
    const [newPipelineName, setNewPipelineName] = useState('');
    const [newPipelineSource, setNewPipelineSource] = useState('');
    const [movingAverageWindow, setMovingAverageWindow] = useState(3);
    
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

    const handleAddPipeline = () => {
        if (!newPipelineName.trim() || !newPipelineSource) return;

        const newPipeline: ProcessingPipeline = {
            id: `pipe_${Date.now()}`,
            name: newPipelineName.trim(),
            sourceProxy: newPipelineSource,
            steps: [{ type: 'movingAverage', window: movingAverageWindow }],
        };
        
        const updatedPipelines = [...pipelines, newPipeline];
        setPipelines(updatedPipelines);
        onUpdateSection({ ...section, pipelines: updatedPipelines });

        // Reset form
        setNewPipelineName('');
        setNewPipelineSource('');
        setMovingAverageWindow(3);
    };

    const handleDeletePipeline = (id: string) => {
        const updatedPipelines = pipelines.filter(p => p.id !== id);
        setPipelines(updatedPipelines);
        onUpdateSection({ ...section, pipelines: updatedPipelines });
    };

    const selectClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8 disabled:cursor-not-allowed disabled:bg-background-tertiary";
    const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
    const inputClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition";

    return (
        <div className="space-y-6">
            <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
                <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-2">
                    <TestTube size={20} className="text-accent-primary" /> Create New Processing Pipeline
                </h3>
                <p className="text-xs text-content-muted mb-4">
                    Create new "virtual" proxies by applying non-destructive processing steps to your raw data. These will be available for plotting in the dashboard.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-content-secondary mb-1">1. Select Source Proxy</label>
                        <select value={newPipelineSource} onChange={e => setNewPipelineSource(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                            <option value="">Select a proxy...</option>
                            {availableProxies.map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-content-secondary mb-1">2. Define Processing (Moving Average)</label>
                        <input
                            type="number"
                            value={movingAverageWindow}
                            onChange={e => setMovingAverageWindow(Math.max(2, parseInt(e.target.value, 10)))}
                            min="2"
                            className={inputClass}
                            placeholder="Window size (e.g., 3)"
                        />
                    </div>
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                         <div>
                            <label className="block text-xs font-medium text-content-secondary mb-1">3. Name New Virtual Proxy</label>
                            <input
                                type="text"
                                value={newPipelineName}
                                onChange={e => setNewPipelineName(e.target.value)}
                                className={inputClass}
                                placeholder="e.g., d18O_smoothed"
                            />
                        </div>
                        <button onClick={handleAddPipeline} disabled={!newPipelineName || !newPipelineSource} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors text-sm font-semibold disabled:opacity-50">
                            <PlusCircle size={16} /> Save New Pipeline
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50">
                 <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-3">Saved Pipelines</h3>
                 <div className="space-y-3 max-h-64 overflow-y-auto pr-2 -mr-2">
                    {pipelines.length > 0 ? pipelines.map(p => (
                        <div key={p.id} className="bg-background-primary/50 p-3 rounded-md flex justify-between items-center">
                            <div>
                                <p className="font-bold text-content-primary">{p.name}</p>
                                <p className="text-xs text-content-muted">
                                    Source: {proxyLabels[p.sourceProxy] || p.sourceProxy} | Steps: {p.steps.map(s => `MA(${s.window})`).join(', ')}
                                </p>
                            </div>
                            <button onClick={() => handleDeletePipeline(p.id)} className="p-2 rounded-full text-content-muted hover:text-danger-primary hover:bg-danger-primary/10 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )) : (
                        <p className="text-sm text-content-muted text-center py-4">No processing pipelines have been created for this section yet.</p>
                    )}
                 </div>
            </div>
        </div>
    );
};

export default ProcessingPipelineTab;
