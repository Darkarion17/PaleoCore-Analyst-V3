import React, { useState, useMemo, useEffect } from 'react';
import type { Section, Microfossil, SectionFossilRecord, FossilAbundance } from '../types';
import { Sheet, Loader2, Save, AlertCircle } from 'lucide-react';

interface CountingSheetViewProps {
    allSections: Section[];
    allFossils: Microfossil[];
    onUpdateSection: (section: Section) => void;
    setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean }) => void;
}

const percentageToAbundance = (percentage: number): FossilAbundance => {
    if (percentage > 20) return 'Abundant';
    if (percentage > 10) return 'Common';
    if (percentage > 2) return 'Few';
    if (percentage > 0) return 'Rare';
    return 'Barren';
};

const CountingSheetView: React.FC<CountingSheetViewProps> = ({ allSections, allFossils, onUpdateSection, setToast }) => {
    const [selectedSectionId, setSelectedSectionId] = useState<string>('');
    const [counts, setCounts] = useState<Record<string, Record<string, number | undefined>>>({});

    const selectedSection = useMemo(() => allSections.find(s => s.id === selectedSectionId), [allSections, selectedSectionId]);

    useEffect(() => {
        // Initialize counts from existing records when a section is selected
        if (selectedSection) {
            const initialCounts: Record<string, Record<string, number | undefined>> = {};
            selectedSection.microfossilRecords.forEach(record => {
                if (!initialCounts[record.fossilId]) {
                    initialCounts[record.fossilId] = {};
                }
                // Here we assume depth is unique enough to be an identifier. This might need improvement for real data.
                // For this implementation, we will use the index of datapoint as a sample identifier.
                 selectedSection.dataPoints.forEach((dp, index) => {
                    // This is a simplified linking. In a real scenario, samples would have unique IDs.
                    // We're pre-filling based on the fossil being *present* in the section, not tied to a specific depth.
                    // The user is expected to fill in the actual counts.
                    // Let's check if the record already has a count for a sample index
                    const existingRecordForSample = record; // Simplified assumption
                     if (existingRecordForSample.count !== undefined) {
                         initialCounts[record.fossilId][index] = existingRecordForSample.count;
                     }
                });
            });
            setCounts(initialCounts);
        } else {
            setCounts({});
        }
    }, [selectedSection]);


    const handleCountChange = (fossilId: string, sampleIndex: number, value: string) => {
        const newCount = value === '' ? undefined : parseInt(value, 10);
        setCounts(prev => ({
            ...prev,
            [fossilId]: {
                ...prev[fossilId],
                [sampleIndex]: isNaN(newCount!) ? undefined : newCount,
            }
        }));
    };
    
    const totalsBySample = useMemo(() => {
        const totals: Record<number, number> = {};
        if (selectedSection) {
            selectedSection.dataPoints.forEach((_, sampleIndex) => {
                let total = 0;
                Object.keys(counts).forEach(fossilId => {
                    total += counts[fossilId]?.[sampleIndex] || 0;
                });
                totals[sampleIndex] = total;
            });
        }
        return totals;
    }, [counts, selectedSection]);

    const handleSaveChanges = () => {
        if (!selectedSection) return;

        const updatedRecords: SectionFossilRecord[] = [];

        // This is a simplified update logic. It assumes one record per fossil type for the entire section.
        // It will overwrite existing abundance records with new ones based on the counts.
        Object.keys(counts).forEach(fossilId => {
            const fossilCounts = counts[fossilId];
            let totalFossilCount = 0;
            let totalSampleCount = 0;

            Object.values(fossilCounts).forEach(count => {
                if (count !== undefined) {
                    totalFossilCount += count;
                }
            });
            Object.values(totalsBySample).forEach(total => {
                 totalSampleCount += total;
            });
            
            const overallPercentage = totalSampleCount > 0 ? (totalFossilCount / totalSampleCount) * 100 : 0;
            const newAbundance = percentageToAbundance(overallPercentage);
            
            const existingRecord = selectedSection.microfossilRecords.find(r => r.fossilId === fossilId);

            updatedRecords.push({
                fossilId,
                abundance: newAbundance,
                preservation: existingRecord?.preservation || 'Moderate', // Keep old preservation or default
                observations: existingRecord?.observations || 'Count data updated.',
                count: totalFossilCount,
                percentage: parseFloat(overallPercentage.toFixed(2)),
            });
        });
        
        const updatedSection = { ...selectedSection, microfossilRecords: updatedRecords };
        onUpdateSection(updatedSection);
        setToast({ message: `Counts and abundances saved for section ${selectedSection.name}.`, type: 'success', show: true });
    };

    const selectClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8";
    const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;
    const fossilsForColumns = selectedSection ? allFossils.filter(f => selectedSection.microfossilRecords.some(r => r.fossilId === f.id)) : [];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-content-primary flex items-center gap-3"><Sheet /> Digital Counting Sheet</h1>
            <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
                <div className="flex justify-between items-end">
                    <div className="w-full max-w-sm">
                        <label className="block text-sm font-medium text-content-secondary mb-1">Select Section to Count</label>
                        <select
                            value={selectedSectionId}
                            onChange={e => setSelectedSectionId(e.target.value)}
                            className={selectClass}
                            style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                        >
                            <option value="">-- Select a Section --</option>
                            {allSections.map(s => <option key={s.id} value={s.id}>{s.core_id} / {s.name}</option>)}
                        </select>
                    </div>
                     <button
                        onClick={handleSaveChanges}
                        disabled={!selectedSection}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-accent-primary-text font-semibold hover:bg-accent-primary-hover transition disabled:bg-background-interactive"
                    >
                        <Save size={16}/> Save Counts to Section
                    </button>
                </div>

                {selectedSection ? (
                    <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-background-secondary">
                                    <th className="sticky left-0 bg-background-secondary p-2 border border-border-primary font-semibold text-content-secondary">Sample (Depth)</th>
                                    {fossilsForColumns.map(fossil => (
                                        <th key={fossil.id} className="p-2 border border-border-primary font-semibold text-content-secondary italic" title={`${fossil.taxonomy.genus} ${fossil.taxonomy.species}`}>{fossil.id}</th>
                                    ))}
                                    <th className="p-2 border border-border-primary font-semibold text-accent-primary">Total Count</th>
                                    <th className="p-2 border border-border-primary font-semibold text-accent-secondary">Percentages</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedSection.dataPoints.map((dp, sampleIndex) => (
                                    <tr key={sampleIndex} className="hover:bg-background-secondary/50">
                                        <td className="sticky left-0 bg-background-tertiary p-2 border border-border-primary text-content-primary font-mono">{dp.depth} m</td>
                                        {fossilsForColumns.map(fossil => (
                                            <td key={fossil.id} className="p-0 border border-border-primary">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={counts[fossil.id]?.[sampleIndex] || ''}
                                                    onChange={e => handleCountChange(fossil.id, sampleIndex, e.target.value)}
                                                    className="w-24 bg-transparent p-2 text-center text-content-primary outline-none focus:bg-background-interactive"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-2 border border-border-primary text-center font-bold text-accent-primary">{totalsBySample[sampleIndex] || 0}</td>
                                        <td className="p-2 border border-border-primary text-center text-accent-secondary">
                                            {totalsBySample[sampleIndex] > 0 ? (
                                                <div className="flex flex-col text-xs">
                                                    {fossilsForColumns.map(fossil => {
                                                         const percentage = ((counts[fossil.id]?.[sampleIndex] || 0) / totalsBySample[sampleIndex]) * 100;
                                                         return <span key={fossil.id}>{fossil.id}: {percentage.toFixed(1)}%</span>
                                                    })}
                                                </div>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="mt-6 flex flex-col items-center justify-center h-64 text-content-muted border-2 border-dashed border-border-primary rounded-lg">
                        <p>Select a section to begin counting microfossils.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CountingSheetView;
