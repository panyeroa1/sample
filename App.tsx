// FIX: Corrected React import to include necessary hooks and components.
import React, { useState, useEffect } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterPanel } from './components/CenterPanel';
import { RightSidebar } from './components/RightSidebar';
import { ActiveView } from './types';
import { initializeDataLayer } from './services/dataService';
import { LoadingIndicator } from './components/LoadingIndicator';
import { CallProvider } from './contexts/CallContext';
import { GlobalCallIndicator } from './components/GlobalCallIndicator';
import FeedbackModal from './components/FeedbackModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';

const MainLayout: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>(ActiveView.Agents);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [isDataLayerInitialized, setIsDataLayerInitialized] = useState(false);
  const [generatedAppHtml, setGeneratedAppHtml] = useState<string | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const { signOut } = useAuth();
  
  // State for mobile sidebar visibility
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeDataLayer();
      setIsDataLayerInitialized(true);
    };
    init();
  }, []);

  if (!isDataLayerInitialized) {
    return (
      <LoadingIndicator text="Initializing Eburon Studio..." size="large" />
    );
  }

  return (
    <CallProvider activeView={activeView}>
      <div className="h-dvh w-screen flex bg-eburon-bg text-eburon-fg overflow-hidden relative">
        {/* Overlay for mobile sidebar */}
        {isLeftSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setIsLeftSidebarOpen(false)}
            ></div>
        )}
      
        <div className={`fixed lg:relative h-full z-50 lg:z-auto transition-transform duration-300 ease-in-out ${isLeftSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
             <LeftSidebar 
              activeView={activeView}
              setActiveView={(view) => {
                setActiveView(view);
                setIsLeftSidebarOpen(false); // Close sidebar on nav item click on mobile
              }}
              isCollapsed={isLeftSidebarCollapsed}
              setIsCollapsed={setIsLeftSidebarCollapsed}
              onOpenFeedback={() => {
                setIsFeedbackModalOpen(true);
                setIsLeftSidebarOpen(false);
              }}
              onSignOut={signOut}
            />
        </div>
       
        <CenterPanel 
          activeView={activeView} 
          setGeneratedAppHtml={setGeneratedAppHtml}
          onMenuClick={() => setIsLeftSidebarOpen(true)}
        />

        <div className="hidden md:flex">
            <RightSidebar
              isCollapsed={isRightSidebarCollapsed}
              setIsCollapsed={setIsRightSidebarCollapsed}
              activeView={activeView}
              generatedAppHtml={generatedAppHtml}
            />
        </div>

        <GlobalCallIndicator 
            isRightSidebarCollapsed={isRightSidebarCollapsed} 
            setIsRightSidebarCollapsed={setIsRightSidebarCollapsed} 
        />
        {isFeedbackModalOpen && <FeedbackModal onClose={() => setIsFeedbackModalOpen(false)} />}
      </div>
    </CallProvider>
  );
}

const AppContent: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingIndicator text="Authenticating..." size="large" />;
  }

  return session ? <MainLayout /> : <AuthPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
