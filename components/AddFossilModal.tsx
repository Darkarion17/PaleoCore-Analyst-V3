

import React, { useState, useEffect } from 'react';
import type { Microfossil, Taxonomy, PartialMicrofossil } from '../types';
import { X, Save, BookOpen, Microscope, Thermometer, Image } from 'lucide-react';

interface AddFossilModalProps {
    onSaveFossil: (fossil: Microfossil) => void;
    onClose: () => void;
    fossilData?: Microfossil | PartialMicrofossil | null;
}

const initialFossilState: Omit<Microfossil, 'id' | 'taxonomy'> & { taxonomy: Taxonomy } = {
    taxonomy: {
        kingdom: 'Rhizaria',
        phylum: 'Foraminifera',
        class: 'Globothalamea',
        order: 'Rotaliida',
        family: '',
        genus: '',
        species: ''
    },
    description: '',
    stratigraphicRange: '',
    ecology: {
        temperatureRange: '',
        depthHabitat: '',
        notes: ''
    },
    imageUrl: ''
};

const FormSection: React.FC<{title: string; icon: React.ReactNode; children: React.ReactNode}> = ({title, icon, children}) => (
    <div className="space-y-3 p-4 bg-background-secondary/40 rounded-lg border border-border-primary">
        <h3 className="text-lg font-semibold text-accent-secondary flex items-center gap-2">
            {icon}
            {title}
        </h3>
        <div className="space-y-2">{children}</div>
    </div>
);

const SubInputField = ({ id, label, value, onChange, name, required = false }: {id: string, label: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, name: string, required?: boolean }) => (
    <div>
        <label htmlFor={id} className="block text-xs font-medium text-content-muted mb-1">{label}</label>
        <input
            type="text"
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className="w-full bg-background-interactive border border-border-secondary rounded-md p-2 text-sm text-content-secondary placeholder-content-muted focus:ring-1 focus:ring-accent-primary focus:outline-none transition"
        />
    </div>
);

const AddFossilModal: React.FC<AddFossilModalProps> = ({ onSaveFossil, onClose, fossilData }) => {
    const isEditMode = !!(fossilData && 'id' in fossilData && fossilData.id);

    const [formData, setFormData] = useState(initialFossilState);
    const [fossilId, setFossilId] = useState('');

    useEffect(() => {
        if (fossilData) {
            const initialData = { ...initialFossilState, ...fossilData };
            setFormData({
                taxonomy: { ...initialFossilState.taxonomy, ...initialData.taxonomy },
                description: initialData.description || '',
                stratigraphicRange: initialData.stratigraphicRange || '',
                ecology: { ...initialFossilState.ecology, ...initialData.ecology },
                imageUrl: initialData.imageUrl || '',
            });

            if (isEditMode) {
                setFossilId(fossilData.id!);
            } else if (fossilData.taxonomy?.genus && fossilData.taxonomy?.species) {
                const genus = fossilData.taxonomy.genus.charAt(0).toUpperCase();
                const species = fossilData.taxonomy.species.toLowerCase();
                setFossilId(`${genus}_${species}`);
            } else {
                 setFossilId('');
            }
        } else {
            setFormData(initialFossilState);
            setFossilId('');
        }
    }, [fossilData, isEditMode]);

    const isFormValid = fossilId.trim() !== '' && formData.taxonomy.genus.trim() !== '' && formData.taxonomy.species.trim() !== '';

    const handleTaxonomyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, taxonomy: { ...prev.taxonomy, [e.target.name]: e.target.value } }));
    };

    const handleEcologyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, ecology: { ...prev.ecology, [e.target.name]: e.target.value } }));
    };

    const handleMainChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;
        
        const fossilToSave: Microfossil = {
            id: fossilId,
            ...formData
        };

        onSaveFossil(fossilToSave);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in-fast" onClick={onClose}>
            <div className="bg-background-tertiary rounded-xl shadow-2xl p-8 w-full max-w-4xl border border-border-primary m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-content-primary">{isEditMode ? `Edit Microfossil: ${fossilId}` : 'Add New Microfossil to Database'}</h2>
                    <button onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="fossilId" className="block text-sm font-medium text-content-secondary mb-1">Unique Fossil ID* (e.g., G_sacculifer)</label>
                        <input
                            type="text"
                            id="fossilId"
                            value={fossilId}
                            onChange={(e) => setFossilId(e.target.value)}
                            required
                            readOnly={isEditMode}
                            placeholder="A unique identifier, no spaces"
                            className={`w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition ${isEditMode ? 'bg-background-secondary cursor-not-allowed' : ''}`}
                        />
                    </div>
                    
                    <FormSection title="Taxonomy" icon={<BookOpen size={18}/>}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.keys(formData.taxonomy).map((key) => (
                                <SubInputField
                                    key={key}
                                    id={`taxonomy-${key}`}
                                    label={`${key.charAt(0).toUpperCase() + key.slice(1)}${key === 'genus' || key === 'species' ? '*' : ''}`}
                                    name={key}
                                    value={formData.taxonomy[key as keyof typeof formData.taxonomy]}
                                    onChange={handleTaxonomyChange}
                                    required={key === 'genus' || key === 'species'}
                                />
                            ))}
                        </div>
                    </FormSection>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <FormSection title="Morphology & Stratigraphy" icon={<Microscope size={18}/>}>
                           <SubInputField id="stratigraphicRange" label="Stratigraphic Range" name="stratigraphicRange" value={formData.stratigraphicRange} onChange={handleMainChange} />
                           <div>
                                <label htmlFor="description" className="block text-xs font-medium text-content-muted mb-1">Description</label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleMainChange}
                                    rows={4}
                                    className="w-full bg-background-interactive border border-border-secondary rounded-md p-2 text-sm text-content-secondary placeholder-content-muted focus:ring-1 focus:ring-accent-primary focus:outline-none transition"
                                />
                           </div>
                        </FormSection>

                        <FormSection title="Paleoecology" icon={<Thermometer size={18}/>}>
                            <SubInputField id="temperatureRange" label="Temperature Range" name="temperatureRange" value={formData.ecology.temperatureRange} onChange={handleEcologyChange} />
                            <SubInputField id="depthHabitat" label="Depth Habitat" name="depthHabitat" value={formData.ecology.depthHabitat} onChange={handleEcologyChange} />
                            <div>
                                <label htmlFor="ecology-notes" className="block text-xs font-medium text-content-muted mb-1">Notes</label>
                                <textarea
                                    id="ecology-notes"
                                    name="notes"
                                    value={formData.ecology.notes}
                                    onChange={handleEcologyChange}
                                    rows={2}
                                    className="w-full bg-background-interactive border border-border-secondary rounded-md p-2 text-sm text-content-secondary placeholder-content-muted focus:ring-1 focus:ring-accent-primary focus:outline-none transition"
                                />
                           </div>
                        </FormSection>
                    </div>

                    <FormSection title="Image" icon={<Image size={18} />}>
                       <SubInputField id="imageUrl" label="Image URL" name="imageUrl" value={formData.imageUrl} onChange={handleMainChange} />
                    </FormSection>


                    <div className="flex justify-end gap-4 pt-6 border-t border-border-primary">
                        <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-background-interactive text-content-primary hover:bg-background-interactive-hover transition">Cancel</button>
                        <button type="submit" disabled={!isFormValid} className="px-6 py-2 rounded-lg bg-accent-primary text-accent-primary-text font-semibold hover:bg-accent-primary-hover transition disabled:bg-background-interactive disabled:cursor-not-allowed flex items-center gap-2">
                           <Save size={18} />
                           {isEditMode ? 'Save Changes' : 'Save Microfossil'}
                        </button>
                    </div>
                </form>
            </div>
             <style>{`
                @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default AddFossilModal;
