import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Core, Section } from '../types';
import MultiSectionChart from './MultiSectionChart';
import { LR04_DATA } from '../data/lr04';

interface QuickCompareModalProps {
    isOpen: boolean;
    onClose: () => void;
    coreIds: string[];
    allSections: Section[];
    cores: Core[];
    proxyLabels: Record<string, string>;
}

const QuickCompareModal: React.FC<QuickCompareModalProps> = ({ isOpen, onClose, coreIds, allSections, cores, proxyLabels }) => {
    const [sections, setSections] = useState<Section[]>([]);
    
    useEffect(() => {
        if (isOpen && coreIds.length === 2) {
            const sectionsForCores = allSections.filter(s => coreIds.includes(s.core_id));
            setSections(sectionsForCores);
        } else {
            setSections([]);
        }
    }, [isOpen, coreIds, allSections]);

    const core1 = useMemo(() => cores.find(c => c.id === coreIds[0]), [cores, coreIds]);
    const core2 = useMemo(() => cores.find(c => c.id === coreIds[1]), [cores, coreIds]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-fast" onClick={onClose}>
            <div className="bg-background-tertiary rounded-xl shadow-2xl p-8 w-full max-w-5xl border border-border-primary m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-content-primary">Quick Compare</h2>
                        <p className="text-sm text-content-muted">Comparing {core1?.id} vs {core2?.id}</p>
                    </div>
                    <button onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors"><X size={24} /></button>
                </div>

                <div className="flex-grow overflow-y-auto -mr-4 pr-4">
                    {sections.length > 0 ? (
                        <MultiSectionChart
                            sections={sections}
                            spliceData={[]}
                            proxyKey="delta18O" // Default to d18O for quick compare
                            xAxisKey="depth"
                            showLr04={false}
                            lr04Data={LR04_DATA}
                            proxyLabels={proxyLabels}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-content-muted">
                            <Loader2 className="animate-spin" size={32} />
                            <p className="mt-4">Loading section data...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuickCompareModal;
