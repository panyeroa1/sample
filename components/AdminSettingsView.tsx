
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { AppConfig, OllamaModel, OllamaSettings, AgentTool, Agent, ChatMessage, GroundingChunk } from '../types';
import { ShieldIcon, SaveIcon, EyeIcon, KeyIcon, ServerIcon, ToggleOnIcon, ToggleOffIcon, LockIcon, RefreshIcon, CheckCircleIcon, ApiIcon, DatabaseIcon, DownloadIcon, UploadIcon, Trash2Icon, GoogleIcon, XIcon, CodeIcon, PlusIcon, EditIcon, BrainCircuitIcon, PhoneIcon, BugIcon, TerminalIcon, PlayCircleIcon, SendIcon, CopyIcon } from './icons';
import * as supabaseService from '../services/supabaseService';
import * as dataService from '../services/dataService';
import { fetchOllamaModels } from '../services/ollamaService';
import { configureInboundCall } from '../services/blandAiService';
import { sendMessageStreamToGemini } from '../services/geminiService';
import { STEPHEN_DEFAULT_AGENT } from '../constants';

interface TestLog {
    id: string;
    timestamp: number;
    type: 'info' | 'tool_call' | 'error' | 'response';
    content: string;
    details?: any;
}

const AdminSettingsView: React.FC = () => {
  const { user } = useAuth();
  const { config, updateConfig } = useConfig();
  const [tempConfig, setTempConfig] = useState<AppConfig>(config);
  const [activeTab, setActiveTab] = useState<'general' | 'keys' | 'integrations' | 'data' | 'auth' | 'tools' | 'telephony' | 'test-lab' | 'db-setup'>('general');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Data Management State
  const [selectedTable, setSelectedTable] = useState<'agents' | 'crm_bookings' | 'tools' | 'call_logs'>('agents');
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ollama Management State
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [ollamaConnectionStatus, setOllamaConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ollamaErrorMsg, setOllamaErrorMsg] = useState<string | null>(null);

  // Tool Management State
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [isEditingTool, setIsEditingTool] = useState<string | null>(null); // Tool ID or null
  const [toolFormData, setToolFormData] = useState<Partial<AgentTool>>({});

  // Telephony / Inbound State
  const [inboundNumber, setInboundNumber] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedInboundAgentId, setSelectedInboundAgentId] = useState<string>(STEPHEN_DEFAULT_AGENT.id);
  const [inboundDeployStatus, setInboundDeployStatus] = useState<'idle' | 'deploying' | 'success' | 'error'>('idle');
  const [inboundDeployMsg, setInboundDeployMsg] = useState('');

  // Test Lab State
  const [selectedTestAgentId, setSelectedTestAgentId] = useState<string>(STEPHEN_DEFAULT_AGENT.id);
  const [testHistory, setTestHistory] = useState<ChatMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const testChatEndRef = useRef<HTMLDivElement>(null);
  
  // DB Setup State
  const [copySqlStatus, setCopySqlStatus] = useState('Copy SQL');

  // Access Control
  if (!user || user.email !== 'master@eburon.ai') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-eburon-bg p-8 text-center">
        <LockIcon className="w-24 h-24 text-red-500 mb-6 opacity-50" />
        <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-eburon-fg/60 max-w-md">
          This area is restricted to administrative personnel only. Please contact your system administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  useEffect(() => {
    setTempConfig(config);
  }, [config]);

  useEffect(() => {
      if (activeTab === 'tools' || activeTab === 'telephony' || activeTab === 'test-lab') {
          loadTools();
          loadAgents();
      }
  }, [activeTab]);

  useEffect(() => {
      if (activeTab === 'test-lab') {
          testChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [testHistory, activeTab]);

  const loadTools = async () => {
      const fetchedTools = await dataService.getTools();
      setTools(fetchedTools);
  };

  const loadAgents = async () => {
      const fetchedAgents = await dataService.getAgents();
      setAgents(fetchedAgents);
  };

  const handleToggleModule = (key: keyof AppConfig['modules']) => {
    setTempConfig(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: !prev.modules[key]
      }
    }));
  };

  const handleChatbotConfigChange = (key: keyof AppConfig['chatbot'], value: boolean) => {
    setTempConfig(prev => ({
      ...prev,
      chatbot: {
        ...prev.chatbot,
        [key]: value
      }
    }));
  };

  const handleApiKeyChange = (key: keyof AppConfig['apiKeys'], value: string) => {
    setTempConfig(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [key]: value
      }
    }));
  };

  const handleServiceChange = (key: keyof AppConfig['services'], value: any) => {
    setTempConfig(prev => ({
      ...prev,
      services: {
        ...prev.services,
        [key]: value
      }
    }));
  };

  const handleSave = () => {
    setSaveStatus('saving');
    setTimeout(() => {
      updateConfig(tempConfig);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleExportCSV = async () => {
    try {
        const csvData = await supabaseService.exportTableToCSV(selectedTable);
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `${selectedTable}_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error: any) {
        alert('Export failed: ' + error.message);
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus('processing');
    setImportMessage('Parsing and uploading data...');

    try {
        const text = await file.text();
        const result = await supabaseService.importCSVToTable(selectedTable, text);
        setImportStatus('success');
        setImportMessage(`Successfully imported ${result.count} records.`);
    } catch (error: any) {
        setImportStatus('error');
        setImportMessage('Import failed: ' + error.message);
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- DB SETUP HANDLERS ---
  const getDatabaseSchemaSQL = () => {
    return `
-- Eburon Voice Studio Database Schema

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Create Storage Bucket for Files (Audio, Avatars, etc.)
insert into storage.buckets (id, name, public)
values ('eburon-files', 'eburon-files', true)
on conflict (id) do nothing;

-- 3. Set Storage Policies (Public Access for Demo)
create policy "Public Access" on storage.objects for select using ( bucket_id = 'eburon-files' );
create policy "Public Insert" on storage.objects for insert with check ( bucket_id = 'eburon-files' );

-- 4. Create Tables

-- Agents Table
create table if not exists agents (
  id text primary key,
  name text not null,
  description text,
  voice text,
  system_prompt text,
  first_sentence text,
  thinking_mode boolean default false,
  avatar_url text,
  tools text[], -- Array of Tool IDs
  is_active_for_dialer boolean default false,
  created_at timestamptz default now()
);

-- CRM Bookings Table
create table if not exists crm_bookings (
  pnr text primary key,
  passenger_name text,
  email text,
  phone_number text,
  flight_number text,
  origin text,
  destination text,
  flight_date timestamptz,
  status text,
  notes jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Tools Table
create table if not exists tools (
  id text primary key,
  name text,
  description text,
  method text,
  url text,
  headers text, -- Stored as JSON string
  body text, -- Stored as JSON string (schema)
  timeout integer,
  created_at timestamptz default now()
);

-- Call Logs Table
create table if not exists call_logs (
  call_id text primary key,
  created_at timestamptz,
  duration integer,
  "from" text,
  "to" text,
  recording_url text,
  summary text,
  concatenated_transcript text,
  transcript jsonb
);

-- TTS Generations Table
create table if not exists tts_generations (
  id text primary key,
  input_text text,
  audio_url text,
  created_at timestamptz default now()
);

-- Chatbot Messages Table (History)
create table if not exists chatbot_messages (
  id text primary key,
  role text,
  text text,
  image_url text,
  grounding_chunks jsonb,
  telemetry jsonb,
  created_at timestamptz default now()
);

-- Voice Tags Backup
create table if not exists voices_tags_backup (
  id text primary key,
  tags text,
  created_at timestamptz default now()
);

-- Feedback Table
create table if not exists feedback (
  id text primary key,
  feedback_text text,
  created_at timestamptz default now()
);

-- Agent Feedback Table
create table if not exists agent_feedback (
  id text primary key,
  agent_id text,
  session_id text,
  transcript jsonb,
  feedback_text text,
  created_at timestamptz default now()
);

-- Agent Memory Table
create table if not exists agent_memory (
  id uuid default uuid_generate_v4() primary key,
  phone_number text,
  note text,
  session_id text,
  created_at timestamptz default now()
);

-- 5. Enable RLS (Row Level Security) - Open for Demo, Lock down for Prod
alter table agents enable row level security;
create policy "Enable all access for all users" on agents for all using (true) with check (true);

alter table crm_bookings enable row level security;
create policy "Enable all access for all users" on crm_bookings for all using (true) with check (true);

alter table tools enable row level security;
create policy "Enable all access for all users" on tools for all using (true) with check (true);

alter table call_logs enable row level security;
create policy "Enable all access for all users" on call_logs for all using (true) with check (true);

alter table tts_generations enable row level security;
create policy "Enable all access for all users" on tts_generations for all using (true) with check (true);

alter table chatbot_messages enable row level security;
create policy "Enable all access for all users" on chatbot_messages for all using (true) with check (true);

alter table voices_tags_backup enable row level security;
create policy "Enable all access for all users" on voices_tags_backup for all using (true) with check (true);

alter table feedback enable row level security;
create policy "Enable all access for all users" on feedback for all using (true) with check (true);

alter table agent_feedback enable row level security;
create policy "Enable all access for all users" on agent_feedback for all using (true) with check (true);

alter table agent_memory enable row level security;
create policy "Enable all access for all users" on agent_memory for all using (true) with check (true);
`;
  };

  const handleCopySQL = () => {
      navigator.clipboard.writeText(getDatabaseSchemaSQL());
      setCopySqlStatus('Copied!');
      setTimeout(() => setCopySqlStatus('Copy SQL'), 2000);
  };

  const refreshOllamaModels = useCallback(async () => {
    setIsLoadingModels(true);
    setOllamaErrorMsg(null);
    setOllamaConnectionStatus('idle');

    const settings: OllamaSettings = {
        type: tempConfig.services.ollamaType || 'local',
        baseUrl: tempConfig.services.ollamaBaseUrl,
        apiKey: tempConfig.services.ollamaApiKey,
        model: tempConfig.services.ollamaModel
    };

    try {
        const models = await fetchOllamaModels(settings);
        if (models.length > 0) {
            setAvailableModels(models);
            setOllamaConnectionStatus('success');
            // If current selected model is not in list, try to auto-select a sane default
            if (!models.some(m => m.name === tempConfig.services.ollamaModel) && tempConfig.services.ollamaModel !== 'custom') {
                 const defaultPick = models.find(m => m.name.includes('gemma') || m.name.includes('llama3')) || models[0];
                 handleServiceChange('ollamaModel', defaultPick.name);
            }
        } else {
            setAvailableModels([]);
            setOllamaConnectionStatus('error');
            setOllamaErrorMsg("Connected, but no models found. Please pull a model on your server.");
        }
    } catch (error: any) {
        setAvailableModels([]);
        setOllamaConnectionStatus('error');
        let msg = "Connection failed.";
        if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
            msg = "Network error: Connection blocked or server unreachable. Ensure local service is running.";
        } else if (error.message) {
            msg = error.message;
        }
        setOllamaErrorMsg(msg);
    } finally {
        setIsLoadingModels(false);
    }
  }, [tempConfig.services]);

  // --- TOOL MANAGEMENT HANDLERS ---
  const handleCreateTool = () => {
      setIsEditingTool('new');
      setToolFormData({
          id: `tool-${Date.now()}`,
          name: '',
          description: '',
          method: 'POST',
          url: '',
          headers: '{}',
          body: '{}'
      });
  };

  const handleEditTool = (tool: AgentTool) => {
      setIsEditingTool(tool.id);
      setToolFormData({
          ...tool,
          headers: tool.headers || '{}',
          body: tool.body || '{}'
      });
  };

  const handleDeleteTool = async (toolId: string) => {
      if (confirm('Are you sure you want to delete this tool?')) {
          await dataService.deleteTool(toolId);
          loadTools();
      }
  };

  const handleSaveTool = async () => {
      if (!toolFormData.name || !toolFormData.url || !toolFormData.id) {
          alert("Name and Endpoint URL are required.");
          return;
      }

      // Validate JSON
      try {
          if (toolFormData.headers) JSON.parse(toolFormData.headers);
          if (toolFormData.body) JSON.parse(toolFormData.body);
      } catch (e) {
          alert("Invalid JSON in Headers or Input Schema fields. Please check your syntax.");
          return;
      }

      await dataService.saveTool(toolFormData as AgentTool);
      setIsEditingTool(null);
      loadTools();
  };

  // --- INBOUND CALL HANDLERS ---
  const handleDeployInboundAgent = async () => {
      if (!inboundNumber.trim()) {
          setInboundDeployStatus('error');
          setInboundDeployMsg("Please enter a phone number.");
          return;
      }
      
      const agent = agents.find(a => a.id === selectedInboundAgentId);
      if (!agent) {
           setInboundDeployStatus('error');
           setInboundDeployMsg("Selected agent not found.");
           return;
      }

      setInboundDeployStatus('deploying');
      setInboundDeployMsg(`Configuring ${agent.name} for inbound calls on ${inboundNumber}...`);

      try {
          const result = await configureInboundCall(inboundNumber, agent);
          if (result.success) {
              setInboundDeployStatus('success');
              setInboundDeployMsg(`Success! ${agent.name} is now live on ${inboundNumber}.`);
          } else {
              setInboundDeployStatus('error');
              setInboundDeployMsg(`Failed: ${result.message}`);
          }
      } catch (err: any) {
           setInboundDeployStatus('error');
           setInboundDeployMsg(`Error: ${err.message}`);
      }
  };
  
  // --- TEST LAB HANDLERS ---
  const addTestLog = (type: TestLog['type'], content: string, details?: any) => {
      setTestLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          type,
          content,
          details
      }]);
  };

  const handleTestSend = async () => {
      if (!testInput.trim()) return;
      
      const currentAgent = agents.find(a => a.id === selectedTestAgentId);
      if (!currentAgent) {
          addTestLog('error', 'Agent not found. Please select a valid agent.');
          return;
      }

      setIsTesting(true);
      const userMsg: ChatMessage = {
          id: `test-user-${Date.now()}`,
          role: 'user',
          text: testInput
      };
      setTestHistory(prev => [...prev, userMsg]);
      addTestLog('info', `User sent message: "${testInput.substring(0, 50)}..."`);
      
      const startTime = performance.now();
      let responseText = '';
      
      try {
          setTestInput('');
          
          // Setup mock/temp message for streaming
          const modelMsgId = `test-model-${Date.now()}`;
          setTestHistory(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);

          const stream = await sendMessageStreamToGemini(
              [...testHistory, userMsg],
              testInput,
              null,
              { 
                useSearchGrounding: false,
                useMapsGrounding: false,
                useLowLatency: false,
                useThinkingMode: currentAgent.thinkingMode,
                userLocation: null 
              },
              currentAgent.systemPrompt // Use selected agent's prompt
          );

          for await (const chunk of stream) {
               const chunkText = chunk.text;
               responseText += chunkText;
               
               // Log tool calls if present in chunk (approximated for demo, usually in final response or specific parts)
               if (chunk.candidates?.[0]?.content?.parts) {
                   chunk.candidates[0].content.parts.forEach((part: any) => {
                       if (part.functionCall) {
                           addTestLog('tool_call', `Tool Invocation: ${part.functionCall.name}`, part.functionCall.args);
                       }
                   });
               }
               
               setTestHistory(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: responseText } : m));
          }
          
          const endTime = performance.now();
          const duration = ((endTime - startTime) / 1000).toFixed(2);
          addTestLog('response', `Response generated in ${duration}s`, { fullText: responseText });

      } catch (error: any) {
          addTestLog('error', `Generation failed: ${error.message}`);
          setTestHistory(prev => [...prev, { id: `err-${Date.now()}`, role: 'model', text: `Error: ${error.message}` }]);
      } finally {
          setIsTesting(false);
      }
  };

  const clearTestSession = () => {
      setTestHistory([]);
      setTestLogs([]);
      addTestLog('info', 'Session cleared. Ready for new test.');
  };


  const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: React.FC<any> }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-b-2 ${
        activeTab === id
          ? 'border-eburon-accent text-eburon-accent'
          : 'border-transparent text-eburon-fg/60 hover:text-eburon-fg hover:border-eburon-border'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  const ToggleSetting = ({ label, description, value, onChange }: { label: string, description: string, value: boolean, onChange: (v: boolean) => void }) => (
    <div className="bg-eburon-bg border border-eburon-border p-4 rounded-xl flex items-center justify-between hover:border-eburon-accent/30 transition-colors">
        <div>
            <p className="font-semibold text-white">{label}</p>
            <p className="text-xs text-eburon-fg/50">{description}</p>
        </div>
        <button 
            onClick={() => onChange(!value)}
            className={`p-1.5 rounded-lg transition-colors ${value ? 'text-eburon-ok bg-eburon-ok/10' : 'text-eburon-fg/30 bg-eburon-bg border border-eburon-border'}`}
        >
            {value ? <ToggleOnIcon className="w-8 h-8" /> : <ToggleOffIcon className="w-8 h-8" />}
        </button>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-eburon-bg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-eburon-border bg-eburon-panel/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-eburon-accent/10 rounded-lg">
            <ShieldIcon className="w-6 h-6 text-eburon-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Eburon System Settings</h1>
            <p className="text-xs text-eburon-fg/50 font-mono uppercase tracking-wider">System Configuration</p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saveStatus !== 'idle'}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
            saveStatus === 'saved' 
              ? 'bg-eburon-ok text-black shadow-eburon-ok/20' 
              : 'bg-eburon-accent hover:bg-eburon-accent-dark text-white hover:shadow-glow'
          }`}
        >
          {saveStatus === 'saving' ? (
            <RefreshIcon className="w-4 h-4 animate-spin" />
          ) : saveStatus === 'saved' ? (
            <CheckCircleIcon className="w-4 h-4" />
          ) : (
            <SaveIcon className="w-4 h-4" />
          )}
          <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save Changes'}</span>
        </button>
      </header>

      {/* Navigation Tabs */}
      <div className="px-8 border-b border-eburon-border bg-eburon-bg">
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          <TabButton id="general" label="Frontend Visibility" icon={EyeIcon} />
          <TabButton id="keys" label="API Keys & Secrets" icon={KeyIcon} />
          <TabButton id="integrations" label="Services & Integrations" icon={ServerIcon} />
          <TabButton id="telephony" label="Telephony & Inbound" icon={PhoneIcon} />
          <TabButton id="tools" label="Agent Tools" icon={CodeIcon} />
          <TabButton id="data" label="Data Management" icon={DatabaseIcon} />
          <TabButton id="test-lab" label="Test Lab" icon={BugIcon} />
          <TabButton id="db-setup" label="Database Setup" icon={ServerIcon} />
          <TabButton id="auth" label="Authentication" icon={GoogleIcon} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-full mx-auto space-y-8">
          
          {/* TAB: GENERAL (VISIBILITY) */}
          {activeTab === 'general' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <EyeIcon className="w-5 h-5 text-eburon-accent" />
                  Module Visibility
                </h2>
                <span className="text-xs text-eburon-fg/40">Toggle features visible to regular users</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(tempConfig.modules).map(([key, value]) => (
                  <div key={key} className="bg-eburon-panel border border-eburon-border p-4 rounded-xl flex items-center justify-between hover:border-eburon-accent/30 transition-colors group">
                    <div>
                      <p className="font-semibold text-white capitalize">{key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-xs text-eburon-fg/50">Enable or disable this view</p>
                    </div>
                    <button 
                      onClick={() => handleToggleModule(key as keyof AppConfig['modules'])}
                      className={`p-2 rounded-lg transition-colors ${value ? 'text-eburon-ok bg-eburon-ok/10' : 'text-eburon-fg/30 bg-eburon-bg'}`}
                      data-tooltip={value ? "Disable Module" : "Enable Module"}
                    >
                      {value ? <ToggleOnIcon className="w-8 h-8" /> : <ToggleOffIcon className="w-8 h-8" />}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB: API KEYS */}
          {activeTab === 'keys' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <KeyIcon className="w-5 h-5 text-eburon-accent" />
                  API Keys Management
                </h2>
                <span className="text-xs text-eburon-fg/40 bg-red-500/10 text-red-400 px-2 py-1 rounded">Sensitive Data</span>
              </div>

              <div className="space-y-4">
                <ApiKeyInput 
                  label="Google Gemini API Key" 
                  value={tempConfig.apiKeys.geminiApiKey} 
                  onChange={(v) => handleApiKeyChange('geminiApiKey', v)} 
                  placeholder="AIza..."
                />
                 <ApiKeyInput 
                  label="Deepgram API Key" 
                  value={tempConfig.apiKeys.deepgramApiKey || ''} 
                  onChange={(v) => handleApiKeyChange('deepgramApiKey', v)} 
                  placeholder="e.g. d133..."
                />
                <ApiKeyInput 
                  label="Bland AI API Key" 
                  value={tempConfig.apiKeys.blandApiKey} 
                  onChange={(v) => handleApiKeyChange('blandApiKey', v)} 
                  placeholder="sk-..."
                />
                 <ApiKeyInput 
                  label="Bland AI Encrypted Key" 
                  value={tempConfig.apiKeys.blandEncryptedKey} 
                  onChange={(v) => handleApiKeyChange('blandEncryptedKey', v)} 
                  placeholder="..."
                />
                <ApiKeyInput 
                  label="Supabase URL" 
                  value={tempConfig.apiKeys.supabaseUrl} 
                  onChange={(v) => handleApiKeyChange('supabaseUrl', v)} 
                  placeholder="https://..."
                />
                <ApiKeyInput 
                  label="Supabase Anon Key" 
                  value={tempConfig.apiKeys.supabaseKey} 
                  onChange={(v) => handleApiKeyChange('supabaseKey', v)} 
                  placeholder="eyJ..."
                />
                 <ApiKeyInput 
                  label="Vapi Public Key" 
                  value={tempConfig.apiKeys.vapiPublicKey} 
                  onChange={(v) => handleApiKeyChange('vapiPublicKey', v)} 
                  placeholder="..."
                />
              </div>
            </section>
          )}

          {/* TAB: TELEPHONY / INBOUND */}
          {activeTab === 'telephony' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
               <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PhoneIcon className="w-5 h-5 text-eburon-accent" />
                  Inbound Call Configuration
                </h2>
                <span className="text-xs text-eburon-fg/40">Setup agents for incoming calls</span>
              </div>

              <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 space-y-6">
                 <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200">
                    <p><strong>Note:</strong> Ensure your Twilio number is forwarded to Bland AI or that you are using a Bland AI purchased number. This configuration maps the incoming number to a specific Eburon Agent personality.</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50 mb-2">Twilio Phone Number</label>
                        <input 
                            type="text" 
                            value={inboundNumber}
                            onChange={(e) => setInboundNumber(e.target.value)}
                            className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 text-sm text-white placeholder-eburon-fg/30 focus:outline-none focus:ring-2 focus:ring-eburon-accent font-mono"
                            placeholder="+15551234567"
                        />
                        <p className="text-xs text-eburon-fg/40 mt-2">Format: E.164 (e.g., +1...)</p>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50 mb-2">Assign Agent</label>
                        <select 
                            value={selectedInboundAgentId}
                            onChange={(e) => setSelectedInboundAgentId(e.target.value)}
                            className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-eburon-accent cursor-pointer"
                        >
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name} {agent.id === STEPHEN_DEFAULT_AGENT.id ? '(Default Stephen)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                 </div>

                 <div className="flex justify-end items-center gap-4 border-t border-eburon-border pt-6">
                     {inboundDeployStatus !== 'idle' && (
                         <div className={`text-sm ${inboundDeployStatus === 'error' ? 'text-red-400' : inboundDeployStatus === 'success' ? 'text-eburon-ok' : 'text-eburon-fg/70'}`}>
                             {inboundDeployMsg}
                         </div>
                     )}
                     
                     <button 
                        onClick={handleDeployInboundAgent}
                        disabled={inboundDeployStatus === 'deploying'}
                        className="px-6 py-3 bg-eburon-accent hover:bg-eburon-accent-dark text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-glow disabled:bg-gray-600"
                     >
                         {inboundDeployStatus === 'deploying' ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <ServerIcon className="w-4 h-4" />}
                         Deploy Inbound Agent
                     </button>
                 </div>
              </div>
            </section>
          )}

          {/* TAB: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ServerIcon className="w-5 h-5 text-eburon-accent" />
                  Services & Integrations
                </h2>
              </div>

              <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 border-b border-eburon-border pb-4">
                   <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                      <ApiIcon className="w-6 h-6 text-white" />
                   </div>
                   <div>
                     <h3 className="font-bold text-white">Eburon Edge Configuration</h3>
                     <p className="text-xs text-eburon-fg/50">Local and Cloud LLM inference settings</p>
                   </div>
                </div>
                
                <div className="space-y-5">
                    {/* Type Selection */}
                    <div className="flex bg-eburon-bg p-1.5 rounded-xl border border-eburon-border/50">
                        <button 
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${tempConfig.services.ollamaType === 'local' ? 'bg-eburon-accent text-white shadow-md' : 'text-eburon-fg/60 hover:text-white hover:bg-white/5'}`}
                            onClick={() => handleServiceChange('ollamaType', 'local')}
                        >
                            Localhost
                        </button>
                        <button 
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${tempConfig.services.ollamaType === 'cloud' ? 'bg-eburon-accent text-white shadow-md' : 'text-eburon-fg/60 hover:text-white hover:bg-white/5'}`}
                            onClick={() => handleServiceChange('ollamaType', 'cloud')}
                        >
                            Remote / Cloud
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50 mb-2">Base URL</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={tempConfig.services.ollamaBaseUrl}
                                    onChange={(e) => handleServiceChange('ollamaBaseUrl', e.target.value)}
                                    onBlur={refreshOllamaModels}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 pr-10 text-sm text-white placeholder-eburon-fg/30 focus:outline-none focus:ring-2 focus:ring-eburon-accent transition-all font-mono"
                                    placeholder={tempConfig.services.ollamaType === 'local' ? "http://127.0.0.1:11434" : "https://your-ollama-instance.com"}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                    {isLoadingModels && <RefreshIcon className="w-4 h-4 animate-spin text-eburon-accent" />}
                                    {ollamaConnectionStatus === 'success' && <CheckCircleIcon className="w-4 h-4 text-eburon-ok" />}
                                    {ollamaConnectionStatus === 'error' && <XIcon className="w-4 h-4 text-red-500" />}
                                </div>
                            </div>
                            <p className="text-xs text-eburon-fg/40 mt-2">
                                {tempConfig.services.ollamaType === 'local' 
                                    ? "Default local port is 11434. Ensure CORS is enabled (OLLAMA_ORIGINS='*')." 
                                    : "Enter the publicly accessible URL of your hosted Ollama instance (e.g. via ngrok or cloud hosting)."}
                            </p>
                            {ollamaErrorMsg && (
                                <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-200 leading-relaxed">
                                    {ollamaErrorMsg}
                                </div>
                            )}
                        </div>
                        
                        {tempConfig.services.ollamaType === 'cloud' && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50 mb-2">API Key <span className="font-normal normal-case opacity-50">(Optional)</span></label>
                                <input 
                                    type="password" 
                                    value={tempConfig.services.ollamaApiKey || ''}
                                    onChange={(e) => handleServiceChange('ollamaApiKey', e.target.value)}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 text-sm text-white placeholder-eburon-fg/30 focus:outline-none focus:ring-2 focus:ring-eburon-accent transition-all font-mono"
                                    placeholder="sk-..."
                                />
                            </div>
                        )}
                        
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50">Default Model</label>
                                <button 
                                    onClick={refreshOllamaModels}
                                    className="text-xs text-eburon-accent hover:text-white flex items-center gap-1 transition-colors"
                                    disabled={isLoadingModels}
                                    type="button"
                                >
                                    <RefreshIcon className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                                    Scan Models
                                </button>
                            </div>
                            
                            {availableModels.length > 0 ? (
                                <div className="relative">
                                    <select 
                                        value={tempConfig.services.ollamaModel}
                                        onChange={(e) => handleServiceChange('ollamaModel', e.target.value)}
                                        className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-eburon-accent transition-all cursor-pointer"
                                    >
                                        {availableModels.map(model => (
                                            <option key={model.name} value={model.name} className="bg-eburon-panel">
                                                {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)} GB)
                                            </option>
                                        ))}
                                        {tempConfig.services.ollamaModel && !availableModels.some(m => m.name === tempConfig.services.ollamaModel) && (
                                            <option value={tempConfig.services.ollamaModel} className="bg-eburon-panel">{tempConfig.services.ollamaModel} (Current)</option>
                                        )}
                                        <option value={tempConfig.services.ollamaModel} className="bg-eburon-panel">Enter custom model name...</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                         <svg className="w-4 h-4 text-eburon-fg/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                            ) : (
                                <input 
                                    type="text" 
                                    value={tempConfig.services.ollamaModel}
                                    onChange={(e) => handleServiceChange('ollamaModel', e.target.value)}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 text-sm text-white placeholder-eburon-fg/30 focus:outline-none focus:ring-2 focus:ring-eburon-accent transition-all font-mono"
                                    placeholder="e.g. gemma, llama3"
                                />
                            )}
                            {availableModels.length > 0 && tempConfig.services.ollamaModel === 'custom' && (
                                <input 
                                    type="text" 
                                    onChange={(e) => handleServiceChange('ollamaModel', e.target.value)}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 mt-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-eburon-accent animate-fade-in"
                                    placeholder="Enter model name manually"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Chatbot Capabilities Configuration */}
                <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 mt-6 space-y-6">
                    <div className="flex items-center gap-3 border-b border-eburon-border pb-4">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                            <BrainCircuitIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">AI Assistant Capabilities</h3>
                            <p className="text-xs text-eburon-fg/50">Configure features available in the main Chatbot interface</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <ToggleSetting 
                            label="Enable Search Grounding" 
                            description="Allow users to use Google Search for real-time information."
                            value={tempConfig.chatbot?.enableSearch ?? true}
                            onChange={(v) => handleChatbotConfigChange('enableSearch', v)}
                         />
                         <ToggleSetting 
                            label="Enable Thinking Mode" 
                            description="Allow users to use extended reasoning models (Gemini 2.5 Pro)."
                            value={tempConfig.chatbot?.enableThinking ?? true}
                            onChange={(v) => handleChatbotConfigChange('enableThinking', v)}
                         />
                          <ToggleSetting 
                            label="Enable Maps Grounding" 
                            description="Allow users to use Google Maps for location-based queries."
                            value={tempConfig.chatbot?.enableMaps ?? true}
                            onChange={(v) => handleChatbotConfigChange('enableMaps', v)}
                         />
                    </div>
                </div>

              </div>
            </section>
          )}

          {/* TAB: TOOLS MANAGEMENT */}
          {activeTab === 'tools' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <CodeIcon className="w-5 h-5 text-eburon-accent" />
                        Agent Tools
                    </h2>
                    <button 
                        onClick={handleCreateTool}
                        className="bg-eburon-accent hover:bg-eburon-accent-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                    >
                        <PlusIcon className="w-4 h-4" />
                        New Tool
                    </button>
                </div>

                {isEditingTool ? (
                    <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 space-y-4">
                         <h3 className="text-lg font-bold text-white mb-4">{isEditingTool === 'new' ? 'Create Tool' : 'Edit Tool'}</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-eburon-fg/60 mb-1">Tool Name</label>
                                <input 
                                    type="text" 
                                    value={toolFormData.name || ''} 
                                    onChange={e => setToolFormData({...toolFormData, name: e.target.value})}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                    placeholder="e.g. check_flight_status"
                                />
                            </div>
                             <div>
                                <label className="block text-xs text-eburon-fg/60 mb-1">Description</label>
                                <input 
                                    type="text" 
                                    value={toolFormData.description || ''} 
                                    onChange={e => setToolFormData({...toolFormData, description: e.target.value})}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                    placeholder="Description of what this tool does"
                                />
                            </div>
                         </div>
                         <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-eburon-fg/60 mb-1">Method</label>
                                <select 
                                    value={toolFormData.method || 'POST'} 
                                    onChange={e => setToolFormData({...toolFormData, method: e.target.value as 'GET' | 'POST'})}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                </select>
                            </div>
                             <div className="col-span-2">
                                <label className="block text-xs text-eburon-fg/60 mb-1">Endpoint URL</label>
                                <input 
                                    type="text" 
                                    value={toolFormData.url || ''} 
                                    onChange={e => setToolFormData({...toolFormData, url: e.target.value})}
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                    placeholder="https://api.example.com/v1/resource"
                                />
                            </div>
                         </div>
                         <div>
                             <label className="block text-xs text-eburon-fg/60 mb-1">Input Schema (JSON)</label>
                             <textarea 
                                value={toolFormData.body || '{}'} 
                                onChange={e => setToolFormData({...toolFormData, body: e.target.value})}
                                className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 font-mono text-xs h-32 focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                placeholder='{"type": "object", "properties": {"param1": {"type": "string"}}}'
                             />
                         </div>
                         <div>
                             <label className="block text-xs text-eburon-fg/60 mb-1">Headers (JSON)</label>
                             <textarea 
                                value={toolFormData.headers || '{}'} 
                                onChange={e => setToolFormData({...toolFormData, headers: e.target.value})}
                                className="w-full bg-eburon-bg border border-eburon-border rounded-lg p-3 font-mono text-xs h-20 focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                                placeholder='{"Authorization": "Bearer ..."}'
                             />
                         </div>
                         <div className="flex justify-end gap-3 pt-2">
                             <button 
                                onClick={() => setIsEditingTool(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-eburon-bg text-eburon-fg hover:bg-white/5"
                             >
                                 Cancel
                             </button>
                             <button 
                                onClick={handleSaveTool}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-eburon-accent text-white hover:bg-eburon-accent-dark"
                             >
                                 Save Tool
                             </button>
                         </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {tools.length === 0 && <p className="text-center text-eburon-fg/50 py-8">No tools defined. Create one to get started.</p>}
                        {tools.map(tool => (
                            <div key={tool.id} className="bg-eburon-panel border border-eburon-border p-4 rounded-xl flex items-center justify-between group">
                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        {tool.name} 
                                        <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-eburon-accent">{tool.method}</span>
                                    </h3>
                                    <p className="text-sm text-eburon-fg/60">{tool.description}</p>
                                    <p className="text-xs text-eburon-fg/30 font-mono mt-1 truncate max-w-md">{tool.url}</p>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => handleEditTool(tool)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-eburon-fg/70 hover:text-white"
                                        data-tooltip="Edit"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteTool(tool.id)}
                                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                                        data-tooltip="Delete"
                                    >
                                        <Trash2Icon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
          )}

          {/* TAB: DATA MANAGEMENT */}
          {activeTab === 'data' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
               <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <DatabaseIcon className="w-5 h-5 text-eburon-accent" />
                  Data Import / Export
                </h2>
                <span className="text-xs text-eburon-fg/40">Manage Supabase Records</span>
              </div>

              <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6">
                  <div className="mb-6">
                     <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50 mb-2">Select Table</label>
                     <div className="flex gap-2 flex-wrap">
                        <button 
                            onClick={() => setSelectedTable('agents')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTable === 'agents' ? 'bg-eburon-accent text-white' : 'bg-eburon-bg text-eburon-fg/70 hover:text-white'}`}
                        >
                            Agents
                        </button>
                        <button 
                             onClick={() => setSelectedTable('crm_bookings')}
                             className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTable === 'crm_bookings' ? 'bg-eburon-accent text-white' : 'bg-eburon-bg text-eburon-fg/70 hover:text-white'}`}
                        >
                            CRM Bookings
                        </button>
                        <button 
                             onClick={() => setSelectedTable('tools' as any)}
                             className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTable === 'tools' ? 'bg-eburon-accent text-white' : 'bg-eburon-bg text-eburon-fg/70 hover:text-white'}`}
                        >
                            Tools
                        </button>
                        <button 
                             onClick={() => setSelectedTable('call_logs' as any)}
                             className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTable === 'call_logs' ? 'bg-eburon-accent text-white' : 'bg-eburon-bg text-eburon-fg/70 hover:text-white'}`}
                        >
                            Call Logs
                        </button>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* EXPORT */}
                      <div className="bg-eburon-bg p-5 rounded-xl border border-eburon-border/50">
                          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                              <DownloadIcon className="w-4 h-4" /> Export CSV
                          </h3>
                          <p className="text-xs text-eburon-fg/50 mb-4">Download a CSV file containing all records from the <strong>{selectedTable}</strong> table.</p>
                          <button 
                            onClick={handleExportCSV}
                            className="w-full py-2.5 bg-eburon-panel border border-eburon-border hover:border-eburon-accent hover:text-white text-eburon-fg rounded-lg transition-all text-sm font-semibold"
                          >
                            Download CSV
                          </button>
                      </div>

                      {/* IMPORT */}
                      <div className="bg-eburon-bg p-5 rounded-xl border border-eburon-border/50">
                          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                              <UploadIcon className="w-4 h-4" /> Import CSV
                          </h3>
                          <p className="text-xs text-eburon-fg/50 mb-4">Upload a CSV to bulk upsert records. Existing IDs will be updated.</p>
                          <div className="relative">
                             <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleImportCSV}
                                accept=".csv"
                                className="hidden"
                             />
                             <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-2.5 bg-eburon-accent hover:bg-eburon-accent-dark text-white rounded-lg transition-all text-sm font-semibold"
                             >
                                Select CSV File
                             </button>
                          </div>
                      </div>
                  </div>

                  {/* Status Message */}
                  {importStatus !== 'idle' && (
                      <div className={`mt-6 p-4 rounded-lg text-sm flex items-center gap-3 ${
                          importStatus === 'error' ? 'bg-red-500/10 text-red-200 border border-red-500/20' : 
                          importStatus === 'success' ? 'bg-eburon-ok/10 text-eburon-ok border border-eburon-ok/20' :
                          'bg-eburon-panel text-eburon-fg/70'
                      }`}>
                          {importStatus === 'processing' && <RefreshIcon className="w-4 h-4 animate-spin" />}
                          {importStatus === 'success' && <CheckCircleIcon className="w-4 h-4" />}
                          {importStatus === 'error' && <Trash2Icon className="w-4 h-4" />}
                          <span>{importMessage}</span>
                      </div>
                  )}
              </div>
            </section>
          )}
          
           {/* TAB: TEST LAB */}
           {activeTab === 'test-lab' && (
            <section className="space-y-4 animate-fade-in h-full flex flex-col">
                <div className="flex items-center justify-between flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <BugIcon className="w-5 h-5 text-eburon-accent" />
                        Agent Test Laboratory
                    </h2>
                     <div className="flex items-center gap-2">
                        <select 
                            value={selectedTestAgentId}
                            onChange={(e) => setSelectedTestAgentId(e.target.value)}
                            className="bg-eburon-panel border border-eburon-border rounded-lg py-1.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                        >
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                        </select>
                        <button 
                            onClick={clearTestSession}
                            className="p-2 rounded-lg bg-eburon-panel border border-eburon-border hover:bg-white/5 text-eburon-fg"
                            data-tooltip="Reset Session"
                        >
                            <Trash2Icon className="w-4 h-4" />
                        </button>
                     </div>
                </div>
                
                <div className="flex-1 min-h-[600px] grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                    {/* Left: Simulation */}
                    <div className="bg-eburon-panel border border-eburon-border rounded-xl flex flex-col overflow-hidden shadow-lg">
                        <div className="p-3 border-b border-eburon-border bg-eburon-bg/50 flex items-center gap-2">
                            <PlayCircleIcon className="w-4 h-4 text-eburon-ok" />
                            <span className="text-xs font-bold uppercase tracking-wider text-eburon-fg/70">Simulation Preview</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-eburon-bg/30">
                             {testHistory.length === 0 && (
                                 <div className="flex h-full items-center justify-center text-eburon-fg/30 flex-col gap-2">
                                     <BugIcon className="w-8 h-8 opacity-50" />
                                     <p className="text-sm">Ready to test agent behavior.</p>
                                 </div>
                             )}
                             {testHistory.map((msg, idx) => (
                                 <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                     <div className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-eburon-accent text-white' : 'bg-eburon-panel border border-eburon-border text-eburon-fg'}`}>
                                         {msg.text || (idx === testHistory.length - 1 && isTesting ? <span className="animate-pulse">...</span> : '')}
                                     </div>
                                 </div>
                             ))}
                             <div ref={testChatEndRef} />
                        </div>
                        <div className="p-4 border-t border-eburon-border bg-eburon-panel">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={testInput}
                                    onChange={(e) => setTestInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTestSend()}
                                    placeholder="Type a message to test..."
                                    className="w-full bg-eburon-bg border border-eburon-border rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-eburon-accent"
                                    disabled={isTesting}
                                />
                                <button 
                                    onClick={handleTestSend}
                                    disabled={isTesting || !testInput.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-eburon-fg/50 hover:text-eburon-accent disabled:opacity-50"
                                >
                                    <SendIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Debug Console */}
                    <div className="bg-[#0D0D0F] border border-eburon-border rounded-xl flex flex-col overflow-hidden font-mono text-xs shadow-lg">
                        <div className="p-3 border-b border-eburon-border bg-eburon-bg/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TerminalIcon className="w-4 h-4 text-eburon-warn" />
                                <span className="font-bold uppercase tracking-wider text-eburon-fg/70">Debug Console</span>
                            </div>
                            <span className="text-[10px] text-eburon-fg/30">{testLogs.length} Events</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-eburon-fg/80">
                             {testLogs.length === 0 && (
                                 <p className="text-eburon-fg/30 italic">Waiting for events...</p>
                             )}
                             {testLogs.map((log) => (
                                 <div key={log.id} className="border-l-2 border-white/10 pl-3 py-1 relative group">
                                     <div className="flex items-center gap-2 mb-1">
                                         <span className="text-[10px] text-eburon-fg/40">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                         <span className={`uppercase font-bold text-[10px] px-1.5 rounded ${
                                             log.type === 'tool_call' ? 'bg-yellow-500/20 text-yellow-400' :
                                             log.type === 'error' ? 'bg-red-500/20 text-red-400' :
                                             log.type === 'response' ? 'bg-green-500/20 text-green-400' :
                                             'bg-blue-500/20 text-blue-400'
                                         }`}>{log.type.replace('_', ' ')}</span>
                                     </div>
                                     <p className="break-words whitespace-pre-wrap">{log.content}</p>
                                     {log.details && (
                                         <div className="mt-1 p-2 bg-black/30 rounded text-[10px] text-eburon-fg/60 overflow-x-auto">
                                             <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                         </div>
                                     )}
                                 </div>
                             ))}
                        </div>
                    </div>
                </div>
            </section>
          )}
          
          {/* TAB: DATABASE SETUP */}
          {activeTab === 'db-setup' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
               <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ServerIcon className="w-5 h-5 text-eburon-accent" />
                  Database Initialization
                </h2>
                <span className="text-xs text-eburon-fg/40">Supabase SQL Setup</span>
              </div>

              <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 space-y-6">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200">
                    <p className="flex items-start gap-2">
                        <span className="text-lg">ℹ️</span>
                        <span>
                            The Eburon application requires specific Tables and Storage Buckets in your Supabase project to function correctly.
                            <br />
                            Copy the SQL script below and run it in your <strong>Supabase SQL Editor</strong> to initialize the database schema.
                        </span>
                    </p>
                 </div>

                  <div className="bg-black/50 border border-eburon-border rounded-lg p-4 relative group">
                      <button 
                          onClick={handleCopySQL}
                          className="absolute top-3 right-3 p-2 bg-eburon-accent/10 hover:bg-eburon-accent text-eburon-accent hover:text-white rounded-lg transition-all text-xs font-bold flex items-center gap-2"
                      >
                          <CopyIcon className="w-4 h-4" />
                          {copySqlStatus}
                      </button>
                      <pre className="font-mono text-xs text-eburon-fg/80 whitespace-pre-wrap overflow-x-auto h-[400px] p-2">
                          {getDatabaseSchemaSQL()}
                      </pre>
                  </div>

                  <div className="flex justify-end">
                      <a 
                          href="https://supabase.com/dashboard/project/_/sql/new" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-eburon-accent hover:text-white hover:underline text-sm"
                      >
                          Open Supabase SQL Editor <ApiIcon className="w-3 h-3" />
                      </a>
                  </div>
              </div>
            </section>
          )}

          {/* TAB: AUTHENTICATION */}
          {activeTab === 'auth' && (
            <section className="space-y-6 animate-fade-in max-w-4xl mx-auto">
               <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <GoogleIcon className="w-5 h-5 text-eburon-accent" />
                  Authentication Deployment
                </h2>
                <span className="text-xs text-eburon-fg/40">Google OAuth Setup</span>
              </div>

              <div className="bg-eburon-panel border border-eburon-border rounded-xl p-6 space-y-8">
                  
                  {/* STEP 1: GOOGLE CLOUD */}
                  <div>
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white">Step 1: Configure Google Cloud Project</h3>
                          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-xs text-eburon-accent hover:underline flex items-center gap-1">
                              Open Console <ApiIcon className="w-3 h-3" />
                          </a>
                      </div>
                      <ol className="list-decimal list-inside space-y-3 text-sm text-eburon-fg/80 bg-eburon-bg p-5 rounded-xl border border-eburon-border/50">
                          <li>Create a new project in the Google Cloud Console.</li>
                          <li>Navigate to <strong>APIs & Services</strong> {'>'} <strong>OAuth consent screen</strong>. Select "External" and create.</li>
                          <li>Go to <strong>Credentials</strong> {'>'} <strong>Create Credentials</strong> {'>'} <strong>OAuth client ID</strong>.</li>
                          <li>Select <strong>Web application</strong>.</li>
                          <li>
                              Add <strong>Authorized JavaScript origins</strong>:
                              <code className="block mt-1 p-2 bg-black/30 rounded text-xs text-eburon-accent font-mono select-all">https://xibssyjivjzcjmleupsb.supabase.co</code>
                          </li>
                          <li>
                              Add <strong>Authorized redirect URIs</strong>:
                              <code className="block mt-1 p-2 bg-black/30 rounded text-xs text-eburon-accent font-mono select-all">https://xibssyjivjzcjmleupsb.supabase.co/auth/v1/callback</code>
                          </li>
                          <li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong>.</li>
                      </ol>
                  </div>

                  {/* STEP 2: SUPABASE */}
                  <div>
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white">Step 2: Configure Supabase Auth</h3>
                          <a href="https://supabase.com/dashboard/project/xibssyjivjzcjmleupsb/auth/providers" target="_blank" rel="noreferrer" className="text-xs text-eburon-accent hover:underline flex items-center gap-1">
                              Open Dashboard <DatabaseIcon className="w-3 h-3" />
                          </a>
                      </div>
                      <ol className="list-decimal list-inside space-y-3 text-sm text-eburon-fg/80 bg-eburon-bg p-5 rounded-xl border border-eburon-border/50">
                          <li>Navigate to your Supabase Project Dashboard.</li>
                          <li>Go to <strong>Authentication</strong> {'>'} <strong>Providers</strong>.</li>
                          <li>Select <strong>Google</strong> from the list and toggle it to "Enabled".</li>
                          <li>Paste the <strong>Client ID</strong> and <strong>Client Secret</strong> obtained from Google Cloud in Step 1.</li>
                          <li>Click <strong>Save</strong>.</li>
                      </ol>
                  </div>

                   <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 items-start">
                      <div className="mt-0.5">
                          <ServerIcon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                          <h4 className="text-sm font-bold text-blue-200">Deployment Note</h4>
                          <p className="text-xs text-blue-200/70 mt-1">
                              Ensure that your Supabase project's URL (used in Step 1) matches the `supabaseUrl` configured in the <strong>API Keys</strong> tab of this admin panel.
                          </p>
                      </div>
                   </div>

              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

const ApiKeyInput = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-eburon-panel border border-eburon-border p-4 rounded-xl hover:border-eburon-accent/30 transition-colors">
      <label className="block text-xs font-bold uppercase tracking-wider text-eburon-fg/50 mb-2">{label}</label>
      <div className="relative flex items-center">
        <div className="absolute left-3 text-eburon-fg/30">
            <KeyIcon className="w-4 h-4" />
        </div>
        <input 
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-eburon-bg border border-eburon-border rounded-lg pl-10 pr-12 py-3 text-sm text-white placeholder-eburon-fg/30 focus:outline-none focus:ring-2 focus:ring-eburon-accent transition-all font-mono"
        />
        <button 
          onClick={() => setShow(!show)}
          className="absolute right-3 text-eburon-fg/40 hover:text-white transition-colors"
          data-tooltip={show ? "Hide Key" : "Show Key"}
        >
            {show ? <div className="w-5 h-5 bg-eburon-fg/20 rounded-full flex items-center justify-center"><div className="w-3 h-0.5 bg-eburon-fg"></div></div> : <EyeIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default AdminSettingsView;
