
import React, { Suspense } from 'react';
import { ActiveView } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { MenuIcon } from './icons';

// Lazy load the main view components
const ChatbotView = React.lazy(() => import('./ChatbotView'));
const AgentsView = React.lazy(() => import('./AgentsView'));
const CrmView = React.lazy(() => import('./CrmView'));
const VoicesView = React.lazy(() => import('./VoicesView'));
const CallLogsView = React.lazy(() => import('./CallLogsView'));
const TTSStudioView = React.lazy(() => import('./TTSStudioView'));
const DataImportView = React.lazy(() => import('./DataImportView'));
const AdminSettingsView = React.lazy(() => import('./AdminSettingsView'));

interface CenterPanelProps {
  activeView: ActiveView;
  setGeneratedAppHtml: (html: string | null) => void;
  onMenuClick: () => void;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({ 
  activeView, 
  setGeneratedAppHtml,
  onMenuClick,
}) => {
  const viewTitles: Record<ActiveView, string> = {
    [ActiveView.Agents]: "Agents",
    [ActiveView.CRM]: "CRM",
    [ActiveView.DataImport]: "Data Import",
    [ActiveView.Voices]: "Voice Library",
    [ActiveView.TTSStudio]: "TTS Studio",
    [ActiveView.Chatbot]: "AI Assistant",
    [ActiveView.History]: "Call History",
    [ActiveView.WebDemo]: "Web Demo",
    [ActiveView.AdminSettings]: "Admin Settings",
  }

  const renderContent = () => {
    switch (activeView) {
      case ActiveView.Chatbot:
        return <ChatbotView setGeneratedAppHtml={setGeneratedAppHtml} />;
      case ActiveView.Agents:
        return <AgentsView />;
      case ActiveView.CRM:
        return <CrmView />;
      case ActiveView.DataImport:
        return <DataImportView />;
      case ActiveView.Voices:
        return <VoicesView />;
      case ActiveView.History:
        return <CallLogsView />;
      case ActiveView.TTSStudio:
        return <TTSStudioView />;
      case ActiveView.AdminSettings:
        return <AdminSettingsView />;
      default:
        return <AgentsView />;
    }
  };

  return (
    <main className="flex-1 bg-eburon-bg overflow-hidden flex flex-col">
       <header className="flex lg:hidden items-center p-4 h-[73px] border-b border-eburon-border flex-shrink-0">
          <button 
            onClick={onMenuClick} 
            className="p-2 mr-2 rounded-lg hover:bg-white/10"
            data-tooltip="Toggle Navigation"
          >
              <MenuIcon className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{viewTitles[activeView]}</h1>
      </header>
      <Suspense fallback={<LoadingIndicator text={`Loading ${viewTitles[activeView]}...`} />}>
        <div className="flex-grow p-4 sm:p-6 md:p-8 overflow-y-auto">
            {renderContent()}
        </div>
      </Suspense>
    </main>
  );
};
