import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Core, Section, Microfossil, PaleoEvent } from '../types';
import { Beaker, FileText, Layers, Loader2, Sparkles, Download, FileJson, Pencil, X, Check, BrainCircuit, LineChart } from 'lucide-react';
import { generateSectionSummary, detectPaleoEvents } from '../services/geminiService';
import { generateSectionReport } from '../services/exportService';
import SummaryCard from './SummaryCard';
import DataTable from './DataTable';
import 'jspdf-autotable'; // Import for table generation
import SingleSectionChart from './SingleSectionChart';
import PresentationButton from './PresentationButton';


interface DashboardTabProps {
  core: Core;
  section: Section;
  microfossils: Microfossil[];
  proxyLabels: Record<string, string>;
  onUpdateSection: (section: Section) => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; show: boolean; }) => void;
  userEmail: string;
  hoveredDepth: number | null;
  setHoveredDepth: (depth: number | null) => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ core, section, microfossils, proxyLabels, onUpdateSection, setToast, userEmail, hoveredDepth, setHoveredDepth }) => {
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummaryText, setEditedSummaryText] = useState(section.summary || '');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [isDetectingEvents, setIsDetectingEvents] = useState(false);
  const [detectedEvents, setDetectedEvents] = useState<PaleoEvent[]>([]);
  const [selectedProxy, setSelectedProxy] = useState<string>('');
  const [xAxis, setXAxis] = useState<'age' | 'depth'>('depth');
  const presentationContainerRef = useRef<HTMLDivElement>(null);

  const hasAgeData = useMemo(() => section.dataPoints.some(dp => dp.age !== undefined && dp.age !== null), [section.dataPoints]);

  const availableProxies = useMemo(() => {
    const rawProxies = new Set<string>();
    section.dataPoints.forEach(dp => {
      Object.keys(dp).forEach(key => {
        if (typeof dp[key] === 'number' && key !== 'depth' && key !== 'age') {
            rawProxies.add(key);
        }
      });
    });

    const virtualProxies = section.pipelines?.map(p => p.name) || [];
    
    return [...Array.from(rawProxies), ...virtualProxies];
  }, [section.dataPoints, section.pipelines]);

  useEffect(() => {
    // Reset state when section changes
    setDetectedEvents([]);
    setIsDetectingEvents(false);
    
    // Set default axis and proxy
    setXAxis(hasAgeData ? 'age' : 'depth');
    const defaultProxy = availableProxies.includes('delta18O') ? 'delta18O' : availableProxies[0] || '';
    setSelectedProxy(defaultProxy);

  }, [section.id, hasAgeData, availableProxies]);

  useEffect(() => {
    if (!isEditingSummary) {
        setEditedSummaryText(section.summary || '');
    }
  }, [section.summary, isEditingSummary]);

  
  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    const summaryText = await generateSectionSummary(section, microfossils);
    onUpdateSection({ ...section, summary: summaryText });
    setIsGeneratingSummary(false);
  };

  const handleSaveSummary = () => {
    onUpdateSection({ ...section, summary: editedSummaryText });
    setIsEditingSummary(false);
  };
  
  const handleDetectEvents = async () => {
    if (!hasAgeData) {
        setToast({ message: 'Event detection requires an age model. Please generate one in the Synthesis tab.', type: 'error', show: true });
        return;
    }
    setIsDetectingEvents(true);
    setDetectedEvents([]);
    try {
        const events = await detectPaleoEvents(section.dataPoints);
        setDetectedEvents(events);
        if (events.length > 0) {
            setToast({ message: `Detected ${events.length} paleo-events.`, type: 'success', show: true });
        } else {
            setToast({ message: 'No significant named events were detected in the data.', type: 'info', show: true });
        }
    } catch (error: any) {
        setToast({ message: `Error detecting events: ${error.message}`, type: 'error', show: true });
    } finally {
        setIsDetectingEvents(false);
    }
  };

  const exportToCsv = () => {
    if (section.dataPoints.length === 0) {
      setToast({ message: 'No data points to export.', type: 'info', show: true });
      return;
    }
    const headers = Object.keys(section.dataPoints[0]);
    const csvRows = [
      headers.join(','),
      ...section.dataPoints.map(row => 
        headers.map(header => JSON.stringify(row[header] ?? '', (_key, value) => value ?? '')).join(',')
      )
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${section.core_id}_${section.name}_data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const exportToJson = () => {
    const jsonString = JSON.stringify(section, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${section.core_id}_${section.name}_backup.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    setToast({ message: 'Generating PDF report, please wait...', type: 'info', show: true });
    try {
      // Give the UI a moment to update before the browser freezes for PDF generation
      await new Promise(resolve => setTimeout(resolve, 50));
      generateSectionReport(section, microfossils, userEmail);
    } catch (e) {
      console.error("PDF Generation Error:", e);
      setToast({ message: 'Failed to generate PDF.', type: 'error', show: true });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const labEntries = section.labAnalysis ? Object.entries(section.labAnalysis).filter(([, value]) => value !== null && value !== undefined && value !== 0) : [];
  
  const selectClass = "bg-background-interactive border border-border-secondary rounded-lg p-2 text-sm text-content-primary focus:ring-2 focus:ring-accent-primary focus:outline-none transition appearance-none bg-no-repeat bg-right pr-8 disabled:cursor-not-allowed disabled:bg-background-tertiary";
  const selectIcon = `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='var(--text-muted)' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="Section Information" icon={FileText}>
          <p><strong>Name:</strong> {section.name}</p>
          <p><strong>Collector:</strong> {section.collector || 'N/A'}</p>
          <p><strong>Recovered:</strong> {section.recoveryDate}</p>
        </SummaryCard>
        <SummaryCard title="Geological Context" icon={Layers}>
          <p><strong>Epoch:</strong> {section.epoch}</p>
          <p><strong>Period:</strong> {section.geologicalPeriod}</p>
          <p><strong>Age Range:</strong> {section.ageRange}</p>
        </SummaryCard>
        <SummaryCard title="Lab Analysis (Averages)" icon={Beaker}>
            {labEntries.length > 0 ? (
                labEntries.map(([key, value]) => {
                    const displayValue = typeof value === 'number' ? value.toFixed(4) : String(value);
                    const label = proxyLabels[key] || key;
                    return (
                        <p key={key}><strong>{label}:</strong> {displayValue}</p>
                    );
                })
            ) : <p className="text-content-muted italic">No data. Add data points in the 'Data Entry' tab to automatically calculate averages.</p>}
        </SummaryCard>
      </div>

      <div ref={presentationContainerRef} className="presentation-container bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50">
        <div className="presentation-controls flex justify-between items-start mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2"><LineChart size={20} className="text-accent-primary"/> Section Data Visualization</h3>
            <div className="flex items-center gap-4">
                <div>
                    <label htmlFor="proxy-select" className="text-xs font-medium text-content-muted mr-2">Proxy:</label>
                    <select id="proxy-select" value={selectedProxy} onChange={e => setSelectedProxy(e.target.value)} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }} disabled={availableProxies.length === 0}>
                        {availableProxies.length === 0 ? <option>No data</option> : availableProxies.map(p => <option key={p} value={p}>{proxyLabels[p] || p}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="xaxis-select" className="text-xs font-medium text-content-muted mr-2">X-Axis:</label>
                    <select id="xaxis-select" value={xAxis} onChange={e => setXAxis(e.target.value as 'age' | 'depth')} className={selectClass} style={{ backgroundImage: selectIcon, backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}>
                        <option value="depth">Depth</option>
                        <option value="age" disabled={!hasAgeData}>Age (ka)</option>
                    </select>
                </div>
                <PresentationButton targetRef={presentationContainerRef} />
            </div>
        </div>
        <div className="presentation-chart-wrapper bg-background-primary/50 p-2 rounded-lg">
          <SingleSectionChart 
              section={section}
              xAxisKey={xAxis} 
              yAxisKey={selectedProxy} 
              events={detectedEvents} 
              proxyLabels={proxyLabels}
              hoveredValue={hoveredDepth}
              setHoveredValue={setHoveredDepth}
          />
        </div>
      </div>
      
      <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2"><Sparkles size={20} className="text-accent-primary"/> AI-Powered Scientific Summary</h3>
             <div className="flex items-center gap-2">
                 <button onClick={handleGenerateSummary} disabled={isGeneratingSummary || isEditingSummary} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/80 text-accent-primary-text hover:bg-accent-primary transition-colors text-sm font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed">
                    {isGeneratingSummary ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16}/>}
                    {isGeneratingSummary ? 'Generating...' : 'Generate/Update'}
                </button>
                {section.summary && !isEditingSummary && (
                    <button onClick={() => setIsEditingSummary(true)} className="p-2 rounded-lg bg-background-interactive text-content-secondary hover:bg-background-interactive-hover hover:text-content-primary transition-colors" aria-label="Edit Summary">
                        <Pencil size={16} />
                    </button>
                )}
             </div>
        </div>
        
        {isEditingSummary ? (
            <div className="mt-2 space-y-3">
                <textarea
                    value={editedSummaryText}
                    onChange={(e) => setEditedSummaryText(e.target.value)}
                    className="w-full h-48 bg-background-primary/80 border border-border-secondary rounded-lg p-3 text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition text-sm"
                    placeholder="Enter summary..."
                />
                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsEditingSummary(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-interactive text-content-primary hover:bg-background-interactive-hover transition text-sm font-semibold">
                        <X size={16}/> Cancel
                    </button>
                    <button onClick={handleSaveSummary} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-primary text-white hover:bg-green-500 transition text-sm font-semibold">
                        <Check size={16}/> Save Summary
                    </button>
                </div>
            </div>
        ) : section.summary ? (
            <div className="mt-4 p-4 bg-background-primary/50 rounded-lg prose prose-sm prose-invert max-w-none prose-p:my-2 text-content-secondary">
                {section.summary.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                ))}
            </div>
        ) : (
             <div className="mt-4 text-center text-content-muted">
                <p>Click "Generate/Update" to create an AI-powered summary for this section.</p>
             </div>
        )}
      </div>

      <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
        <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-3"><BrainCircuit size={20} className="text-accent-primary"/> AI-Powered Event Detection</h3>
        <button onClick={handleDetectEvents} disabled={!hasAgeData || isDetectingEvents} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/80 text-accent-primary-text hover:bg-accent-primary transition-colors text-sm font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed">
            {isDetectingEvents ? <Loader2 size={16} className="animate-spin" /> : <BrainCircuit size={16}/>}
            {isDetectingEvents ? 'Detecting Events...' : 'Detect Paleo Events'}
        </button>
        {!hasAgeData && <p className="text-xs text-content-muted mt-2">Event detection requires an age model. Please generate one in the 'Synthesis' tab.</p>}
        {detectedEvents.length > 0 && (
            <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                {detectedEvents.map(event => (
                    <div key={event.eventName} className="p-3 bg-background-primary/50 rounded-lg">
                        <h4 className="font-bold text-content-primary">{event.eventName}</h4>
                        <p className="text-xs font-mono text-accent-secondary">({event.startAge} - {event.endAge} ka)</p>
                        <p className="text-sm text-content-secondary mt-1">{event.description}</p>
                    </div>
                ))}
            </div>
        )}
      </div>

      <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
        <h3 className="text-lg font-semibold text-content-primary flex items-center gap-2 mb-3"><Download size={20} className="text-accent-primary"/> Export Tools</h3>
        <div className="flex flex-wrap gap-4">
            <button onClick={exportToCsv} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-interactive text-content-primary hover:bg-background-interactive-hover transition-colors text-sm font-semibold">
                <Download size={16}/> Export Data to CSV
            </button>
            <button onClick={exportToJson} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-interactive text-content-primary hover:bg-background-interactive-hover transition-colors text-sm font-semibold">
                <FileJson size={16}/> Export Section to JSON
            </button>
            <button onClick={handleGeneratePdf} disabled={isGeneratingPdf} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background-interactive text-content-primary hover:bg-background-interactive-hover transition-colors text-sm font-semibold disabled:bg-slate-600 disabled:cursor-not-allowed">
              {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16}/>}
              {isGeneratingPdf ? 'Generating...' : 'Download Section Report (PDF)'}
            </button>
        </div>
      </div>
      
      <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50">
        <h2 className="text-xl font-bold mb-4 text-content-primary px-2">Raw Data Series</h2>
        <DataTable data={section.dataPoints} averages={section.labAnalysis} proxyLabels={proxyLabels} />
      </div>
    </div>
  );
};

export default DashboardTab;