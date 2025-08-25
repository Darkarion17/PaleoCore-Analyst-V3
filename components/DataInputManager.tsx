

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Section, DataPoint, LabAnalysis } from '../types';
import { Database, PlusCircle, Beaker, Filter, FileUp } from 'lucide-react';
import DataImportWizard from './DataImportWizard';

const calculateAveragesFromDataPoints = (dataPoints: DataPoint[]): LabAnalysis => {
    if (!dataPoints || dataPoints.length === 0) {
        return {};
    }
    const sums: { [key: string]: number } = {};
    const counts: { [key: string]: number } = {};
    const labAnalysisKeys: (keyof LabAnalysis)[] = [
        'delta18O', 'delta13C', 'mgCaRatio', 'tex86',
        'alkenoneSST', 'calculatedSST', 'baCa', 'srCa',
        'cdCa', 'radiocarbonDate'
    ];
    labAnalysisKeys.forEach(key => {
        sums[key] = 0;
        counts[key] = 0;
    });
    for (const point of dataPoints) {
        for (const key of labAnalysisKeys) {
            const value = point[key];
            if (typeof value === 'number' && isFinite(value)) {
                sums[key] += value;
                counts[key]++;
            }
        }
    }
    const averages: LabAnalysis = {};
    for (const key of labAnalysisKeys) {
        if (counts[key] > 0) {
            (averages as any)[key] = sums[key] / counts[key];
        }
    }
    return averages;
};

interface DataInputManagerProps {
  section: Section;
  onUpdateSection: (section: Section) => void;
  proxyLabels: Record<string, string>;
  commonDataKeys: Record<string, string[]>;
  onOpenCustomProxiesModal: () => void;
}

const staticManualEntryFields = [
    'depth', 'delta18O', 'delta13C', 'mgCaRatio', 'tex86',
    'alkenoneSST', 'baCa', 'srCa', 'cdCa', 'radiocarbonDate'
];

const DataInputManager: React.FC<DataInputManagerProps> = ({ section, onUpdateSection, proxyLabels, commonDataKeys, onOpenCustomProxiesModal }) => {
  const manualEntryFields = useMemo(() => {
    const customProxyKeys = Object.keys(proxyLabels).filter(
      key => !staticManualEntryFields.includes(key) && key !== 'subsection' && key !== 'age'
    );
    return ['subsection', ...staticManualEntryFields, ...customProxyKeys];
  }, [proxyLabels]);
  
  const createInitialState = useCallback(() => {
    const state: Record<string, string> = {
        subsection: `Sample ${section.dataPoints.length + 1}`
    };
    manualEntryFields.forEach(key => {
        state[key] = '';
    });
    return state;
  }, [section.dataPoints.length, manualEntryFields]);

  const [formState, setFormState] = useState(createInitialState);
  
  useEffect(() => {
      setFormState(createInitialState());
  }, [createInitialState]);
  
  const [status, setStatus] = useState<{type: 'success'|'error'|'info', msg: string} | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isProxyManagerOpen, setIsProxyManagerOpen] = useState(false);
  const proxyManagerRef = useRef<HTMLDivElement>(null);

  const [visibleProxies, setVisibleProxies] = useState<Set<string>>(() => {
    try {
        const saved = localStorage.getItem('paleocore-visible-proxies-v1');
        if (saved) {
            const parsed = JSON.parse(saved);
            return new Set(Array.isArray(parsed) ? parsed : ['subsection', 'depth', 'delta18O']);
        }
    } catch (e) {
        console.error("Failed to parse visible proxies from localStorage", e);
    }
    return new Set(['subsection', 'depth', 'delta18O', 'delta13C', 'mgCaRatio']);
  });

  useEffect(() => {
    try {
        localStorage.setItem('paleocore-visible-proxies-v1', JSON.stringify(Array.from(visibleProxies)));
    } catch (e) {
        console.error("Failed to save visible proxies to localStorage", e);
    }
  }, [visibleProxies]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (proxyManagerRef.current && !proxyManagerRef.current.contains(event.target as Node)) {
            setIsProxyManagerOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggleProxyVisibility = (key: string) => {
    setVisibleProxies(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        return newSet;
    });
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleAddDataPoint = () => {
    const subsectionId = formState.subsection.trim();
    if (!subsectionId) {
      setStatus({type: 'error', msg: 'Subsection ID is a required field.'});
      setTimeout(() => setStatus(null), 3000);
      return;
    }

    const newPointData: DataPoint = { subsection: subsectionId };
    let hasValue = false;

    for (const key in formState) {
        if (key !== 'subsection' && formState[key as keyof typeof formState]) {
            const numValue = parseFloat(formState[key as keyof typeof formState]);
            if (!isNaN(numValue)) {
                newPointData[key] = numValue;
                hasValue = true;
            }
        }
    }
    
    if (!hasValue) {
        setStatus({type: 'error', msg: 'At least one data value (e.g., depth) must be provided.'});
        setTimeout(() => setStatus(null), 3000);
        return;
    }

    const existingPointIndex = section.dataPoints.findIndex(dp => dp.subsection === subsectionId);
    let newDataPoints: DataPoint[];

    if (existingPointIndex > -1) {
        newDataPoints = [...section.dataPoints];
        newDataPoints[existingPointIndex] = { ...newDataPoints[existingPointIndex], ...newPointData };
        setStatus({type: 'success', msg: `Subsection "${subsectionId}" updated.`});
    } else {
        newDataPoints = [...section.dataPoints, newPointData];
        setStatus({type: 'success', msg: `Subsection "${subsectionId}" added.`});
    }
    
    newDataPoints.sort((a, b) => (a.depth || 0) - (b.depth || 0));
    
    const newLabAnalysis = calculateAveragesFromDataPoints(newDataPoints);
    onUpdateSection({ ...section, dataPoints: newDataPoints, labAnalysis: newLabAnalysis });
    
    setTimeout(() => setStatus(null), 3000);
  };
  
  const handleDataImport = (importedData: DataPoint[]) => {
      const sectionPointsMap = new Map(section.dataPoints.map(p => [p.subsection, p]));
      let updatedCount = 0;
      let addedCount = 0;

      importedData.forEach((newPoint, index) => {
          const subsectionId = newPoint.subsection;
          if (subsectionId && typeof subsectionId === 'string' && subsectionId.trim() !== '') {
              if (sectionPointsMap.has(subsectionId)) {
                  updatedCount++;
              } else {
                  addedCount++;
              }
              sectionPointsMap.set(subsectionId, { ...sectionPointsMap.get(subsectionId), ...newPoint });
          } else {
              const uniqueId = `Imported-${Date.now()}-${index}`;
              sectionPointsMap.set(uniqueId, { ...newPoint, subsection: uniqueId });
              addedCount++;
          }
      });

      const mergedPoints = Array.from(sectionPointsMap.values()).sort((a,b) => (a.depth || 0) - (b.depth || 0));
      const newLabAnalysis = calculateAveragesFromDataPoints(mergedPoints);

      onUpdateSection({ ...section, dataPoints: mergedPoints, labAnalysis: newLabAnalysis });
      
      const toast = {
        message: `${addedCount} new point(s) added, ${updatedCount} updated from import.`,
        type: 'success' as const,
        show: true
      };
      
      // Use a function that can be passed to the modal to show the toast on success
      return toast;
  };
  
  const inputClass = "w-full bg-background-interactive border border-border-secondary rounded-md p-2 text-sm text-content-primary placeholder-content-muted focus:ring-1 focus:ring-accent-primary focus:outline-none transition";
  const labelClass = "block text-xs font-medium text-content-secondary mb-1";
  
  return (
    <div className="space-y-6">
      {isWizardOpen && (
          <DataImportWizard 
              isOpen={isWizardOpen}
              onClose={() => setIsWizardOpen(false)}
              onImportConfirm={handleDataImport}
              commonDataKeys={commonDataKeys}
          />
      )}
      
      <div className="p-4 bg-background-primary/30 rounded-lg border border-border-primary">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2"><Database size={20} className="text-accent-primary"/> Manual Subsection Entry</h3>
            <div className="relative flex items-center gap-2">
                <button type="button" onClick={onOpenCustomProxiesModal} className="text-xs font-semibold flex items-center gap-1.5 p-2 rounded-md bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors">
                    <Beaker size={14} /> Manage Custom Proxies
                </button>
                <button type="button" onClick={() => setIsProxyManagerOpen(p => !p)} className="text-xs font-semibold flex items-center gap-1.5 p-2 rounded-md bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors">
                    <Filter size={14} /> Filter Proxies
                </button>
                {isProxyManagerOpen && (
                    <div ref={proxyManagerRef} className="absolute top-full right-0 mt-2 w-64 bg-background-primary p-3 rounded-lg shadow-2xl border border-border-secondary z-20">
                        <p className="text-sm font-bold mb-2 text-content-primary px-1">Visible Proxies</p>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {manualEntryFields.map(key => (
                                <label key={key} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-background-tertiary text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={visibleProxies.has(key)}
                                        onChange={() => handleToggleProxyVisibility(key)}
                                        disabled={key === 'subsection' || key === 'depth'}
                                        className="h-4 w-4 rounded border-border-secondary bg-background-interactive text-accent-primary focus:ring-accent-primary focus:ring-2 disabled:opacity-50"
                                    />
                                    <span className={key === 'subsection' || key === 'depth' ? 'text-content-muted' : 'text-content-secondary'}>
                                        {proxyLabels[key] || key}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
        <p className="text-xs text-content-muted mb-4">Enter a unique Subsection ID and one or more data values to add or update a point in the series.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="col-span-2">
                <label htmlFor="subsection" className={`${labelClass} text-accent-primary font-bold`}>{proxyLabels['subsection'] || 'Subsection ID*'}</label>
                <input type="text" name="subsection" value={formState.subsection} onChange={handleFormChange} className={inputClass} required />
            </div>
            <div className="col-span-2 md:col-span-1">
                <label htmlFor="depth" className={labelClass}>{proxyLabels['depth'] || 'Depth'}</label>
                <input type="number" step="any" name="depth" value={formState['depth']} onChange={handleFormChange} className={inputClass} />
            </div>
            {manualEntryFields
                .filter(key => key !== 'subsection' && key !== 'depth' && visibleProxies.has(key))
                .map(key => (
                    <div key={key}>
                        <label htmlFor={key} className={labelClass}>{proxyLabels[key] || key}</label>
                        <input type="number" step="any" name={key} value={formState[key] || ''} onChange={handleFormChange} className={inputClass} />
                    </div>
                ))
            }
        </div>
        <div className="flex justify-end mt-4">
            <button onClick={handleAddDataPoint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors text-sm font-semibold">
                <PlusCircle size={16}/> Add/Update Subsection
            </button>
        </div>
      </div>
      
      <div className="p-4 bg-background-primary/30 rounded-lg border border-border-primary">
        <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-2"><FileUp size={20} className="text-accent-primary"/> Bulk Data Upload</h3>
        <p className="text-xs text-content-muted mb-3">Launch the wizard to upload a file or paste data from a spreadsheet. The AI will help map columns, and rows with matching Subsection IDs will be updated.</p>
        <button
            onClick={() => setIsWizardOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/80 text-accent-primary-text hover:bg-accent-primary transition-colors text-sm font-semibold"
        >
            <FileUp size={16} />
            Launch Import Wizard
        </button>
      </div>
    </div>
  );
};

export default DataInputManager;
