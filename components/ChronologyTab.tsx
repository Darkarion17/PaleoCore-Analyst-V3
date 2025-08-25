import React, { useState, useEffect } from 'react';
import type { Section, TiePoint } from '../types';
import { Layers, Plus, Trash2, MapPin, Calendar, Clock, Wand2, Loader2 } from 'lucide-react';
import { generateAgeModel } from '../services/geminiService';
import AgeDepthChart from './AgeDepthChart';

interface ChronologyTabProps {
  sections: Section[];
  onCalibratedDataChange: (calibratedSections: Section[]) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean }) => void;
}

const ChronologyTab: React.FC<ChronologyTabProps> = ({ sections, onCalibratedDataChange, setToast }) => {
  const [tiePoints, setTiePoints] = useState<TiePoint[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>(sections[0]?.id || '');
  const [depth, setDepth] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Load existing tie-points from all sections when component mounts
    const allTiePoints = sections.flatMap(s => s.ageModel?.tiePoints || []);
    setTiePoints(allTiePoints);
  }, [sections]);

  const handleAddTiePoint = () => {
    if (selectedSection && depth && age) {
      const newTiePoint: TiePoint = {
        id: `${selectedSection}-${depth}-${age}-${Date.now()}`,
        sectionId: selectedSection,
        depth: parseFloat(depth),
        age: parseFloat(age),
      };
      setTiePoints(prev => [...prev, newTiePoint].sort((a,b) => a.age - b.age));
      setDepth('');
      setAge('');
    }
  };

  const handleRemoveTiePoint = (id: string) => {
    setTiePoints(tiePoints.filter(tp => tp.id !== id));
  };
  
  const handleGenerateAgeModel = async () => {
    if (tiePoints.length < 2) {
      setToast({ message: 'At least two tie-points are required to generate an age model.', type: 'error', show: true });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const sectionsWithTiePoints = sections.map(s => ({
        ...s,
        ageModel: {
            tiePoints: tiePoints.filter(tp => tp.sectionId === s.id)
        }
      }));
      const result = await generateAgeModel(sectionsWithTiePoints, tiePoints);
      onCalibratedDataChange(result);
      setToast({ message: 'Age models generated successfully!', type: 'success', show: true });
    } catch (err: any) {
      setError(err.message);
      setToast({ message: `Error generating age model: ${err.message}`, type: 'error', show: true });
    } finally {
      setIsLoading(false);
    }
  };

  const getSectionName = (sectionId: string) => sections.find(s => s.id === sectionId)?.name || 'Unknown';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
            <div className="p-4 bg-background-tertiary/50 rounded-xl shadow-lg border border-border-primary/50">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-4">
                <Layers size={20} className="text-accent-primary"/>
                Tie-Points
            </h3>

            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 -mr-2">
                {tiePoints.length > 0 ? (
                tiePoints.map(tp => (
                    <div key={tp.id} className="flex items-center justify-between bg-background-primary/50 p-2 rounded-md text-sm">
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-content-secondary w-28 truncate" title={getSectionName(tp.sectionId)}>{getSectionName(tp.sectionId)}</span>
                            <span className="flex items-center gap-1 text-content-muted"><MapPin size={12}/> {tp.depth}</span>
                            <span className="flex items-center gap-1 text-content-muted"><Calendar size={12}/> {tp.age} ka</span>
                        </div>
                        <button onClick={() => handleRemoveTiePoint(tp.id)} className="p-1 text-content-muted hover:text-danger-primary">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))
                ) : (
                <p className="text-xs text-center text-content-muted py-2">Add at least two tie-points to build an age model.</p>
                )}
            </div>
            
            <div className="border-t border-border-primary pt-4 space-y-2">
                <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="w-full bg-background-interactive border border-border-secondary rounded-md p-1.5 text-xs mb-1"
                >
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="flex items-stretch gap-2">
                <input
                    type="number"
                    placeholder="Depth (mbsf)"
                    value={depth}
                    onChange={e => setDepth(e.target.value)}
                    className="w-full bg-background-interactive border border-border-secondary rounded-md p-1.5 text-xs"
                />
                <input
                    type="number"
                    placeholder="Age (ka)"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    className="w-full bg-background-interactive border border-border-secondary rounded-md p-1.5 text-xs"
                />
                <button
                    onClick={handleAddTiePoint}
                    disabled={!selectedSection || !depth || !age}
                    className="p-2 rounded-md bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors disabled:opacity-50"
                >
                    <Plus size={16} />
                </button>
                </div>
            </div>
            </div>
             <div className="p-4 bg-background-tertiary/50 rounded-xl shadow-lg border border-border-primary/50">
                <button
                    onClick={handleGenerateAgeModel}
                    disabled={isLoading || tiePoints.length < 2}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-accent-primary text-accent-primary-text font-bold hover:bg-accent-primary-hover transition-all duration-200 shadow-lg hover:shadow-cyan-500/30 disabled:bg-background-interactive disabled:cursor-wait"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    {isLoading ? 'Generating Models...' : 'Generate Age Models with AI'}
                </button>
                {error && <p className="text-danger-primary text-xs mt-2 text-center">{error}</p>}
            </div>
        </div>
        <div className="lg:col-span-2 bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-4">
                <Clock size={20} className="text-accent-primary"/>
                Age-Depth Model
            </h3>
            <div className="h-96">
                <AgeDepthChart tiePoints={tiePoints} sections={sections} />
            </div>
        </div>
    </div>
  );
};

export default ChronologyTab;
