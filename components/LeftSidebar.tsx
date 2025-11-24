
import React from 'react';
import { NAV_ITEMS } from '../constants';
import { ActiveView } from '../types';
import { ChevronLeftIcon, MessageCircleIcon, LogOutIcon, SettingsIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';

interface LeftSidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  onOpenFeedback: () => void;
  onSignOut: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ activeView, setActiveView, isCollapsed, setIsCollapsed, onOpenFeedback, onSignOut }) => {
  const { user } = useAuth();
  const { config } = useConfig();

  // Filter navigation based on config
  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.id === ActiveView.Agents) return config.modules.showAgents;
    if (item.id === ActiveView.CRM) return config.modules.showCRM;
    if (item.id === ActiveView.DataImport) return config.modules.showDataImport;
    if (item.id === ActiveView.Voices) return config.modules.showVoices;
    if (item.id === ActiveView.TTSStudio) return config.modules.showTTS;
    if (item.id === ActiveView.Chatbot) return config.modules.showChatbot;
    if (item.id === ActiveView.History) return config.modules.showHistory;
    return true;
  });

  return (
    <aside className={`bg-eburon-panel border-r border-eburon-border flex flex-col h-full transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isCollapsed ? 'w-20' : 'w-72'} z-20`}>
      {/* Header */}
      <div className={`flex items-center h-[80px] border-b border-eburon-border relative transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
        {!isCollapsed && (
            <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap animate-fade-in">
                <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" className="h-8 w-8 object-contain" />
                <h1 className="text-xl font-bold tracking-tight text-white">Eburon<span className="text-eburon-accent">.ai</span></h1>
            </div>
        )}
        {isCollapsed && (
             <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" className="h-8 w-8 object-contain" />
        )}
        
         <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute top-1/2 -right-3 z-50 p-1.5 rounded-full bg-eburon-panel border border-eburon-border hover:bg-eburon-accent text-eburon-fg shadow-sm hover:shadow-glow transition-all duration-300 ease-out hidden lg:flex items-center justify-center`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-tooltip={isCollapsed ? "Expand" : "Collapse"}
        >
          <ChevronLeftIcon className={`w-4 h-4 transition-transform duration-500 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-grow p-4 space-y-1.5 overflow-y-auto no-scrollbar">
        {visibleNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            data-tooltip={isCollapsed ? item.label : undefined}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group relative overflow-hidden ${
              activeView === item.id 
                ? 'bg-eburon-accent text-white shadow-glow' 
                : 'text-eburon-fg/70 hover:text-white hover:bg-white/5'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${activeView === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            
            {!isCollapsed && (
                <span className="font-medium text-sm tracking-wide animate-fade-in">{item.label}</span>
            )}
            
            {/* Active Indicator Line for collapsed state */}
            {isCollapsed && activeView === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 space-y-1.5 border-t border-eburon-border bg-eburon-panel/50">
        
         {/* Admin Settings (Only visible to master) */}
         {user && user.email === 'master@eburon.ai' && (
            <button
              onClick={() => setActiveView(ActiveView.AdminSettings)}
              data-tooltip={isCollapsed ? "Admin Settings" : undefined}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group ${
                activeView === ActiveView.AdminSettings ? 'bg-eburon-accent text-white shadow-glow' : 'text-eburon-fg/60 hover:text-white hover:bg-white/5'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <SettingsIcon className="w-5 h-5 flex-shrink-0 group-hover:rotate-45 transition-transform" />
              {!isCollapsed && <span className="font-medium text-sm">Admin Settings</span>}
            </button>
         )}

         <button
            onClick={onOpenFeedback}
            data-tooltip={isCollapsed ? "Feedback" : undefined}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 text-eburon-fg/60 hover:text-white hover:bg-white/5 group ${isCollapsed ? 'justify-center' : ''}`}
          >
            <MessageCircleIcon className="w-5 h-5 flex-shrink-0 group-hover:text-eburon-accent transition-colors" />
            {!isCollapsed && <span className="font-medium text-sm">Feedback</span>}
          </button>
          
         <button
            onClick={onSignOut}
            data-tooltip={isCollapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 text-eburon-fg/60 hover:text-red-400 hover:bg-red-500/10 group ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOutIcon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:-translate-x-1" />
            {!isCollapsed && <span className="font-medium text-sm">Sign Out</span>}
          </button>
      </div>
    </aside>
  );
};
