import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Core, Section, Microfossil, PartialMicrofossil, DataPoint, LabAnalysis, AiInsight } from '../types';
import * as coreService from '../services/coreService';
import { supabase } from '../services/supabaseClient';
import { generateFullCoreReport } from '../services/exportService';


import CoreDetails from './CoreDetails';
import PaleoAiAssistant from './PaleoAiAssistant';
import DataEntryTab from './DataEntryTab';
import FossilRecordsTab from './FossilRecordsTab';
import DashboardTab from './DashboardTab';
import AddCoreModal from './AddCoreModal';
import CoreSynthesisView from './CoreSynthesisView';
import StratigraphicColumn from './StratigraphicColumn';
import ProxyCorrelationTab from './ProxyCorrelationTab';
import AiInsightsPanel from './AiInsightsPanel';
import ChronologyTab from './ChronologyTab';
import ProcessingPipelineTab from './ProcessingPipelineTab';
import AdvancedAnalyticsTab from './AdvancedAnalyticsTab';

import { LayoutDashboard, Database, Bug, Bot, PlusCircle, Loader2, Pencil, Trash2, FileText, Filter, Blend, BarChartHorizontal, GitMerge, Lightbulb, Clock, TestTube, BarChart3 as AnalysisIcon } from 'lucide-react';

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

interface CoreDashboardProps {
  core: Core;
  microfossils: Microfossil[];
  proxyLabels: Record<string, string>;
  commonDataKeys: Record<string, string[]>;
  onEditCore: (core: Core) => void;
  onDeleteCore: (coreId: string) => void;
  onGoToMap: () => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean; }) => void;
  onAddFossil: (fossil: PartialMicrofossil) => void;
  userEmail: string;
  onOpenNearbyCores: (core: Core) => void;
  synthesisShortcutTrigger: number;
  onOpenCustomProxiesModal: () => void;
  onUpdateSectionData: (section: Section) => void;
}

type Tab = 'dashboard' | 'data_entry' | 'fossils' | 'processing' | 'synthesis' | 'ai' | 'correlation' | 'chronology' | 'analysis';

const CoreDashboard: React.FC<CoreDashboardProps> = ({ core, microfossils, proxyLabels, commonDataKeys, onEditCore, onDeleteCore, onGoToMap, setToast, onAddFossil, userEmail, onOpenNearbyCores, synthesisShortcutTrigger, onOpenCustomProxiesModal, onUpdateSectionData }) => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sections, setSections] = useState<Section[]>([]);
  const [calibratedSections, setCalibratedSections] = useState<Section[] | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [loadingSections, setLoadingSections] = useState(true);
  
  const [epochFilter, setEpochFilter] = useState('all');

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);

  const [isGeneratingFullReport, setIsGeneratingFullReport] = useState(false);
  const [synthesisChartData, setSynthesisChartData] = useState<{ dataUrl: string; aspectRatio: number } | null>(null);
  const [correlationProxySelection, setCorrelationProxySelection] = useState<{ proxyX: string, proxyY: string } | null>(null);
  
  const [hoveredDepth, setHoveredDepth] = useState<number | null>(null);


  const availableEpochs = useMemo(() => {
    const epochs = new Set(sections.map(s => s.epoch));
    return ['all', ...Array.from(epochs)];
  }, [sections]);

  const filteredSections = useMemo(() => {
    if (epochFilter === 'all') {
      return sections;
    }
    return sections.filter(s => s.epoch === epochFilter);
  }, [sections, epochFilter]);

  useEffect(() => {
    if (synthesisShortcutTrigger > 0) {
        setActiveTab('synthesis');
    }
  }, [synthesisShortcutTrigger]);

  useEffect(() => {
    if (selectedSection && !filteredSections.some(s => s.id === selectedSection.id)) {
        setSelectedSection(filteredSections[0] || null);
    }
    if (!selectedSection && filteredSections.length > 0) {
        setSelectedSection(filteredSections[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSections, selectedSection]);


  const fetchSections = async () => {
    setLoadingSections(true);
    setCalibratedSections(null); // Reset synthesis data on re-fetch
    setSynthesisChartData(null); // Reset captured chart on re-fetch
    try {
      const fetchedSections = await coreService.fetchSectionsForCore(core.id);
      
      const sectionsWithAverages = fetchedSections.map(section => {
        if (section.dataPoints && section.dataPoints.length > 0) {
          const calculatedAverages = calculateAveragesFromDataPoints(section.dataPoints);
          return { ...section, labAnalysis: calculatedAverages };
        }
        return section;
      });

      setSections(sectionsWithAverages);
      
      const sectionToSelect = editingSection
          ? sectionsWithAverages.find(s => s.id === editingSection.id)
          : selectedSection 
              ? sectionsWithAverages.find(s => s.id === selectedSection.id)
              : null;
      
      setSelectedSection(sectionToSelect || sectionsWithAverages[0] || null);
      
    } catch (error: any) {
      setToast({ message: `Error fetching sections: ${error.message}`, type: 'error', show: true });
    } finally {
      setLoadingSections(false);
      setEditingSection(null);
    }
  };

  useEffect(() => {
    fetchSections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core.id]);
  
  const handleSaveSection = async (sectionToSave: Section) => {
    if (!supabase.auth.getSession()) return;
    const isEditing = sections.some(s => s.id === sectionToSave.id);

    try {
        const savedSection = await coreService.saveSection(sectionToSave, isEditing);
        if (isEditing) {
          setEditingSection(savedSection);
        }
        await fetchSections();
        setToast({ message: `Section "${savedSection.name}" saved.`, type: 'success', show: true });
        setIsSectionModalOpen(false);
    } catch (error: any) {
        setToast({ message: `Error: ${error.message}`, type: 'error', show: true });
    }
  };
  
  const handleDeleteSection = async (sectionId: string) => {
    const sectionName = sections.find(s => s.id === sectionId)?.name || 'this section';
     try {
        await coreService.deleteSection(sectionId);
        await fetchSections();
        setToast({ message: `Section "${sectionName}" deleted.`, type: 'success', show: true });
     } catch (error: any) {
        setToast({ message: `Error deleting section: ${error.message}`, type: 'error', show: true });
     }
  };
  
  const handleUpdateSectionDataWrapper = async (updatedSection: Section) => {
    onUpdateSectionData(updatedSection);
    // Optimistically update local state for better UX
    setSections(prev => prev.map(s => s.id === updatedSection.id ? updatedSection : s));
    if (selectedSection?.id === updatedSection.id) {
        setSelectedSection(updatedSection);
    }
  };

  const handleGenerateFullReport = async () => {
    if (sections.length === 0) {
        setToast({ message: 'Core has no sections to generate a report.', type: 'info', show: true });
        return;
    }
    setIsGeneratingFullReport(true);
    setToast({ message: 'Generating Full Core Report...', type: 'info', show: true });
    try {
      // Give the UI a moment to update before the browser freezes for PDF generation
      await new Promise(resolve => setTimeout(resolve, 50));
      generateFullCoreReport(core, sections, microfossils, userEmail, synthesisChartData);
    } catch (e) {
      console.error("Error generating full report:", e);
      setToast({ message: 'Failed to generate full core report.', type: 'error', show: true });
    } finally {
      setIsGeneratingFullReport(false);
    }
  };

  const handleNavigateToCorrelation = (proxyX: string, proxyY: string) => {
    setCorrelationProxySelection({ proxyX, proxyY });
    setActiveTab('correlation');
    const tabContentElement = document.querySelector('.animate-fade-in');
    tabContentElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };


  const TabButton: React.FC<{tabName: Tab, icon: React.ReactNode, label: string, shortcut: number, disabled?: boolean}> = ({tabName, icon, label, shortcut, disabled = false}) => (
      <button
          onClick={() => setActiveTab(tabName)}
          disabled={disabled || (tabName !== 'chronology' && tabName !== 'synthesis' && !selectedSection)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all duration-200
              ${activeTab === tabName && !disabled
                  ? 'border-accent-primary text-accent-primary-hover bg-background-tertiary' 
                  : 'border-transparent text-content-muted hover:text-content-primary hover:bg-background-tertiary/50 disabled:text-content-muted/50 disabled:cursor-not-allowed disabled:hover:bg-transparent'}`
          }
          aria-current={activeTab === tabName}
          title={`${label} (Alt + ${shortcut})`}
      >
          {icon}
          {label}
      </button>
  );
  
  const renderContent = () => {
    if (loadingSections) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-content-muted">
                <Loader2 size={48} className="mb-4 animate-spin" />
            </div>
        )
    }
    if (!selectedSection && !['synthesis', 'chronology'].includes(activeTab)) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-content-muted bg-background-tertiary/20 rounded-xl border-2 border-dashed border-border-primary">
                <FileText size={48} className="mb-4" />
                <h3 className="text-xl font-semibold text-content-primary">No Section Available</h3>
                <p>{sections.length > 0 ? 'Select a different epoch filter to see more sections.' : 'This core has no sections. Add one to get started.'}</p>
            </div>
        );
    }
    
    switch (activeTab) {
      case 'dashboard':
        return selectedSection ? <DashboardTab core={core} section={selectedSection} microfossils={microfossils} proxyLabels={proxyLabels} onUpdateSection={handleUpdateSectionDataWrapper} setToast={setToast} userEmail={userEmail} hoveredDepth={hoveredDepth} setHoveredDepth={setHoveredDepth} /> : null;
      case 'data_entry':
        return selectedSection ? <DataEntryTab section={selectedSection} onUpdateSection={handleUpdateSectionDataWrapper} proxyLabels={proxyLabels} commonDataKeys={commonDataKeys} onOpenCustomProxiesModal={onOpenCustomProxiesModal} /> : null;
      case 'fossils':
        return selectedSection ? <FossilRecordsTab section={selectedSection} microfossils={microfossils} onUpdateSection={handleUpdateSectionDataWrapper} /> : null;
      case 'processing':
        return selectedSection ? <ProcessingPipelineTab section={selectedSection} onUpdateSection={handleUpdateSectionDataWrapper} proxyLabels={proxyLabels} /> : null;
      case 'synthesis':
        return <CoreSynthesisView 
                  sections={sections} 
                  calibratedSections={calibratedSections} 
                  setToast={setToast}
                  onCaptureChart={setSynthesisChartData}
                  isChartCaptured={!!synthesisChartData}
                  proxyLabels={proxyLabels}
               />;
      case 'chronology':
        return <ChronologyTab
                  sections={sections}
                  onCalibratedDataChange={setCalibratedSections}
                  setToast={setToast}
                />;
      case 'correlation':
        return selectedSection ? <ProxyCorrelationTab 
            section={selectedSection} 
            proxyLabels={proxyLabels} 
            setToast={setToast} 
            initialProxyX={correlationProxySelection?.proxyX}
            initialProxyY={correlationProxySelection?.proxyY}
        /> : null;
      case 'ai':
        return selectedSection ? <PaleoAiAssistant section={selectedSection} /> : null;
      case 'analysis':
        return selectedSection ? <AdvancedAnalyticsTab section={selectedSection} microfossils={microfossils} proxyLabels={proxyLabels} /> : null;
      default:
        return null;
    }
  }

  const selectClass = "w-full bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8 disabled:cursor-not-allowed disabled:bg-background-tertiary disabled:text-content-muted/50";
  const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

  return (
    <div className="space-y-6">
      <CoreDetails core={core} onEdit={() => onEditCore(core)} onDelete={() => onDeleteCore(core.id)} onGoToMap={onGoToMap} onGenerateFullReport={handleGenerateFullReport} isGeneratingFullReport={isGeneratingFullReport} onOpenNearbyCores={() => onOpenNearbyCores(core)} />
      
      {selectedSection ? (
            <AiInsightsPanel 
                key={`insights-${selectedSection.id}`}
                section={selectedSection}
                proxyLabels={proxyLabels}
                onNavigateToCorrelation={handleNavigateToCorrelation}
            />
        ) : (
            <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50 min-h-[150px] flex items-center justify-center text-content-muted">
                Select a section to generate AI insights.
            </div>
        )
    }

    <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50">
        <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-4">
            <BarChartHorizontal size={20} className="text-accent-primary"/> Stratigraphic Analysis of Core
        </h3>
        <StratigraphicColumn sections={sections} microfossils={microfossils} hoveredDepth={hoveredDepth} setHoveredDepth={setHoveredDepth} />
    </div>

    <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-semibold text-content-primary flex-shrink-0">Section Details</h2>
            {loadingSections ? (
                <div className="flex items-center gap-2 text-content-muted w-full justify-end">
                    <Loader2 className="animate-spin" />
                    <span>Loading...</span>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full">
                    <div className="flex-1">
                        <label htmlFor="epoch-filter" className="block text-xs font-medium text-content-muted mb-1 flex items-center gap-1"><Filter size={12}/> Filter by Epoch</label>
                        <select id="epoch-filter" value={epochFilter} onChange={(e) => setEpochFilter(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                            {availableEpochs.map(epoch => (<option key={epoch} value={epoch}>{epoch === 'all' ? 'All Epochs' : epoch}</option>))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="section-select" className="block text-xs font-medium text-content-muted mb-1">Select Section</label>
                        <select id="section-select" value={selectedSection?.id || ''} onChange={(e) => { const section = filteredSections.find(s => s.id === e.target.value); if (section) setSelectedSection(section); }} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }} disabled={filteredSections.length === 0}>
                            {filteredSections.length === 0 ? (<option>No matching sections</option>) : filteredSections.map(section => (<option key={section.id} value={section.id}>{section.name}</option>))}
                        </select>
                    </div>
                    <div className="self-end">
                        <button onClick={() => { setEditingSection(null); setIsSectionModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold bg-accent-primary/20 text-accent-primary-hover hover:bg-accent-primary/30 transition-colors h-full">
                            <PlusCircle size={16}/> Add Section
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
      
    {selectedSection && !loadingSections && (
        <div className="flex justify-end items-center gap-2 -mt-4 mr-2">
            <button
                onClick={() => { setEditingSection(selectedSection); setIsSectionModalOpen(true); }}
                className="p-1.5 rounded-md bg-background-tertiary text-content-muted hover:bg-background-interactive hover:text-content-primary transition-colors"
                title="Edit selected section"
            >
                <Pencil size={14} />
            </button>
            <button
                onClick={() => handleDeleteSection(selectedSection.id)}
                className="p-1.5 rounded-md bg-danger-primary/20 text-danger-primary hover:bg-danger-primary/40 hover:text-content-inverted transition-colors"
                title="Delete selected section"
            >
                <Trash2 size={14} />
            </button>
        </div>
    )}

    <div>
        <nav className="flex items-center border-b border-border-primary mb-6 flex-wrap">
            <TabButton tabName="dashboard" icon={<LayoutDashboard size={16}/>} label="Dashboard" shortcut={1} />
            <TabButton tabName="data_entry" icon={<Database size={16}/>} label="Data Entry" shortcut={2} />
            <TabButton tabName="fossils" icon={<Bug size={16}/>} label="Microfossils" shortcut={3} />
            <TabButton tabName="processing" icon={<TestTube size={16}/>} label="Processing" shortcut={4} />
            <TabButton tabName="chronology" icon={<Clock size={16}/>} label="Chronology" shortcut={5} disabled={sections.length === 0} />
            <TabButton tabName="correlation" icon={<GitMerge size={16}/>} label="Correlation" shortcut={6} />
            <TabButton tabName="synthesis" icon={<Blend size={16}/>} label="Synthesis" shortcut={7} disabled={sections.length === 0} />
            <TabButton tabName="ai" icon={<Bot size={16}/>} label="AI Assistant" shortcut={8} />
            <TabButton tabName="analysis" icon={<AnalysisIcon size={16}/>} label="Analysis" shortcut={9} />
        </nav>
        <div className="animate-fade-in">
            {renderContent()}
        </div>
    </div>

    {isSectionModalOpen && (
      <AddCoreModal
        mode="section"
        parentCoreId={core.id}
        onSaveSection={handleSaveSection} 
        onClose={() => { setIsSectionModalOpen(false); setEditingSection(null); }}
        sectionToEdit={editingSection}
        microfossils={microfossils}
        onAddFossil={onAddFossil}
       />
    )}
    </div>
  );
};

export default CoreDashboard;