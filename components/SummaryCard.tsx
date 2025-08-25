
import React from 'react';

interface SummaryCardProps {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, icon: Icon, children }) => (
    <div className="bg-background-primary/50 p-4 rounded-lg shadow-md border border-border-primary/50 h-full">
        <div className="flex items-center mb-2">
            <Icon className="h-6 w-6 mr-2 text-accent-primary" />
            <h4 className="text-md font-semibold text-content-primary">{title}</h4>
        </div>
        <div className="text-sm text-content-secondary space-y-1">{children}</div>
    </div>
);

export default SummaryCard;