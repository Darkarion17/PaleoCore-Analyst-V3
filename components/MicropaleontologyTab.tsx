import React, { useState, useMemo, useEffect } from 'react';
import type { Microfossil, PartialMicrofossil, Source, Taxonomy } from '../types';
import { Microscope, Search, BookOpen, Thermometer, ChevronRight, PlusCircle, Loader2, ExternalLink, Bot, AlertCircle, Edit, Trash2, ChevronDown } from 'lucide-react';
import { findFossilPublications } from '../services/geminiService';

interface MicropaleontologyWikiProps {
    allFossils: Microfossil[];
    onAddFossil: (data: PartialMicrofossil | null) => void;
    onEditFossil: (fossil: Microfossil) => void;
    onDeleteFossil: (fossilId: string) => void;
    setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean }) => void;
}

const MICROFOSSIL_TYPES: Record<string, (taxonomy: Taxonomy) => boolean> = {
  'all': () => true,
  'foraminifero': (t) => t.phylum?.toLowerCase() === 'foraminifera',
  'radiolario': (t) => t.class?.toLowerCase() === 'radiolaria',
  'diatomea': (t) => t.phylum?.toLowerCase() === 'bacillariophyta',
  'micromoluscos': (t) => t.phylum?.toLowerCase() === 'mollusca',
  'dinoflagelados': (t) => t.phylum?.toLowerCase() === 'myzozoa',
  'crinoideos': (t) => t.class?.toLowerCase() === 'crinoidea',
};

const EPOCHS = ['all', 'Recent', 'Pleistocene', 'Pliocene', 'Miocene', 'Oligocene', 'Eocene', 'Paleocene', 'Cretaceous'];


const DetailCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-content-muted font-semibold">{label}</p>
        <p className="text-content-secondary">{value || 'N/A'}</p>
    </div>
);

const MicropaleontologyTab: React.FC<MicropaleontologyWikiProps> = ({ allFossils, onAddFossil, onEditFossil, onDeleteFossil, setToast }) => {
    const [selectedFossil, setSelectedFossil] = useState<Microfossil | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [selectedEpoch, setSelectedEpoch] = useState<string>('all');
    const [publications, setPublications] = useState<{ summary: string; sources: Source[] } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const filteredFossils = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const typeFilterFn = MICROFOSSIL_TYPES[selectedType] || (() => true);

        return allFossils.filter(f => {
            const typeMatch = typeFilterFn(f.taxonomy);
            const epochMatch = selectedEpoch === 'all' || f.stratigraphicRange.toLowerCase().includes(selectedEpoch.toLowerCase());
            const searchMatch = !term || (
                f.id.toLowerCase().includes(term) ||
                f.taxonomy.genus.toLowerCase().includes(term) ||
                f.taxonomy.species.toLowerCase().includes(term) ||
                f.taxonomy.family.toLowerCase().includes(term)
            );
            return typeMatch && epochMatch && searchMatch;
        });
    }, [allFossils, searchTerm, selectedType, selectedEpoch]);

    const groupedFossils = useMemo(() => {
        const groups: Record<string, Record<string, Microfossil[]>> = {};
        filteredFossils.forEach(fossil => {
            const family = fossil.taxonomy.family || 'Unclassified Family';
            const genus = fossil.taxonomy.genus || 'Unclassified Genus';
            if (!groups[family]) {
                groups[family] = {};
            }
            if (!groups[family][genus]) {
                groups[family][genus] = [];
            }
            groups[family][genus].push(fossil);
        });
        return groups;
    }, [filteredFossils]);
    
    useEffect(() => {
        if (selectedFossil) {
            // Find the latest version of the selected fossil from the main list
            const updatedVersion = allFossils.find(f => f.id === selectedFossil.id);
            // If it exists and is different from the one in state (i.e., it was updated), update the state
            if (updatedVersion && JSON.stringify(updatedVersion) !== JSON.stringify(selectedFossil)) {
                setSelectedFossil(updatedVersion);
            }
        }
    }, [allFossils, selectedFossil]);

    useEffect(() => {
        const isSelectedFossilInList = filteredFossils.some(f => f.id === selectedFossil?.id);
        
        if (!isSelectedFossilInList) {
            setSelectedFossil(filteredFossils[0] || null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredFossils]);

    useEffect(() => {
      // Auto-expand all family groups when the fossil list changes.
      const families = Object.keys(groupedFossils);
      setExpandedItems(new Set(families));
    }, [groupedFossils]);

    const handleSelectFossil = (fossil: Microfossil) => {
        setSelectedFossil(fossil);
        setPublications(null);
        setError(null);
    };
    
    const handleFindPublications = async () => {
        if (!selectedFossil) return;
        setIsLoading(true);
        setError(null);
        setPublications(null);
        
        const fossilName = `${selectedFossil.taxonomy.genus} ${selectedFossil.taxonomy.species}`;

        try {
            const result = await findFossilPublications(fossilName);
            setPublications(result);
            if (result.sources.length === 0 && !result.summary) {
                setToast({ message: `No recent publications found for ${fossilName}.`, type: 'info', show: true });
            }
        } catch(err: any) {
            setError(err.message || 'An unexpected error occurred.');
            setToast({ message: `Error: ${err.message}`, type: 'error', show: true });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpansion = (key: string) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };
    
    const selectClass = "w-full bg-background-tertiary border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8";
    const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-content-primary flex items-center gap-3"><Microscope /> Micropaleontology Wiki</h1>
                <button
                    onClick={() => onAddFossil(null)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors text-sm font-semibold"
                >
                    <PlusCircle size={16}/> Add New Species
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Panel: Fossil List */}
                <div className="lg:col-span-1 bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <select value={selectedType} onChange={e => setSelectedType(e.target.value)} className={selectClass} style={{backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em'}}>
                            <option value="all">All Types</option>
                            {Object.keys(MICROFOSSIL_TYPES).filter(t => t !== 'all').map(type => (
                                <option key={type} value={type} className="capitalize">{type}</option>
                            ))}
                        </select>
                        <select value={selectedEpoch} onChange={e => setSelectedEpoch(e.target.value)} className={selectClass} style={{backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em'}}>
                             {EPOCHS.map(epoch => (
                                <option key={epoch} value={epoch}>{epoch === 'all' ? 'All Epochs' : epoch}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Search species..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg py-2 pl-10 pr-4 text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition"
                        />
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-1">
                        {Object.entries(groupedFossils).map(([family, genera]) => (
                            <div key={family}>
                                <button onClick={() => toggleExpansion(family)} className="w-full flex items-center gap-2 text-left p-2 rounded-md hover:bg-background-tertiary/60">
                                    {expandedItems.has(family) ? <ChevronDown size={16} className="text-content-muted"/> : <ChevronRight size={16} className="text-content-muted"/>}
                                    <span className="font-bold text-content-secondary">{family}</span>
                                </button>
                                {expandedItems.has(family) && (
                                    <div className="pl-4 space-y-1 border-l border-border-primary ml-3 my-1">
                                         {Object.entries(genera).map(([genus, speciesList]) => {
                                            const genusKey = `${family}-${genus}`;
                                            return (
                                                <div key={genusKey}>
                                                    <button onClick={() => toggleExpansion(genusKey)} className="w-full flex items-center gap-2 text-left p-2 rounded-md hover:bg-background-tertiary/60">
                                                        {expandedItems.has(genusKey) ? <ChevronDown size={16} className="text-content-muted"/> : <ChevronRight size={16} className="text-content-muted"/>}
                                                        <span className="font-semibold italic text-content-secondary">{genus}</span>
                                                    </button>
                                                    {expandedItems.has(genusKey) && (
                                                        <div className="pl-4 space-y-1 border-l border-border-primary ml-3 my-1">
                                                            {speciesList.map(fossil => (
                                                                <button
                                                                    key={fossil.id}
                                                                    onClick={() => handleSelectFossil(fossil)}
                                                                    className={`w-full text-left p-2 rounded-md transition-colors flex justify-between items-center ${selectedFossil?.id === fossil.id ? 'bg-accent-primary/20 text-accent-primary-hover' : 'text-content-secondary hover:bg-background-tertiary/60 hover:text-content-primary'}`}
                                                                >
                                                                    <span className="italic font-normal pl-2">{fossil.taxonomy.species}</span>
                                                                    {selectedFossil?.id === fossil.id && <ChevronRight size={16} />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                         {filteredFossils.length === 0 && <p className="text-center text-sm text-content-muted p-4">No results match your filters.</p>}
                    </div>
                </div>

                {/* Right Panel: Fossil Details */}
                <div className="lg:col-span-2 bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
                    {selectedFossil ? (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-6">
                                <img src={selectedFossil.imageUrl} alt={selectedFossil.id} className="w-40 h-40 object-cover rounded-lg border-2 border-border-secondary flex-shrink-0" />
                                <div className="space-y-3 flex-grow">
                                    <div className="flex justify-between items-start">
                                        <h2 className="text-3xl font-bold text-content-primary italic flex-grow">{selectedFossil.taxonomy.genus} {selectedFossil.taxonomy.species}</h2>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button onClick={() => onEditFossil(selectedFossil)} className="p-2 rounded-md bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors" title="Edit Fossil">
                                                <Edit size={16} />
                                            </button>
                                            <button onClick={() => onDeleteFossil(selectedFossil.id)} className="p-2 rounded-md bg-danger-primary/20 text-danger-primary hover:bg-danger-primary/40 hover:text-content-inverted transition-colors" title="Delete Fossil">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <DetailCard label="Family" value={selectedFossil.taxonomy.family} />
                                        <DetailCard label="Stratigraphic Range" value={selectedFossil.stratigraphicRange} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-2"><BookOpen size={18} className="text-accent-secondary"/> Description</h3>
                                    <p className="text-sm text-content-secondary">{selectedFossil.description}</p>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-2"><Thermometer size={18} className="text-accent-secondary"/> Paleoecology</h3>
                                    <p className="text-sm text-content-secondary">{selectedFossil.ecology.notes}</p>
                                    <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                                        <DetailCard label="Temperature Range" value={selectedFossil.ecology.temperatureRange} />
                                        <DetailCard label="Depth Habitat" value={selectedFossil.ecology.depthHabitat} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="border-t border-border-primary pt-4 space-y-4">
                                 <button
                                    onClick={handleFindPublications}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/80 text-accent-primary-text hover:bg-accent-primary transition-colors text-sm font-semibold disabled:bg-background-interactive disabled:cursor-wait"
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                                    {isLoading ? 'Searching...' : 'Find Recent Publications'}
                                </button>
                                {error && (
                                     <div className="p-3 rounded-lg flex items-center gap-2 text-sm bg-danger-primary/20 text-danger-primary">
                                        <AlertCircle size={18}/> {error}
                                    </div>
                                )}
                                {publications && (
                                    <div className="animate-fade-in-fast space-y-4">
                                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-2 text-content-secondary">
                                            {publications.summary.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                                        </div>
                                        {publications.sources.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-content-secondary mb-2">Sources:</h4>
                                                <ul className="space-y-1">
                                                    {publications.sources.map((source, i) => (
                                                        <li key={i} className="flex items-center gap-2 text-xs">
                                                            <ExternalLink size={12} className="text-accent-secondary flex-shrink-0" />
                                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-content-muted hover:text-accent-secondary hover:underline truncate" title={source.title}>
                                                                {source.title}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-96 text-content-muted">
                            <p>Select a fossil from the list to view its details, or adjust filters to find a species.</p>
                        </div>
                    )}
                </div>
            </div>
             <style>{`
                @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default MicropaleontologyTab;