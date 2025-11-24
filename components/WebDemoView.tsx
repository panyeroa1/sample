
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Template, Agent, LiveTranscript, CrmBooking, ToolCallData } from '../types';
import { useGeminiLiveAgent } from '../hooks/useGeminiLive';
import * as dataService from '../services/dataService';
import { saveAgentMemoryToSupabase, getAgentMemoryFromSupabase, AgentMemory } from '../services/supabaseService';
import { generateCallSummaryNote } from '../services/geminiService';
import { IphoneSimulator } from './IphoneSimulator';
import { LoadingIndicator } from './LoadingIndicator';
import { AgentIcon, UserIcon, GlobeIcon, MicIcon, PhoneIcon, ClipboardEditIcon, SaveIcon, CheckCircleIcon, DatabaseIcon, CpuIcon, MailIcon, CalendarIcon, ChevronLeftIcon, BookIcon } from './icons';
import { AUDIO_ASSETS, CRM_TOOLS, AYLA_PROMPT } from '../constants';
import { crmService } from '../services/crmService';

const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

interface WebDemoViewProps {
    template: Template;
    onEndDemo: () => void;
}

type CallState = 'idle' | 'dialing' | 'ringing' | 'playingIntro' | 'awaitingInput' | 'connectingAgent' | 'agentActive' | 'onHold' | 'connectingHuman' | 'error';
type FeedbackStatus = 'idle' | 'saving' | 'saved' | 'error';
type ActiveMainTab = 'transcription' | 'crm' | 'tools' | 'memory';

const IVR_DIALPAD_KEYS = [
    { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' },
];

const Dialpad: React.FC<{ onKeyPress: (key: string) => void, keys: { key: string, sub: string }[] }> = ({ onKeyPress, keys }) => {
    return (
        <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
            {keys.map(({ key, sub }) => (
                <button
                    key={key}
                    onClick={() => onKeyPress(key)}
                    className="bg-white/20 hover:bg-white/30 text-white rounded-full aspect-square text-3xl font-light flex flex-col items-center justify-center transition-colors active:bg-white/40"
                >
                    {key}
                    {sub && <span className="text-xs font-semibold tracking-widest">{sub}</span>}
                </button>
            ))}
        </div>
    );
};

const TabButton: React.FC<{
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    isActive: boolean;
    onClick: () => void;
    count?: number;
}> = ({ label, icon: Icon, isActive, onClick, count }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 py-3 px-5 font-semibold transition-colors border-b-2 relative ${
            isActive
                ? 'text-eburon-accent border-eburon-accent'
                : 'text-eburon-fg/70 hover:text-eburon-fg border-transparent hover:border-eburon-border'
        }`}
    >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
        {count !== undefined && count > 0 && (
            <span className="ml-1 bg-eburon-accent text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{count}</span>
        )}
    </button>
);


const WebDemoView: React.FC<WebDemoViewProps> = ({ template, onEndDemo }) => {
    const [agent, setAgent] = useState<Agent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [callState, setCallState] = useState<CallState>('idle');
    const [duration, setDuration] = useState(0);
    const [isAwaitingHoldConfirmation, setIsAwaitingHoldConfirmation] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('+1 (555) 123-4567'); // Mock Customer Phone
    
    // Feedback State
    const [isFeedbackMode, setIsFeedbackMode] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>('idle');
    const [sessionId] = useState(() => `session-${Date.now()}`);
    const [activeMainTab, setActiveMainTab] = useState<ActiveMainTab>('transcription');
    const [selectedBooking, setSelectedBooking] = useState<CrmBooking | null>(null);
    const [crmBookings, setCrmBookings] = useState<CrmBooking[]>([]);
    
    // Memory State
    const [pastMemories, setPastMemories] = useState<AgentMemory[]>([]);
    const [isSavingMemory, setIsSavingMemory] = useState(false);

    const { transcripts, toolCalls, startSession, endSession, isSessionActive, pauseMicrophoneStream, resumeMicrophoneStream } = useGeminiLiveAgent();
    const [localTranscripts, setLocalTranscripts] = useState<LiveTranscript[]>([]);
    
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    const bgNoiseAudioRef = useRef<HTMLAudioElement | null>(null);
    const holdAudioRef = useRef<HTMLAudioElement | null>(null);

    const durationIntervalRef = useRef<number | null>(null);
    const callTimersRef = useRef<number[]>([]);


    useEffect(() => {
        // Initialize Background Audio
        bgNoiseAudioRef.current = new Audio(AUDIO_ASSETS.officeBg);
        bgNoiseAudioRef.current.loop = true;
        bgNoiseAudioRef.current.volume = 0.15; 

        // Initialize Hold Music
        holdAudioRef.current = new Audio(AUDIO_ASSETS.hold);
        holdAudioRef.current.loop = true;
        holdAudioRef.current.volume = 0.3;

        const loadDependencies = async () => {
            setIsLoading(true);
            try {
                const fetchedVoices = await dataService.getVoices();
                // Default to 'Ayla' or 'Aoede' voice if available, otherwise first voice
                const recommendedVoice = fetchedVoices.find(v => v.name === template.recommendedVoice) || fetchedVoices.find(v => v.name.includes("Ayla"));
                const voiceId = recommendedVoice ? recommendedVoice.id : (fetchedVoices.length > 0 ? fetchedVoices[0].id : '');
                
                if (voiceId) {
                    const agentForSession: Agent = {
                        id: template.id, name: template.name, description: template.description,
                        systemPrompt: template.systemPrompt, firstSentence: template.firstSentence,
                        voice: voiceId, thinkingMode: false, avatarUrl: null, tools: [],
                    };
                    setAgent(agentForSession);
                } else {
                    // Fallback if voices failed
                    const agentForSession: Agent = {
                        id: template.id, name: template.name, description: template.description,
                        systemPrompt: template.systemPrompt, firstSentence: template.firstSentence,
                        voice: 'Aoede', thinkingMode: false, avatarUrl: null, tools: [],
                    };
                    setAgent(agentForSession);
                }

                // Load Memory
                const memories = await getAgentMemoryFromSupabase(phoneNumber);
                setPastMemories(memories);

            } catch (err) {
                console.error("Failed to load demo dependencies:", err);
                setCallState('error');
            } finally {
                setIsLoading(false);
            }
        };
        loadDependencies();

        const initialBookings = crmService.getBookings();
        setCrmBookings(initialBookings);
        const unsubscribe = crmService.subscribe(updatedBookings => {
            setCrmBookings(updatedBookings);
        });


        return () => {
            if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
            callTimersRef.current.forEach(window.clearTimeout);
            endSession();
            bgNoiseAudioRef.current?.pause();
            holdAudioRef.current?.pause();
            audioRef.current.pause();
            unsubscribe();
        };
    }, [template, endSession, phoneNumber]);

    useEffect(() => {
        // Reset detail view when tab changes
        setSelectedBooking(null);
    }, [activeMainTab]);

    const startTimer = useCallback(() => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        setDuration(0);
        durationIntervalRef.current = window.setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    }, []);

    const startAylaSequence = useCallback(async () => {
        if (!agent) return;
        setCallState('connectingAgent');

        try {
            // Use 'Aoede' for consistent Ayla voice in TTS for Gemini
            const audioBlob = await dataService.generateTtsWithGemini(agent.firstSentence, 'Aoede');
            const url = URL.createObjectURL(audioBlob);
            
            audioRef.current.src = url;
            audioRef.current.play();

            audioRef.current.onplay = () => {
                setCallState('agentActive');
                // Start background noise when agent connects
                bgNoiseAudioRef.current?.play().catch(e => console.warn("Background audio play failed:", e));
                startTimer();
                setLocalTranscripts(prev => [...prev, {id: Date.now(), role: 'model', text: agent.firstSentence.replace(/<[^>]+>/g, ''), isFinal: true}]);
            };
            
            audioRef.current.onended = async () => {
                try {
                    // Inject memory into prompt
                    let effectivePrompt = agent.systemPrompt;
                    // Ensure we are using the updated Ayla prompt if it's the default agent template
                    if (agent.id === 'template-ayla-csr') {
                        effectivePrompt = AYLA_PROMPT;
                    }

                    if (pastMemories.length > 0) {
                        const memoryText = pastMemories.map(m => `[Date: ${new Date(m.created_at).toLocaleDateString()}] Note: ${m.note}`).join('\n');
                        effectivePrompt += `\n\nPART 12: CUSTOMER HISTORY MEMORY\nThe following are notes from previous interactions with this customer (${phoneNumber}). Use this to provide personalized service, but verify details if they seem outdated.\n${memoryText}`;
                    }

                    // Start Gemini Live session with 'Aoede' voice for Ayla
                    await startSession(effectivePrompt, CRM_TOOLS, 'Aoede');
                } catch (error) {
                    console.error("Failed to start live agent session:", error);
                    setCallState('error');
                    bgNoiseAudioRef.current?.pause(); // Stop noise on error
                }
            };

        } catch (error) {
            console.error("Failed to start Ayla sequence:", error);
            setCallState('error');
        }
    }, [agent, startSession, startTimer, pastMemories, phoneNumber]);
    
    const combinedTranscripts = useMemo(() => {
        return [...localTranscripts, ...transcripts];
    }, [localTranscripts, transcripts]);

    const handleHold = useCallback(() => {
        pauseMicrophoneStream();
        const originalCallState = callState;
        setCallState('onHold');
        
        // Pause office noise on hold, play hold music
        bgNoiseAudioRef.current?.pause();
        holdAudioRef.current?.play();
        
        const holdDuration = Math.random() * (15000 - 8000) + 8000; // Random between 8 and 15 seconds

        const holdTimer = window.setTimeout(() => {
            holdAudioRef.current?.pause();
            if (holdAudioRef.current) holdAudioRef.current.currentTime = 0;
            
            // Resume office noise when off hold
            bgNoiseAudioRef.current?.play().catch(e => console.warn("Background audio resume failed", e));
            
            setCallState(originalCallState);
            resumeMicrophoneStream();
        }, holdDuration);
        callTimersRef.current.push(holdTimer);
    }, [pauseMicrophoneStream, resumeMicrophoneStream, callState]);

    useEffect(() => {
        const lastTranscript = combinedTranscripts[combinedTranscripts.length - 1];
        if (!lastTranscript || !lastTranscript.isFinal) return;

        if (lastTranscript.role === 'model') {
            const text = lastTranscript.text.toLowerCase();
            if (text.includes("hold on") || text.includes("one moment") || text.includes("on hold")) {
                setIsAwaitingHoldConfirmation(true);
            }
        } else if (isAwaitingHoldConfirmation && lastTranscript.role === 'user') {
            const text = lastTranscript.text.toLowerCase();
            const affirmativeResponses = ["ok", "okay", "yes", "sure", "alright", "fine", "go ahead"];
            if (affirmativeResponses.some(w => text.includes(w))) {
                handleHold();
            }
            setIsAwaitingHoldConfirmation(false);
        }
    }, [combinedTranscripts, isAwaitingHoldConfirmation, handleHold]);

    const handleConnectHuman = useCallback(() => {
        setCallState('connectingHuman');
        bgNoiseAudioRef.current?.pause(); // Stop noise when transferring
        const connectTimer = window.setTimeout(() => {
            audioRef.current.src = AUDIO_ASSETS.busy;
            audioRef.current.play();
            const busyTimer = window.setTimeout(onEndDemo, 2000); // End demo after busy tone
            callTimersRef.current.push(busyTimer);
        }, 2000);
        callTimersRef.current.push(connectTimer);
    }, [onEndDemo]);


    const handleDialpadPress = useCallback((key: string) => {
        if (callState === 'awaitingInput') {
           switch(key) {
               case '0': // Representative
               case '1': // English
               case '2': // Other
                   startAylaSequence();
                   break;
               default: break; // Invalid option
           }
        }
    }, [callState, startAylaSequence]);

    const handleStartCall = () => {
        if (callState !== 'idle' || !agent || !phoneNumber) return;
        
        const ivrPrompt = `<speak>
            <p>Thank you for calling Deontic AI. Your call is important to us. Please note that this call may be recorded for quality assurance and training purposes.</p>
            <break time="1000ms"/>
            <p>To speak to one of our agents, please press 0.</p>
        </speak>`;
        // Use Aoede for IVR voice as well for consistency with Ayla
        const ivrAudioPromise = dataService.generateTtsWithGemini(ivrPrompt, 'Aoede');

        setCallState('dialing');
        
        const dialingTimer = window.setTimeout(() => {
            setCallState('ringing');
            audioRef.current.src = AUDIO_ASSETS.ring;
            audioRef.current.loop = true;
            audioRef.current.play();

            const ringTimer = window.setTimeout(async () => {
                audioRef.current.loop = false;
                audioRef.current.pause();
                
                setCallState('playingIntro');
                try {
                    const audioBlob = await ivrAudioPromise;
                    const url = URL.createObjectURL(audioBlob);
                    audioRef.current.src = url;
                    audioRef.current.play();
                    audioRef.current.onended = () => setCallState('awaitingInput');
                } catch (e) {
                    console.error("Failed to generate/play IVR audio", e);
                    setCallState('error');
                }
            }, 8000); 
            callTimersRef.current.push(ringTimer);
        }, 1500);
        callTimersRef.current.push(dialingTimer);
    };

    const handleEndCall = async () => {
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        callTimersRef.current.forEach(window.clearTimeout);
        audioRef.current.pause();
        audioRef.current.src = '';
        bgNoiseAudioRef.current?.pause();
        holdAudioRef.current?.pause();
        endSession();

        // Generate and Save Summary Note
        if (combinedTranscripts.length > 0) {
            setIsSavingMemory(true);
            try {
                const fullText = combinedTranscripts.map(t => `${t.role}: ${t.text}`).join('\n');
                const note = await generateCallSummaryNote(fullText);
                await saveAgentMemoryToSupabase(phoneNumber, note, sessionId);
                // Optimistically update UI
                setPastMemories(prev => [...prev, {
                    id: `new-${Date.now()}`,
                    phone_number: phoneNumber,
                    note: note,
                    created_at: new Date().toISOString(),
                    session_id: sessionId
                }]);
            } catch (e) {
                console.error("Failed to save call memory:", e);
            } finally {
                setIsSavingMemory(false);
            }
        }
        
        onEndDemo();
    };
    
    const handleDialerInput = (key: string) => {
        if (key === 'backspace') {
            setPhoneNumber(p => p.slice(0, -1));
        } else if (phoneNumber.length < 20) {
            setPhoneNumber(p => p + key);
        }
    };
    
    const handleSaveFeedback = async () => {
        if (!agent || !feedbackText.trim()) return;
        setFeedbackStatus('saving');
        try {
            await dataService.submitAgentFeedback(agent.id, sessionId, combinedTranscripts, feedbackText);
            setFeedbackStatus('saved');
            setTimeout(() => {
                setIsFeedbackMode(false);
                setFeedbackText('');
                setFeedbackStatus('idle');
            }, 2000);
        } catch (err) {
            console.error("Failed to save feedback", err);
            setFeedbackStatus('error');
        }
    };


    if (isLoading) {
        return <LoadingIndicator text="Preparing Demo Environment..." size="large" />;
    }

    const renderCallStatusText = () => {
        switch (callState) {
            case 'idle': return 'Ready to Call';
            case 'dialing': return 'Dialing...';
            case 'ringing': return 'Ringing...';
            case 'playingIntro': return 'Connecting...';
            case 'awaitingInput': return 'Select an option';
            case 'connectingAgent': return 'Connecting AI Agent...';
            case 'connectingHuman': return 'Transferring...';
            case 'onHold': return 'On Hold';
            case 'agentActive': return formatDuration(duration);
            case 'error': return 'Connection Failed';
        }
    };

     const renderPhoneScreen = () => {
        return (
             <div className="w-full h-full flex flex-col bg-gray-900 text-white p-4">
                {callState !== 'idle' && (
                    <div className="text-center pt-12">
                        <h2 className="text-3xl font-bold">{agent?.name}</h2>
                        <p className={`mt-1 font-mono text-lg ${callState === 'agentActive' ? 'text-eburon-ok' : callState === 'onHold' ? 'text-eburon-warn' : 'text-eburon-fg/80'}`}>
                            {renderCallStatusText()}
                        </p>
                    </div>
                )}

                <div className="flex-grow flex flex-col items-center justify-center gap-8">
                    {callState === 'idle' && (
                        <>
                            <div className="text-center text-4xl font-light h-12 w-full truncate px-4">{phoneNumber}</div>
                            <Dialpad onKeyPress={handleDialerInput} keys={IVR_DIALPAD_KEYS} />
                             <button 
                                onClick={() => handleDialerInput('backspace')} 
                                className="text-lg font-semibold"
                                data-tooltip="Delete Last Digit"
                             >
                                Delete
                            </button>
                        </>
                    )}
                    {(callState === 'dialing' || callState === 'ringing' || callState === 'playingIntro' || callState === 'connectingAgent' || callState === 'connectingHuman') && (
                         <div className="w-24 h-24 rounded-full bg-eburon-bg border border-eburon-border flex items-center justify-center">
                            <AgentIcon className="w-12 h-12 text-eburon-accent animate-pulse" />
                        </div>
                    )}
                    {callState === 'awaitingInput' && (
                         <Dialpad onKeyPress={handleDialpadPress} keys={IVR_DIALPAD_KEYS} />
                    )}
                    {callState === 'agentActive' && (
                        <GlobeIcon className={`w-48 h-48 text-white/50 z-10 transition-transform duration-500 ${isSessionActive ? 'animate-pulse' : ''}`} />
                    )}
                </div>

                <div className="mt-auto flex items-center justify-center">
                     {callState === 'idle' ? (
                        <button 
                            onClick={handleStartCall} 
                            className="w-20 h-20 rounded-full bg-eburon-ok flex items-center justify-center group transition-transform hover:scale-105"
                            data-tooltip="Start Call"
                        >
                            <PhoneIcon className="w-10 h-10 text-white" />
                        </button>
                     ) : (
                         <button 
                            onClick={handleEndCall} 
                            className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center group transition-transform hover:scale-105"
                            data-tooltip="End Call"
                        >
                            <PhoneIcon className="w-10 h-10 text-white transform rotate-[135deg]" />
                        </button>
                     )}
                </div>
            </div>
        );
    };

    const renderMainPanelContent = () => {
        switch(activeMainTab) {
            case 'crm':
                return selectedBooking ? (
                    <CrmDetailView booking={selectedBooking} onBack={() => setSelectedBooking(null)} />
                ) : (
                    <div className="p-4">
                        <CrmDataView data={crmBookings} onSelectBooking={setSelectedBooking} />
                    </div>
                );
            case 'tools':
                return <div className="p-4"><ToolActivityView toolCalls={toolCalls} /></div>;
            case 'memory':
                return (
                    <div className="p-6 space-y-4">
                        <h3 className="text-lg font-bold text-eburon-fg mb-4">Customer History (Memory)</h3>
                        {isSavingMemory && <div className="text-sm text-eburon-accent animate-pulse">Saving summary from latest call...</div>}
                        {pastMemories.length === 0 ? (
                            <p className="text-eburon-fg/60 italic">No previous history for this number.</p>
                        ) : (
                            pastMemories.map((mem, idx) => (
                                <div key={mem.id || idx} className="bg-eburon-bg border border-eburon-border rounded-xl p-4 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs text-eburon-fg/50 font-mono">{new Date(mem.created_at).toLocaleString()}</span>
                                        <span className="bg-eburon-panel text-[10px] px-2 py-1 rounded border border-eburon-border">{mem.session_id || 'Unknown Session'}</span>
                                    </div>
                                    <p className="text-sm text-eburon-fg/90 leading-relaxed">{mem.note}</p>
                                </div>
                            ))
                        )}
                    </div>
                );
            case 'transcription':
            default:
                return (
                    <div className="flex-grow p-6 space-y-4 overflow-y-auto">
                        {combinedTranscripts.map((t) => (
                            <div key={t.id} className={`flex gap-3 items-start ${t.role === 'user' ? 'justify-end' : ''}`}>
                                {t.role === 'model' && (
                                    <div className="w-8 h-8 rounded-full flex-shrink-0 grid place-items-center bg-eburon-accent">
                                        <AgentIcon className="w-5 h-5 text-white" />
                                    </div>
                                )}
                                <div className={`max-w-xl p-3 rounded-xl transition-opacity ${t.isFinal ? 'opacity-100' : 'opacity-70'} ${t.role === 'model' ? 'bg-eburon-bg rounded-bl-none' : 'bg-eburon-accent text-white rounded-br-none'}`}>
                                    <p className="text-sm">{t.text}</p>
                                </div>
                                {t.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full flex-shrink-0 grid place-items-center bg-gray-500">
                                        <UserIcon className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {isSessionActive && callState !== 'onHold' && (
                            <div className="flex justify-center items-center gap-2 pt-4 text-eburon-accent">
                                <MicIcon className="w-5 h-5 animate-pulse" />
                                <span className="text-sm font-semibold">Listening...</span>
                            </div>
                        )}
                    </div>
                );
        }
    }


    return (
        <div className="h-screen w-screen flex flex-col lg:flex-row bg-eburon-bg text-eburon-fg p-4 lg:p-8 gap-8 overflow-y-auto lg:overflow-hidden">
            <aside className="w-full lg:w-[390px] flex-shrink-0 flex items-center justify-center">
                <IphoneSimulator>
                    {renderPhoneScreen()}
                </IphoneSimulator>
            </aside>
            <main className="flex-1 bg-eburon-panel border border-eburon-border rounded-xl flex flex-col overflow-hidden">
                <header className="p-4 border-b border-eburon-border flex justify-between items-center flex-shrink-0">
                     <div className="flex">
                        <TabButton label="Live Transcription" icon={MicIcon} isActive={activeMainTab === 'transcription'} onClick={() => setActiveMainTab('transcription')} />
                        <TabButton label="CRM Data" icon={DatabaseIcon} isActive={activeMainTab === 'crm'} onClick={() => setActiveMainTab('crm')} />
                        <TabButton label="Tool Activity" icon={CpuIcon} isActive={activeMainTab === 'tools'} onClick={() => setActiveMainTab('tools')} count={toolCalls.length} />
                        <TabButton label="Memory" icon={BookIcon} isActive={activeMainTab === 'memory'} onClick={() => setActiveMainTab('memory')} count={pastMemories.length} />
                    </div>
                    <label 
                        htmlFor="feedback-mode-toggle" 
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${isFeedbackMode ? 'bg-eburon-accent text-white' : 'bg-eburon-bg hover:bg-white/10'}`} 
                        data-tooltip="Toggle Feedback Mode"
                    >
                        <ClipboardEditIcon className="w-5 h-5"/>
                        <span>Record Feedback</span>
                        <div className="relative">
                            <input type="checkbox" id="feedback-mode-toggle" className="sr-only" checked={isFeedbackMode} onChange={() => setIsFeedbackMode(!isFeedbackMode)} />
                            <div className={`w-9 h-5 rounded-full transition-colors ${isFeedbackMode ? 'bg-white/30' : 'bg-gray-500'}`}></div>
                            <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${isFeedbackMode ? 'translate-x-4' : ''}`}></div>
                        </div>
                    </label>
                </header>
                
                {renderMainPanelContent()}
                
                 {isFeedbackMode && (
                    <div className="p-4 border-t border-eburon-border bg-eburon-bg/30 flex-shrink-0">
                        <h3 className="text-lg font-semibold mb-2">Improvements & Comments</h3>
                        <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Add notes here on what the agent should improve, do, or not do..."
                            className="w-full h-24 bg-eburon-bg border border-eburon-border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-eburon-accent"
                            disabled={feedbackStatus === 'saving'}
                        />
                        <div className="flex justify-end items-center mt-2">
                             {feedbackStatus === 'error' && <p className="text-red-400 text-sm mr-4">Failed to save.</p>}
                             <button
                                onClick={handleSaveFeedback}
                                disabled={!feedbackText.trim() || feedbackStatus === 'saving' || feedbackStatus === 'saved'}
                                className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors duration-200 bg-eburon-accent hover:bg-eburon-accent-dark text-white disabled:bg-gray-500"
                                data-tooltip="Save Feedback"
                            >
                                {feedbackStatus === 'saving' && <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>}
                                {feedbackStatus === 'saved' ? <CheckCircleIcon className="w-5 h-5" /> : <SaveIcon className="w-5 h-5" />}
                                <span>{feedbackStatus === 'saving' ? 'Saving...' : feedbackStatus === 'saved' ? 'Saved!' : 'Save Feedback'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const CrmDataView: React.FC<{data: CrmBooking[], onSelectBooking: (booking: CrmBooking) => void}> = ({ data, onSelectBooking }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-eburon-fg/80">
            <thead className="text-xs text-eburon-fg/60 uppercase bg-eburon-bg">
                <tr>
                    <th scope="col" className="px-4 py-3">PNR</th>
                    <th scope="col" className="px-4 py-3">Passenger</th>
                    <th scope="col" className="px-4 py-3">Flight</th>
                    <th scope="col" className="px-4 py-3">Route</th>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                </tr>
            </thead>
            <tbody>
                {data.map(booking => (
                    <tr key={booking.pnr} onClick={() => onSelectBooking(booking)} className="border-b border-eburon-border hover:bg-eburon-bg cursor-pointer">
                        <td className="px-4 py-3 font-mono text-eburon-accent">{booking.pnr}</td>
                        <td className="px-4 py-3">{booking.passenger_name}</td>
                        <td className="px-4 py-3">{booking.flight_number}</td>
                        <td className="px-4 py-3">{booking.origin} &rarr; {booking.destination}</td>
                        <td className="px-4 py-3">{new Date(booking.flight_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                             <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                                booking.status === 'confirmed' ? 'bg-blue-600 text-blue-100' :
                                booking.status === 'checked_in' ? 'bg-green-600 text-green-100' :
                                booking.status === 'canceled' ? 'bg-red-600 text-red-100' :
                                'bg-gray-600 text-gray-100'
                             }`}>{booking.status}</span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CrmDetailView: React.FC<{booking: CrmBooking, onBack: () => void}> = ({ booking, onBack }) => {
    const InfoField: React.FC<{icon: React.FC<any>, label: string, value: string}> = ({ icon: Icon, label, value }) => (
        <div className="flex items-start gap-3">
            <Icon className="w-5 h-5 text-eburon-accent mt-1 flex-shrink-0" />
            <div>
                <p className="text-sm text-eburon-fg/60">{label}</p>
                <p className="font-semibold text-eburon-fg">{value}</p>
            </div>
        </div>
    );
    
    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-eburon-bg transition-colors -ml-3">
                    <ChevronLeftIcon className="w-5 h-5" />
                    <span className="font-semibold">Back to List</span>
                </button>
            </div>
            <div className="space-y-6">
                <div className="bg-eburon-bg p-6 rounded-xl border border-eburon-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-bold">{booking.passenger_name}</h3>
                            <p className="font-mono text-eburon-accent">{booking.pnr}</p>
                        </div>
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full capitalize ${
                            booking.status === 'confirmed' ? 'bg-blue-600 text-blue-100' :
                            booking.status === 'checked_in' ? 'bg-green-600 text-green-100' :
                            booking.status === 'canceled' ? 'bg-red-600 text-red-100' :
                            'bg-gray-600 text-gray-100'
                         }`}>{booking.status}</span>
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="bg-eburon-bg p-4 rounded-xl border border-eburon-border space-y-4">
                        <h4 className="font-semibold text-lg border-b border-eburon-border pb-2">Passenger Details</h4>
                        <InfoField icon={UserIcon} label="Name" value={booking.passenger_name} />
                        <InfoField icon={MailIcon} label="Email" value={booking.email} />
                        <InfoField icon={PhoneIcon} label="Phone" value={booking.phone_number} />
                    </div>
                     <div className="bg-eburon-bg p-4 rounded-xl border border-eburon-border space-y-4">
                        <h4 className="font-semibold text-lg border-b border-eburon-border pb-2">Flight Details</h4>
                        <InfoField icon={PhoneIcon} label="Flight Number" value={booking.flight_number} />
                        <InfoField icon={GlobeIcon} label="Route" value={`${booking.origin} to ${booking.destination}`} />
                        <InfoField icon={CalendarIcon} label="Date" value={new Date(booking.flight_date).toLocaleString()} />
                    </div>
                </div>

                <div className="bg-eburon-bg p-4 rounded-xl border border-eburon-border">
                     <h4 className="font-semibold text-lg mb-3">Notes</h4>
                     <div className="space-y-3">
                        {booking.notes && booking.notes.length > 0 ? (
                            booking.notes.map((note, index) => (
                                <div key={index} className="bg-eburon-panel p-3 rounded-lg border border-eburon-border/50">
                                    <p className="text-sm text-eburon-fg/90">{note.text}</p>
                                    <p className="text-xs text-eburon-fg/60 mt-2 text-right">
                                        &mdash; {note.by} on {new Date(note.date).toLocaleDateString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-eburon-fg/60 text-center py-4">No notes for this booking.</p>
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};


const ToolActivityView: React.FC<{toolCalls: ToolCallData[]}> = ({ toolCalls }) => (
    <div className="space-y-3">
        {toolCalls.length === 0 ? (
            <p className="text-center text-eburon-fg/60 p-4">No tool activity yet. Try asking the agent to look up a booking by PNR (e.g., "Can you check my booking TK100001?").</p>
        ) : (
            [...toolCalls].reverse().map(call => (
                <div key={call.id} className="bg-eburon-bg border border-eburon-border rounded-lg p-4 font-mono text-sm">
                    <div className="flex justify-between items-center mb-2">
                        <p className="font-bold text-eburon-accent">{call.name}</p>
                        <p className="text-xs text-eburon-fg/50">{new Date(call.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <pre className="bg-eburon-panel p-3 rounded text-xs text-eburon-fg/80 whitespace-pre-wrap">
                        {JSON.stringify(call.args, null, 2)}
                    </pre>
                </div>
            ))
        )}
    </div>
);


export default WebDemoView;
