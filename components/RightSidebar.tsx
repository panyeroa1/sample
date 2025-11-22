import React from 'react';
import { IphoneSimulator } from './IphoneSimulator';
import { ChevronRightIcon } from './icons';
import { ActiveView } from '../types';

interface RightSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  activeView: ActiveView;
  generatedAppHtml: string | null;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isCollapsed, setIsCollapsed, activeView, generatedAppHtml }) => {
  
  const previewHtml = activeView === ActiveView.Chatbot ? generatedAppHtml : null;

  return (
    <aside className={`relative bg-eburon-panel border-l border-eburon-border flex flex-col items-center justify-center transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-[420px]'}`}>
       <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-1/2 -left-4 z-10 p-1.5 rounded-full bg-eburon-panel border border-eburon-border hover:bg-eburon-accent text-eburon-fg transition-all`}
        aria-label={isCollapsed ? "Expand dialer" : "Collapse dialer"}
      >
        <ChevronRightIcon className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} />
      </button>
      
      {!isCollapsed && (
        <div className="w-full h-full p-4 flex items-center justify-center">
            <IphoneSimulator previewHtml={previewHtml} />
        </div>
      )}
      
      {isCollapsed && (
          <div className="transform -rotate-90 whitespace-nowrap text-eburon-fg/50 font-semibold tracking-widest text-base">
              SIMULATOR
          </div>
      )}
    </aside>
  );
};