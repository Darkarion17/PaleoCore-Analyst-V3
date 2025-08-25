

import React from 'react';
import type { Section } from '../types';
import DataTable from './DataTable';
import DataInputManager from './DataInputManager';

interface DataEntryTabProps {
  section: Section;
  onUpdateSection: (section: Section) => void;
  proxyLabels: Record<string, string>;
  commonDataKeys: Record<string, string[]>;
  onOpenCustomProxiesModal: () => void;
}

const DataEntryTab: React.FC<DataEntryTabProps> = ({ section, onUpdateSection, proxyLabels, commonDataKeys, onOpenCustomProxiesModal }) => {
  return (
    <div className="space-y-6">
      <div className="bg-background-tertiary/50 p-6 rounded-xl shadow-lg border border-border-primary/50">
        <DataInputManager section={section} onUpdateSection={onUpdateSection} proxyLabels={proxyLabels} commonDataKeys={commonDataKeys} onOpenCustomProxiesModal={onOpenCustomProxiesModal} />
      </div>
      
      <div className="bg-background-tertiary/50 p-4 rounded-xl shadow-lg border border-border-primary/50">
        <h2 className="text-xl font-bold mb-4 text-content-primary px-2">Raw Data Series</h2>
        <DataTable data={section.dataPoints} averages={section.labAnalysis} proxyLabels={proxyLabels} />
      </div>
    </div>
  );
};

export default DataEntryTab;
