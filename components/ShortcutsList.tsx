
import React from 'react';

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="font-sans font-semibold border border-border-primary rounded px-1.5 py-0.5 bg-background-tertiary text-content-secondary">
        {children}
    </kbd>
);

const ShortcutItem: React.FC<{ description: string; keys: React.ReactNode }> = ({ description, keys }) => (
    <li className="flex items-center justify-between">
        <span>{description}</span>
        <div className="flex items-center gap-1">{keys}</div>
    </li>
);

const ShortcutSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-md font-semibold text-content-primary mb-2 mt-4">{title}</h3>
        <ul className="text-sm text-content-secondary space-y-3">{children}</ul>
    </div>
);

const ShortcutsList: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div>
            <ShortcutSection title="Global">
                <ShortcutItem description="Show this shortcuts guide" keys={<Kbd>?</Kbd>} />
                <ShortcutItem description="Open Command Palette" keys={<><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> or <Kbd>F</Kbd></>} />
                <ShortcutItem description="Add new core" keys={<><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>N</Kbd></>} />
                <ShortcutItem description="Open account settings" keys={<><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>,</Kbd></>} />
                <ShortcutItem description="Close modal / exit presentation" keys={<Kbd>Esc</Kbd>} />
            </ShortcutSection>
            
            <ShortcutSection title="Navigation">
                <ShortcutItem description="Switch to List View" keys={<Kbd>1</Kbd>} />
                <ShortcutItem description="Switch to Map View" keys={<Kbd>2</Kbd>} />
                <ShortcutItem description="Switch to Image Analysis" keys={<Kbd>3</Kbd>} />
                <ShortcutItem description="Switch to Micropaleontology Wiki" keys={<Kbd>4</Kbd>} />
                 <ShortcutItem description="Switch to AI Charting" keys={<Kbd>5</Kbd>} />
            </ShortcutSection>

            <ShortcutSection title="Core Actions (in List View)">
                 <ShortcutItem description="Edit selected core" keys={<Kbd>E</Kbd>} />
                 <ShortcutItem description="Delete selected core" keys={<><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>⌫</Kbd></>} />
                 <ShortcutItem description="Find nearby cores" keys={<><Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>N</Kbd></>} />
            </ShortcutSection>
        </div>
        <div>
             <ShortcutSection title="Dashboard">
                <ShortcutItem description="Toggle layout customization" keys={<Kbd>C</Kbd>} />
                <ShortcutItem description="Go to Synthesis tab" keys={<Kbd>S</Kbd>} />
                <ShortcutItem description="Switch to Dashboard tab" keys={<><Kbd>Alt</Kbd>+<Kbd>1</Kbd></>} />
                <ShortcutItem description="Switch to Data Entry tab" keys={<><Kbd>Alt</Kbd>+<Kbd>2</Kbd></>} />
                <ShortcutItem description="Switch to Microfossils tab" keys={<><Kbd>Alt</Kbd>+<Kbd>3</Kbd></>} />
                <ShortcutItem description="Switch to Correlation tab" keys={<><Kbd>Alt</Kbd>+<Kbd>4</Kbd></>} />
                <ShortcutItem description="Switch to Synthesis tab" keys={<><Kbd>Alt</Kbd>+<Kbd>5</Kbd></>} />
                <ShortcutItem description="Switch to AI Assistant tab" keys={<><Kbd>Alt</Kbd>+<Kbd>6</Kbd></>} />
            </ShortcutSection>
        </div>
    </div>
);

export default ShortcutsList;