
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Agent, Voice, AgentTool } from '../types';
import * as dataService from '../services/dataService';
import { uploadAgentAvatar } from '../services/supabaseService';
import { AgentIcon, PlusIcon, SaveIcon, PlayIcon, PauseIcon, CheckCircleIcon, Trash2Icon, ChevronLeftIcon, VoiceIcon, EditIcon, PhoneIcon, BookIcon, UploadIcon, UserIcon, XIcon, BrainCircuitIcon, CodeIcon, RefreshIcon } from './icons';
import { LoadingIndicator } from './LoadingIndicator';
import { VOICE_PREVIEW_CONFIG, STEPHEN_DEFAULT_AGENT } from '../constants';
import { PromptLibraryModal } from './PromptLibraryModal';

const AgentsView: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [voices, setVoices] = useState<Voice[]>([]);
    const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    
    // Prompt Library State
    const [isPromptLibraryOpen, setIsPromptLibraryOpen] = useState(false);

    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
    const [audioCache, setAudioCache] = useState<Record<string, string>>({});
    const [isRefreshingVoices, setIsRefreshingVoices] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [fetchedAgents, fetchedVoices, fetchedTools] = await Promise.all([
                dataService.getAgents(),
                dataService.getVoices(),
                dataService.getTools()
            ]);
            setAgents(fetchedAgents);
            setVoices(fetchedVoices);
            setAvailableTools(fetchedTools);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const audio = audioRef.current;
        const onEnded = () => setPlayingVoiceId(null);
        audio?.addEventListener('ended', onEnded);
        return () => audio?.removeEventListener('ended', onEnded);
    }, []);

    const handleRefreshVoices = async () => {
        setIsRefreshingVoices(true);
        try {
            const fetchedVoices = await dataService.getVoices();
            setVoices(fetchedVoices);
        } catch (err: any) {
            console.error("Failed to refresh voices:", err);
        } finally {
            setIsRefreshingVoices(false);
        }
    };

    const getLanguageFromTags = (tags: string[] = []): string => {
        const supportedLangs = Object.keys(VOICE_PREVIEW_CONFIG);
        for (const tag of tags) {
            const lang = tag.toLowerCase();
            if (supportedLangs.includes(lang)) {
                return lang;
            }
        }
        return 'default';
    };

    const handlePlayPreview = async (voiceId: string) => {
        const voice = voices.find(v => v.id === voiceId);
        if (!voice) return;
        
        if (loadingVoiceId === voice.id) return;
        
        if (playingVoiceId === voice.id) {
            audioRef.current?.pause();
            setPlayingVoiceId(null);
            return;
        }

        setPlayingVoiceId(null);
        if (audioRef.current) audioRef.current.src = '';
        
        if (audioCache[voice.id]) {
            if (audioRef.current) {
                audioRef.current.src = audioCache[voice.id];
                audioRef.current.play();
                setPlayingVoiceId(voice.id);
            }
            return;
        }

        setLoadingVoiceId(voice.id);
        setError(null);
        try {
            const langKey = getLanguageFromTags(voice.tags);
            const config = VOICE_PREVIEW_CONFIG[langKey] || VOICE_PREVIEW_CONFIG.default;
            
            const audioBlob = await dataService.generateVoiceSample(voice.id, config.text, config.langCode);
            const url = URL.createObjectURL(audioBlob);
            setAudioCache(prev => ({...prev, [voice.id]: url}));
            
            if (audioRef.current) {
                audioRef.current.src = url;
                audioRef.current.play();
                setPlayingVoiceId(voice.id);
            }
        } catch (err: any) {
            setError(err.message);
            console.error(err);
        } finally {
            setLoadingVoiceId(null);
        }
    };


    const handleSelectAgent = (agent: Agent) => {
        setSelectedCardId(null); // Deselect card when entering edit mode
        // Ensure tools is an array of strings
        const safeTools = Array.isArray(agent.tools) ? agent.tools : [];
        setSelectedAgent({ ...agent, tools: safeTools }); 
        setSaveStatus('idle'); // Reset save status when selecting a new agent
    };

    const handleCreateNewAgent = () => {
        // Use crypto.randomUUID if available (modern browsers), otherwise fallback or let DB handle it?
        // For this app, we'll assume modern browser support or use a simple generator if needed.
        // Using a proper UUID format ensures DB compatibility.
        const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `agent-${Date.now()}`;

        const newAgent: Agent = {
            id: newId,
            name: 'New Agent',
            description: 'A new agent configuration.',
            voice: voices.length > 0 ? voices[0].id : '',
            systemPrompt: 'You are a helpful assistant.',
            firstSentence: 'Hello, how can I help you today?',
            thinkingMode: false,
            avatarUrl: null,
            tools: [],
            isActiveForDialer: false,
        };
        setSelectedAgent(newAgent);
        setSaveStatus('idle');
    };
    
    const handleBackToList = () => {
        setSelectedAgent(null);
        setError(null);
    };

    const handleUpdateSelectedAgent = (field: keyof Agent, value: any) => {
        if (selectedAgent) {
            setSelectedAgent(prev => prev ? { ...prev, [field]: value } : null);
        }
    };
    
    const handleApplyPromptTemplate = (content: string) => {
        handleUpdateSelectedAgent('systemPrompt', content);
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedAgent) return;

        setIsUploadingAvatar(true);
        setError(null);
        try {
            const publicUrl = await uploadAgentAvatar(selectedAgent.id, file);
            handleUpdateSelectedAgent('avatarUrl', publicUrl);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const toggleTool = (toolId: string) => {
        if (!selectedAgent) return;
        const currentTools = selectedAgent.tools || [];
        const isSelected = currentTools.includes(toolId);
        
        let newTools;
        if (isSelected) {
            newTools = currentTools.filter(id => id !== toolId);
        } else {
            newTools = [...currentTools, toolId];
        }
        handleUpdateSelectedAgent('tools', newTools);
    };


    const handleSaveChanges = async () => {
        if (!selectedAgent) return;

        setSaveStatus('saving');
        setError(null);
        try {
            await dataService.upsertAgents([selectedAgent]);
            setSaveStatus('success');

            setTimeout(async () => {
                await loadData();
                handleBackToList();
            }, 1500);

        } catch (err: any) {
            setError(err.message);
            setSaveStatus('idle');
        }
    };

    const handleDeleteAgent = async () => {
        if (!selectedAgent) return;
        if (!window.confirm(`Are you sure you want to delete the agent "${selectedAgent.name}"? This action cannot be undone.`)) {
            return;
        }
        
        setError(null);
        try {
            await dataService.deleteAgent(selectedAgent.id);
            await loadData();
            handleBackToList();
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleActivateAgent = async (agentId: string) => {
        // Optimistic update for snappy UI
        setAgents(prev => prev.map(a => ({
            ...a,
            isActiveForDialer: a.id === agentId
        })));

        try {
            await dataService.setActiveDialerAgent(agentId);
        } catch (err: any) {
            setError(err.message);
            // Revert on error
            loadData();
        }
    };

    const handleDeactivateAgent = async () => {
        // Optimistic update
        setAgents(prev => prev.map(a => ({ ...a, isActiveForDialer: false })));
    
        try {
            await dataService.deactivateActiveDialerAgent();
        } catch (err: any) {
            setError(err.message);
            // Revert on error
            loadData();
        }
    };

    if (isLoading) {
        return <LoadingIndicator text="Loading Agents..." />;
    }

    if (selectedAgent) {
        return (
            <div className="h-full">
                {isPromptLibraryOpen && (
                    <PromptLibraryModal 
                        onSelect={handleApplyPromptTemplate} 
                        onClose={() => setIsPromptLibraryOpen(false)} 
                    />
                )}

                <audio ref={audioRef} className="hidden" />
                {error && <div className="p-4 mb-4 text-center text-red-400 bg-red-900/50 border border-red-500 rounded-lg">{error}</div>}
                
                <div className="flex justify-between items-start gap-4 mb-6 flex-wrap">
                    <button 
                        onClick={handleBackToList} 
                        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-eburon-panel transition-colors -ml-3"
                        data-tooltip="Return to list"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                        <span className="font-semibold">Back to Agents</span>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                         {/* Allow delete for any agent except default Stephen */}
                        {selectedAgent.id !== STEPHEN_DEFAULT_AGENT.id && (
                            <button
                                onClick={handleDeleteAgent}
                                className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-red-800/50 hover:bg-red-800/80 text-red-200"
                                data-tooltip="Delete Agent"
                            >
                                <Trash2Icon className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={handleSaveChanges} 
                            disabled={saveStatus !== 'idle'} 
                            className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200
                                ${saveStatus === 'idle' ? 'bg-eburon-accent hover:bg-eburon-accent-dark text-white' : ''}
                                ${saveStatus === 'saving' ? 'bg-gray-500 text-white cursor-not-allowed' : ''}
                                ${saveStatus === 'success' ? 'bg-eburon-ok text-white cursor-not-allowed' : ''}
                            `}
                            data-tooltip="Save Changes"
                        >
                            {saveStatus === 'saving' && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                            {saveStatus === 'success' && <CheckCircleIcon className="w-5 h-5" />}
                            {saveStatus === 'idle' && <SaveIcon className="w-5 h-5" />}
                            <span>
                                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save'}
                            </span>
                        </button>
                     </div>
                </div>

                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="flex gap-6 items-start flex-col md:flex-row">
                         {/* Avatar Section */}
                        <div className="flex-shrink-0 self-center md:self-start">
                            <div className="relative w-32 h-32 rounded-2xl overflow-hidden bg-eburon-panel border border-eburon-border group shadow-lg">
                                 {selectedAgent.avatarUrl ? (
                                     <img src={selectedAgent.avatarUrl} alt={selectedAgent.name} className="w-full h-full object-cover" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center text-eburon-fg/20 bg-eburon-bg">
                                         <UserIcon className="w-16 h-16" />
                                     </div>
                                 )}
                                 <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                     <label className="cursor-pointer p-2 text-white hover:text-eburon-accent transition-colors" data-tooltip="Upload Avatar">
                                         <UploadIcon className="w-8 h-8" />
                                         <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                     </label>
                                     {selectedAgent.avatarUrl && (
                                         <button 
                                            onClick={() => handleUpdateSelectedAgent('avatarUrl', null)} 
                                            className="p-2 text-white hover:text-red-400 transition-colors mt-2"
                                            data-tooltip="Remove Avatar"
                                         >
                                             <XIcon className="w-6 h-6" />
                                         </button>
                                     )}
                                 </div>
                            </div>
                             {isUploadingAvatar && <p className="text-xs text-center mt-2 text-eburon-accent animate-pulse">Uploading...</p>}
                             <div className="mt-2 text-center">
                                <label className="text-xs text-eburon-fg/40 uppercase tracking-widest font-bold">Avatar</label>
                             </div>
                        </div>

                        <div className="flex-grow w-full space-y-6">
                             <div>
                                <h2 className="text-3xl font-bold text-eburon-fg">{selectedAgent.name}</h2>
                                <p className="text-eburon-fg/70">Configure your AI agent's personality, voice, and capabilities.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="agentName" className="block text-sm font-medium text-eburon-fg/80 mb-1">Agent Name</label>
                                    <input type="text" id="agentName" value={selectedAgent.name} onChange={e => handleUpdateSelectedAgent('name', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" />
                                </div>
                                 <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label htmlFor="agentVoice" className="block text-sm font-medium text-eburon-fg/80">Voice</label>
                                        <button 
                                            onClick={handleRefreshVoices}
                                            disabled={isRefreshingVoices}
                                            className="text-xs text-eburon-accent hover:text-white flex items-center gap-1 transition-colors disabled:opacity-50"
                                            title="Fetch latest voices from Bland.ai"
                                        >
                                            <RefreshIcon className={`w-3 h-3 ${isRefreshingVoices ? 'animate-spin' : ''}`} />
                                            <span>Refresh List</span>
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                                        <select id="agentVoice" value={selectedAgent.voice} onChange={e => handleUpdateSelectedAgent('voice', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent">
                                            {voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
                                        </select>
                                        <button
                                            onClick={() => handlePlayPreview(selectedAgent.voice)}
                                            disabled={!selectedAgent.voice || loadingVoiceId === selectedAgent.voice}
                                            className="p-2.5 rounded-lg hover:bg-white/10 text-eburon-fg disabled:opacity-50 bg-eburon-panel border border-eburon-border transition-colors"
                                            data-tooltip="Preview Voice"
                                        >
                                            {loadingVoiceId === selectedAgent.voice ? (
                                                <div className="w-6 h-6 border-2 border-eburon-fg/50 border-t-eburon-fg rounded-full animate-spin"></div>
                                            ) : playingVoiceId === selectedAgent.voice ? (
                                                <PauseIcon className="w-6 h-6" />
                                            ) : (
                                                <PlayIcon className="w-6 h-6" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Thinking Mode Toggle */}
                    <div className="flex items-center justify-between bg-eburon-panel border border-eburon-border p-4 rounded-xl shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${selectedAgent.thinkingMode ? 'bg-purple-500/20 text-purple-400' : 'bg-eburon-bg text-eburon-fg/30'}`}>
                                <BrainCircuitIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-bold text-eburon-fg">Thinking Mode</p>
                                <p className="text-xs text-eburon-fg/60 max-w-md">Enables extended chain-of-thought reasoning for complex tasks (Powered by Gemini 2.5 Pro).</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleUpdateSelectedAgent('thinkingMode', !selectedAgent.thinkingMode)}
                            className={`relative w-14 h-7 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-eburon-accent focus:ring-offset-eburon-bg ${selectedAgent.thinkingMode ? 'bg-eburon-accent' : 'bg-eburon-bg border border-eburon-border'}`}
                            data-tooltip="Toggle Thinking Mode"
                        >
                            <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out ${selectedAgent.thinkingMode ? 'translate-x-7' : ''}`} />
                        </button>
                    </div>

                    <div>
                        <label htmlFor="avatarUrlInput" className="block text-sm font-medium text-eburon-fg/80 mb-1">Avatar URL</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                id="avatarUrlInput" 
                                value={selectedAgent.avatarUrl || ''} 
                                onChange={e => handleUpdateSelectedAgent('avatarUrl', e.target.value)} 
                                className="flex-grow bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent text-sm" 
                                placeholder="https://example.com/avatar.png"
                            />
                        </div>
                        <p className="text-xs text-eburon-fg/40 mt-1">Enter a direct image URL or use the upload button on the avatar preview above.</p>
                    </div>
                    
                    <div>
                        <label htmlFor="agentDescription" className="block text-sm font-medium text-eburon-fg/80 mb-1">Description</label>
                        <textarea id="agentDescription" rows={2} value={selectedAgent.description} onChange={e => handleUpdateSelectedAgent('description', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" placeholder="A brief summary of the agent's purpose."></textarea>
                    </div>
                    <div>
                        <label htmlFor="firstSentence" className="block text-sm font-medium text-eburon-fg/80 mb-1">First Sentence</label>
                        <textarea id="firstSentence" rows={2} value={selectedAgent.firstSentence} onChange={e => handleUpdateSelectedAgent('firstSentence', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-eburon-accent" placeholder="The first thing the agent says when the call connects."></textarea>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="systemPrompt" className="block text-sm font-medium text-eburon-fg/80">System Prompt</label>
                            <button 
                                onClick={() => setIsPromptLibraryOpen(true)}
                                className="text-xs text-eburon-accent hover:text-white flex items-center gap-1 bg-eburon-panel px-2 py-1 rounded border border-eburon-border hover:border-eburon-accent transition-colors"
                            >
                                <BookIcon className="w-3 h-3" />
                                Open Prompt Library
                            </button>
                        </div>
                        <textarea id="systemPrompt" rows={12} value={selectedAgent.systemPrompt} onChange={e => handleUpdateSelectedAgent('systemPrompt', e.target.value)} className="w-full bg-eburon-panel border border-eburon-border rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-eburon-accent leading-relaxed" placeholder="Define the agent's personality, instructions, and goals."></textarea>
                    </div>

                    <div>
                        <label htmlFor="agentTools" className="block text-sm font-medium text-eburon-fg/80 mb-1">Tools</label>
                        <div className="bg-eburon-panel border border-eburon-border rounded-lg p-4">
                            <p className="text-xs text-eburon-fg/60 mb-3">Select tools available to this agent. Create new tools in Admin Settings.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableTools.map((tool) => (
                                    <button
                                        key={tool.id}
                                        onClick={() => toggleTool(tool.id)}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                            (selectedAgent.tools || []).includes(tool.id)
                                            ? 'bg-eburon-accent/20 border-eburon-accent text-white'
                                            : 'bg-eburon-bg border-eburon-border text-eburon-fg/70 hover:border-eburon-fg/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <CodeIcon className="w-4 h-4" />
                                            <div className="text-left">
                                                <p className="text-sm font-bold">{tool.name}</p>
                                                <p className="text-[10px] opacity-70 truncate w-32">{tool.description}</p>
                                            </div>
                                        </div>
                                        {(selectedAgent.tools || []).includes(tool.id) && (
                                            <CheckCircleIcon className="w-5 h-5 text-eburon-ok" />
                                        )}
                                    </button>
                                ))}
                                {availableTools.length === 0 && (
                                    <div className="col-span-full text-center text-eburon-fg/50 italic py-2">No tools available. Configure them in Admin Settings.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <audio ref={audioRef} className="hidden" />
            <div className="pb-6">
                <h1 className="text-3xl font-bold text-eburon-fg">Your Agents</h1>
                <p className="text-eburon-fg/70">Manage, create, and configure your voice AI agents.</p>
            </div>
            <div className="flex-grow">
                {error && <div className="p-4 text-center text-red-400">{error}</div>}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <button
                        onClick={handleCreateNewAgent}
                        className="bg-eburon-panel border-2 border-dashed border-eburon-border hover:border-eburon-accent hover:text-eburon-accent transition-colors duration-300 rounded-xl flex flex-col items-center justify-center p-6 text-eburon-fg/70 aspect-square"
                    >
                        <PlusIcon className="w-12 h-12 mb-2" />
                        <span className="font-semibold">Create New Agent</span>
                    </button>
                    {agents.map(agent => (
                        <div 
                            key={agent.id} 
                            onClick={() => setSelectedCardId(agent.id === selectedCardId ? null : agent.id)}
                            className={`relative group bg-eburon-panel rounded-xl p-6 text-left flex flex-col h-full cursor-pointer hover:bg-white/5 hover:shadow-lg hover:shadow-eburon-accent/10 transition-all duration-300 transform hover:-translate-y-1 ${
                                agent.isActiveForDialer 
                                ? 'border-2 border-eburon-ok shadow-lg shadow-eburon-ok/20' 
                                : selectedCardId === agent.id 
                                ? 'border-2 border-eburon-accent shadow-lg shadow-eburon-accent/20' 
                                : 'border border-eburon-border hover:border-eburon-accent'
                            }`}
                        >
                            <div className="flex-grow">
                                <div className="flex items-center gap-4 mb-4">
                                     <div className="relative w-14 h-14 rounded-lg bg-eburon-bg border border-eburon-border overflow-hidden flex-shrink-0 group-hover:border-eburon-accent/50 transition-colors">
                                         {agent.avatarUrl ? (
                                             <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
                                         ) : (
                                             <div className="w-full h-full flex items-center justify-center text-eburon-fg/20">
                                                 <AgentIcon className="w-8 h-8" />
                                             </div>
                                         )}
                                         <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePlayPreview(agent.voice);
                                            }}
                                            className="absolute inset-0 bg-eburon-accent/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:opacity-50"
                                            data-tooltip={`Preview Voice`}
                                        >
                                            {loadingVoiceId === agent.voice ? (
                                                <div className="w-6 h-6 border-2 border-eburon-fg/50 border-t-white rounded-full animate-spin"></div>
                                            ) : playingVoiceId === agent.voice ? (
                                                <PauseIcon className="w-6 h-6 text-white" />
                                            ) : (
                                                <PlayIcon className="w-6 h-6 text-white" />
                                            )}
                                        </button>
                                     </div>
                                     <div className="min-w-0">
                                         <h3 className="text-lg font-bold text-eburon-fg truncate">{agent.name}</h3>
                                         <div className="flex items-center gap-1.5 text-xs text-eburon-fg/60">
                                            <VoiceIcon className="w-3 h-3" />
                                            <span className="truncate max-w-[100px]">{voices.find(v => v.id === agent.voice)?.name || 'Default'}</span>
                                        </div>
                                     </div>
                                </div>
                                <p title={agent.description || 'No description provided.'} className="text-sm text-eburon-fg/70 line-clamp-3 min-h-[60px]">{agent.description || 'No description provided.'}</p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-eburon-border flex items-center justify-between text-xs text-eburon-fg/60">
                                <div className="flex items-center gap-1.5" title={agent.thinkingMode ? "Thinking Mode Active" : "Standard Mode"}>
                                    <BrainCircuitIcon className={`w-4 h-4 ${agent.thinkingMode ? 'text-purple-400' : 'text-eburon-fg/30'}`} />
                                    <span>{agent.thinkingMode ? 'Smart' : 'Fast'}</span>
                                </div>
                                <span className="font-mono bg-eburon-bg px-2 py-0.5 rounded flex-shrink-0">{Array.isArray(agent.tools) ? agent.tools.length : 0} tools</span>
                            </div>
                             <div className="mt-4">
                                {agent.isActiveForDialer ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeactivateAgent(); }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-eburon-ok text-black hover:bg-red-500/80 hover:text-white"
                                        data-tooltip="Click to deactivate and use the default Stephen agent."
                                    >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        <span>Active in Dialer</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleActivateAgent(agent.id); }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-eburon-bg border border-eburon-border hover:bg-eburon-accent hover:text-white hover:border-eburon-accent"
                                        data-tooltip="Activate for Dialer"
                                    >
                                        <PhoneIcon className="w-4 h-4" />
                                        <span>Activate for Dialer</span>
                                    </button>
                                )}
                            </div>
                             {agent.id !== STEPHEN_DEFAULT_AGENT.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectAgent(agent);
                                    }}
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-eburon-bg/50 backdrop-blur-sm text-eburon-fg/70 hover:text-eburon-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                                    data-tooltip={`Edit ${agent.name}`}
                                >
                                    <EditIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AgentsView;
