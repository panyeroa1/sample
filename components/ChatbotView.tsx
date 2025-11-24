
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage, GroundingChunk, TelemetryData, AiProvider, OllamaSettings, OllamaModel } from '../types';
import { sendMessageStreamToGemini } from '../services/geminiService';
import { sendMessageStreamToOllama, checkOllamaConnection, fetchOllamaModels } from '../services/ollamaService';
import * as dataService from '../services/dataService';
import { uploadChatImage } from '../services/supabaseService';
import { SendIcon, PaperclipIcon, SearchIcon, CodeIcon, Trash2Icon, MicIcon, BrainCircuitIcon, GlobeIcon, StopIcon, CpuIcon, ServerIcon, XIcon, CheckCircleIcon, RefreshIcon, GoogleIcon } from './icons';
import { EBURON_SYSTEM_PROMPT, DEFAULT_OLLAMA_SETTINGS } from '../constants';
import { LoadingIndicator } from './LoadingIndicator';
import { useConfig } from '../contexts/ConfigContext';

type ModelMode = 'normal' | 'thinking' | 'fast';

interface ChatbotViewProps {
    setGeneratedAppHtml: (html: string | null) => void;
}

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ChatbotView: React.FC<ChatbotViewProps> = ({ setGeneratedAppHtml }) => {
    const { config } = useConfig();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // Provider State
    const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
    const [isOllamaAvailable, setIsOllamaAvailable] = useState(false);
    
    // Ollama State
    const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
    const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>(config.services.ollamaModel || 'gemma');
    const [customModelName, setCustomModelName] = useState('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Feature Toggles
    const [useSearchGrounding, setUseSearchGrounding] = useState(false);
    const [useMapsGrounding, setUseMapsGrounding] = useState(false);
    const [modelMode, setModelMode] = useState<ModelMode>('normal');
    const [isDeveloperMode, setIsDeveloperMode] = useState(false);
    
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number} | null>(null);
    const [locationError, setLocationError] = useState<string|null>(null);

    // Audio State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        const loadHistory = async () => {
            setIsHistoryLoading(true);
            const history = await dataService.getChatbotMessages();
            setMessages(history);
            setIsHistoryLoading(false);
        };
        loadHistory();
    }, []);

    useEffect(() => {
        if (config.services.ollamaModel) {
            setSelectedOllamaModel(config.services.ollamaModel);
        }
    }, [config.services.ollamaModel]);


    const refreshOllama = useCallback(async () => {
        const settings: OllamaSettings = {
            type: config.services.ollamaType || 'local',
            baseUrl: config.services.ollamaBaseUrl,
            apiKey: config.services.ollamaApiKey,
            model: config.services.ollamaModel
        };

        setIsLoadingModels(true);
        try {
            const available = await checkOllamaConnection(settings);
            setIsOllamaAvailable(available);
            if (available) {
                const models = await fetchOllamaModels(settings);
                setAvailableModels(models);
                
                const currentModelStillExists = models.some(m => m.name === selectedOllamaModel);
                if (!currentModelStillExists && selectedOllamaModel !== 'custom') {
                    if (config.services.ollamaModel && models.some(m => m.name === config.services.ollamaModel)) {
                        setSelectedOllamaModel(config.services.ollamaModel);
                    } else {
                        setSelectedOllamaModel(models[0]?.name || 'gemma');
                    }
                }
            } else {
                setAvailableModels([]);
            }
        } catch (error) {
            console.warn("Failed to connect to Ollama", error);
            setIsOllamaAvailable(false);
            setAvailableModels([]);
        } finally {
            setIsLoadingModels(false);
        }
    }, [config.services, selectedOllamaModel]);

    useEffect(() => {
        refreshOllama();
    }, [refreshOllama]);

    useEffect(() => {
        if (useMapsGrounding && !userLocation) {
            setLocationError(null);
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setUserLocation({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        });
                    },
                    (error) => {
                        console.error("Geolocation error:", error);
                        setLocationError("Could not get location. Maps grounding may not work as expected.");
                        setUseMapsGrounding(false);
                    }
                );
            }
        }
    }, [useMapsGrounding, userLocation]);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleClearChat = async () => {
        if (window.confirm('Are you sure you want to delete the entire chat history? This cannot be undone.')) {
            try {
                await dataService.clearChatbotMessages();
                setMessages([]);
            } catch (error) {
                console.error("Failed to clear chat history:", error);
                alert("Could not clear chat history. Please try again.");
            }
        }
    };

    const handleSend = useCallback(async (overrideText?: string) => {
        const textToSend = overrideText || input;
        
        if (!textToSend.trim() && !imageFile) return;
        
        setIsLoading(true);
        const startTime = performance.now();
        let uploadedImageUrl: string | undefined = undefined;
        
        if (imageFile) {
            try {
                uploadedImageUrl = await uploadChatImage(imageFile);
            } catch (error) {
                console.error("Image upload failed:", error);
            }
        }
        
        const userMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            text: textToSend,
            image: imagePreview || undefined,
            imageUrl: uploadedImageUrl,
        };
        
        setMessages(prev => [...prev, userMessage]);
        await dataService.saveChatMessage(userMessage);

        const currentInput = textToSend;
        const currentImageFile = imageFile;
        const history = [...messages, userMessage];
        
        setInput('');
        setImageFile(null);
        setImagePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
        
        const modelMessagePlaceholder: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'model',
            text: '',
        };
        setMessages(prev => [...prev, modelMessagePlaceholder]);

        const systemPrompt = isDeveloperMode
            ? `You are an expert web developer. The user will ask you to build a web application. Your response MUST be a single block of HTML code. Do not include any explanation or markdown formatting. The HTML should be self-contained with TailwindCSS via CDN and any necessary Javascript in a script tag.`
            : EBURON_SYSTEM_PROMPT;

        try {
            let fullText = '';
            let groundingChunks: GroundingChunk[] | undefined;
            
            if (aiProvider === 'gemini') {
                const stream = await sendMessageStreamToGemini(
                    history, 
                    currentInput, 
                    currentImageFile, 
                    { 
                        useSearchGrounding, 
                        useMapsGrounding, 
                        useThinkingMode: modelMode === 'thinking',
                        useLowLatency: modelMode === 'fast',
                        userLocation 
                    }, 
                    systemPrompt
                );
                
                for await (const chunk of stream) {
                    if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                        groundingChunks = chunk.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[];
                    }
                    const chunkText = chunk.text;
                    fullText += chunkText;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'model') {
                            lastMessage.text = fullText;
                            if (groundingChunks) lastMessage.groundingChunks = groundingChunks;
                        }
                        return newMessages;
                    });
                }
            } else if (aiProvider === 'ollama') {
                 const modelName = selectedOllamaModel === 'custom' ? customModelName : selectedOllamaModel;
                 const settings: OllamaSettings = {
                    type: config.services.ollamaType || 'local',
                    baseUrl: config.services.ollamaBaseUrl,
                    apiKey: config.services.ollamaApiKey,
                    model: modelName
                 };

                 const stream = sendMessageStreamToOllama(history, systemPrompt, modelName, settings);
                 for await (const chunkText of stream) {
                     fullText += chunkText;
                     setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'model') {
                            lastMessage.text = fullText;
                        }
                        return newMessages;
                    });
                 }
            }
            
            if (isDeveloperMode) {
                setGeneratedAppHtml(fullText);
            }

            const endTime = performance.now();
            const durationSeconds = (endTime - startTime) / 1000;
            const words = fullText.trim().split(/\s+/).filter(Boolean).length;
            const wps = durationSeconds > 0 ? Math.round(words / durationSeconds) : 0;
            const energy = ((fullText.length / 1000) * 0.005).toFixed(4);
            const tokensUsed = Math.round(fullText.length / 3.8);

            const finalModelMessage: ChatMessage = {
                ...modelMessagePlaceholder,
                text: fullText,
                groundingChunks,
                telemetry: {
                    tokensUsed,
                    energy: `${energy} kWh`,
                    wps,
                    model: aiProvider === 'ollama' ? selectedOllamaModel : modelMode
                }
            };
            
            setMessages(prev => prev.map(msg => msg.id === modelMessagePlaceholder.id ? finalModelMessage : msg));
            await dataService.saveChatMessage(finalModelMessage);

        } catch (error: any) {
            console.error("Eburon Assistant Error:", error);
            let errorMessage = error.message || "Sorry, I encountered an error. Please try again.";
            if (aiProvider === 'ollama' && (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError'))) {
                 errorMessage = `Could not connect to service at ${config.services.ollamaBaseUrl}. Please ensure the service is reachable.`;
            }

            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage && lastMessage.role === 'model') {
                    lastMessage.text = errorMessage;
                }
                return newMessages;
            });
            const errorModelMessage: ChatMessage = { ...modelMessagePlaceholder, text: errorMessage };
            await dataService.saveChatMessage(errorModelMessage);
        } finally {
            setIsLoading(false);
        }
    }, [input, imageFile, imagePreview, messages, useSearchGrounding, useMapsGrounding, modelMode, userLocation, isDeveloperMode, setGeneratedAppHtml, aiProvider, config.services, selectedOllamaModel, customModelName]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        setIsRecording(false);
    }, []);

    const startDeepgramSession = async () => {
         const apiKey = config.apiKeys.deepgramApiKey;
         if (!apiKey) {
             alert('Deepgram API Key is missing. Please add it in Admin Settings.');
             return;
         }

         try {
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
             mediaRecorderRef.current = mediaRecorder;
             
             // Nova-2 model with smart formatting and VAD endpointing (500ms silence)
             const socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&endpointing=500', ['token', apiKey]);
             socketRef.current = socket;
             
             let currentTranscript = "";

             socket.onopen = () => {
                 setIsRecording(true);
                 mediaRecorder.start(250); // Send chunks every 250ms
             };

             socket.onmessage = (message) => {
                 const received = JSON.parse(message.data);
                 const transcript = received.channel?.alternatives[0]?.transcript;
                 
                 if (transcript && received.is_final) {
                     currentTranscript += (currentTranscript ? " " : "") + transcript;
                     setInput(currentTranscript);
                 } else if (transcript) {
                     // Interim results - purely visual, don't append permanently to currentTranscript
                     setInput(currentTranscript + (currentTranscript ? " " : "") + transcript);
                 }
                 
                 // Deepgram VAD detection - speech_final indicates end of utterance
                 if (received.speech_final) {
                     stopRecording();
                     // Send the final accumulated text
                     if (currentTranscript.trim()) {
                        handleSend(currentTranscript);
                     }
                 }
             };
             
             socket.onclose = () => {
                 setIsRecording(false);
                 stream.getTracks().forEach(t => t.stop());
             };

             mediaRecorder.ondataavailable = (event) => {
                 if (event.data.size > 0 && socket.readyState === 1) {
                     socket.send(event.data);
                 }
             };

         } catch (e) {
             console.error("Deepgram connection failed", e);
             setIsRecording(false);
             alert("Failed to access microphone or connect to Deepgram.");
         }
    };

    return (
        <div className="h-full flex flex-col relative bg-eburon-bg font-sans">
            
            <header className="px-6 py-4 border-b border-eburon-border flex justify-between items-center bg-eburon-bg/95 backdrop-blur supports-[backdrop-filter]:bg-eburon-bg/60 z-10 sticky top-0">
                <div className="flex items-center gap-3">
                     <div className={`w-2.5 h-2.5 rounded-full ${aiProvider === 'ollama' && isOllamaAvailable ? 'bg-eburon-ok shadow-glow' : aiProvider === 'ollama' && !isOllamaAvailable ? 'bg-red-500' : 'bg-eburon-accent shadow-glow'}`}></div>
                     <h1 className="text-lg font-bold text-white tracking-tight">
                        {aiProvider === 'ollama' ? `Eburon Edge` : 'Eburon Cloud'}
                     </h1>
                     
                     {aiProvider === 'ollama' && (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select 
                                    value={selectedOllamaModel}
                                    onChange={(e) => setSelectedOllamaModel(e.target.value)}
                                    className="bg-eburon-panel border border-eburon-border rounded-lg py-1 pl-2 pr-8 text-xs text-eburon-fg/80 focus:outline-none focus:border-eburon-accent cursor-pointer max-w-[200px] truncate"
                                    disabled={!isOllamaAvailable || isLoadingModels}
                                >
                                    {availableModels.map(m => (
                                        <option key={m.name} value={m.name}>
                                            {m.name} ({formatSize(m.size)} • {m.details?.quantization_level || 'Unknown'})
                                        </option>
                                    ))}
                                    <option value="custom">Custom Model...</option>
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-3 h-3 text-eburon-fg/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            {selectedOllamaModel === 'custom' && (
                                <input 
                                    type="text"
                                    value={customModelName}
                                    onChange={(e) => setCustomModelName(e.target.value)}
                                    placeholder="Model tag"
                                    className="bg-eburon-panel border border-eburon-border rounded-lg py-1 px-2 text-xs text-eburon-fg/80 focus:outline-none focus:border-eburon-accent w-32 transition-all"
                                />
                            )}
                            {isLoadingModels && <RefreshIcon className="w-3 h-3 animate-spin text-eburon-fg/50"/>}
                        </div>
                     )}
                </div>
                
                <div className="flex items-center gap-2">
                     <div className="flex items-center bg-eburon-panel border border-eburon-border rounded-lg p-0.5">
                        <button 
                            onClick={() => setAiProvider('gemini')} 
                            data-tooltip="Eburon Cloud (Gemini)"
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${aiProvider === 'gemini' ? 'bg-eburon-accent text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white hover:bg-white/5'}`}
                        >
                            Cloud
                        </button>
                        <button 
                            onClick={() => setAiProvider('ollama')} 
                            data-tooltip={`Eburon Edge (Local/Ollama)`}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${aiProvider === 'ollama' ? 'bg-purple-600 text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white hover:bg-white/5'}`}
                        >
                            Edge
                        </button>
                    </div>

                    <div className="h-6 w-px bg-eburon-border mx-1"></div>

                    <button 
                        onClick={handleClearChat} 
                        className="p-2 rounded-lg hover:bg-white/10 text-eburon-fg/60 hover:text-red-400 transition-colors" 
                        data-tooltip="Clear History"
                    >
                        <Trash2Icon className="w-5 h-5" />
                    </button>
                    
                    {aiProvider === 'gemini' && (
                        <div className="flex items-center bg-eburon-panel border border-eburon-border rounded-lg p-0.5 hidden sm:flex">
                            <button onClick={() => setModelMode('fast')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${modelMode === 'fast' ? 'bg-eburon-accent text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white'}`}>Fast</button>
                            <button onClick={() => setModelMode('normal')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${modelMode === 'normal' ? 'bg-eburon-accent text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white'}`}>Normal</button>
                            {config.chatbot.enableThinking && (
                                <button onClick={() => setModelMode('thinking')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${modelMode === 'thinking' ? 'bg-eburon-accent text-white shadow-sm' : 'text-eburon-fg/60 hover:text-white'}`}>Thinking</button>
                            )}
                        </div>
                    )}

                    {aiProvider === 'gemini' && (
                        <>
                            {config.chatbot.enableSearch && (
                                <button 
                                    onClick={() => setUseSearchGrounding(!useSearchGrounding)}
                                    className={`p-2 rounded-lg transition-colors ${useSearchGrounding ? 'text-eburon-accent bg-eburon-accent/10 border border-eburon-accent/30' : 'text-eburon-fg/60 hover:text-white hover:bg-white/10'}`}
                                    data-tooltip={useSearchGrounding ? "Search: ON" : "Search: OFF"}
                                >
                                    <SearchIcon className="w-5 h-5" />
                                </button>
                            )}
                            {config.chatbot.enableMaps && (
                                <button 
                                    onClick={() => setUseMapsGrounding(!useMapsGrounding)}
                                    className={`p-2 rounded-lg transition-colors ${useMapsGrounding ? 'text-eburon-accent bg-eburon-accent/10 border border-eburon-accent/30' : 'text-eburon-fg/60 hover:text-white hover:bg-white/10'}`}
                                    data-tooltip={useMapsGrounding ? "Maps: ON" : "Maps: OFF"}
                                >
                                    <GlobeIcon className="w-5 h-5" />
                                </button>
                            )}
                        </>
                    )}
                     <button 
                        onClick={() => setIsDeveloperMode(!isDeveloperMode)}
                        className={`p-2 rounded-lg transition-colors ${isDeveloperMode ? 'text-eburon-accent bg-eburon-accent/10' : 'text-eburon-fg/60 hover:text-white hover:bg-white/10'}`}
                        data-tooltip={isDeveloperMode ? "Dev Mode: ON" : "Dev Mode: OFF"}
                    >
                        <CodeIcon className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth pb-32">
                {isHistoryLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <LoadingIndicator text="Restoring context..." size="medium" />
                    </div>
                ) : messages.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-eburon-fg/30 space-y-4">
                        <div className="w-20 h-20 bg-eburon-panel rounded-3xl flex items-center justify-center shadow-soft-lg">
                            <BrainCircuitIcon className="w-10 h-10 opacity-50" />
                        </div>
                        <p className="font-medium">Start a new conversation</p>
                     </div>
                ) : (
                    messages.map((msg, index) => (
                        <div key={msg.id} className={`flex gap-4 items-start group animate-slide-up ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-eburon-accent to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-glow mt-1">
                                    E
                                </div>
                            )}
                            
                            <div className={`max-w-2xl p-4 sm:p-5 rounded-2xl shadow-md transition-all ${
                                msg.role === 'user' 
                                    ? 'bg-eburon-panel border border-eburon-border/50 text-white rounded-tr-sm' 
                                    : 'bg-eburon-bg border border-eburon-border text-eburon-fg/90 rounded-tl-sm'
                                }`}
                            >
                                {(msg.image || msg.imageUrl) && (
                                    <div className="mb-3 overflow-hidden rounded-xl border border-white/10">
                                        <img src={msg.image || msg.imageUrl} alt="content" className="w-full max-w-xs object-cover"/>
                                    </div>
                                )}
                                
                                <div className="whitespace-pre-wrap prose prose-invert prose-sm max-w-none leading-relaxed">
                                    {isLoading && msg.text === '' && msg.role === 'model' ? (
                                        <div className="flex space-x-1.5 py-2">
                                            <div className="w-2 h-2 bg-eburon-fg/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-2 h-2 bg-eburon-fg/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-2 h-2 bg-eburon-fg/40 rounded-full animate-bounce"></div>
                                        </div>
                                    ) : (
                                        msg.text
                                    )}
                                    {isLoading && index === messages.length - 1 && msg.role === 'model' && msg.text !== '' && (
                                         <span className="inline-block w-1.5 h-4 bg-eburon-accent animate-pulse ml-1 align-middle"></span>
                                    )}
                                </div>
                                
                                {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-white/5">
                                        <div className="flex flex-wrap gap-2">
                                            {msg.groundingChunks.map((chunk, idx) => {
                                                const source = chunk.web || chunk.maps;
                                                return source && source.uri ? (
                                                    <a 
                                                        href={source.uri} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        key={idx} 
                                                        className="flex items-center gap-1.5 text-xs bg-black/20 hover:bg-black/40 text-eburon-accent px-2.5 py-1.5 rounded-md transition-colors border border-transparent hover:border-eburon-accent/30 truncate max-w-xs"
                                                        data-tooltip={source.title || "Open Source"}
                                                    >
                                                        {chunk.maps ? <GlobeIcon className="w-3 h-3"/> : <SearchIcon className="w-3 h-3"/>}
                                                        <span className="truncate">{source.title || 'Source'}</span>
                                                    </a>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}

                                {msg.role === 'model' && msg.telemetry && (
                                    <div className="mt-3 flex items-center justify-end gap-3 text-[10px] text-eburon-fg/30 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span title="Tokens Generated">{msg.telemetry.tokensUsed} tok</span>
                                        <span title="Energy Cost">{msg.telemetry.energy}</span>
                                        <span title="Speed">{msg.telemetry.wps} wps</span>
                                        {msg.telemetry.model && <span className="uppercase border border-eburon-border px-1 rounded bg-black/20">{msg.telemetry.model}</span>}
                                    </div>
                                )}
                            </div>
                            
                             {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-lg bg-eburon-panel border border-eburon-border flex items-center justify-center text-eburon-fg/50 flex-shrink-0 mt-1">
                                    <div className="w-4 h-4 bg-eburon-fg/20 rounded-full"></div>
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-eburon-bg via-eburon-bg to-transparent z-20">
                 {imagePreview && (
                    <div className="relative w-16 h-16 mb-3 ml-1 group animate-slide-up">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl border border-eburon-border shadow-lg"/>
                        <button 
                            onClick={removeImage} 
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:scale-110 transition-transform"
                            data-tooltip="Remove Image"
                        >
                            <XIcon className="w-3 h-3" />
                        </button>
                    </div>
                )}
                
                {/* Grounding Indicators overlay above text area */}
                {(useSearchGrounding || useMapsGrounding) && (
                    <div className="absolute -top-8 left-6 flex gap-2">
                        {useSearchGrounding && (
                            <div className="bg-eburon-accent/10 backdrop-blur-md border border-eburon-accent/30 text-eburon-accent text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-fade-in">
                                <GoogleIcon className="w-3 h-3" />
                                <span className="font-medium">Search Grounding On</span>
                            </div>
                        )}
                        {useMapsGrounding && (
                            <div className="bg-eburon-accent/10 backdrop-blur-md border border-eburon-accent/30 text-eburon-accent text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-fade-in">
                                <GlobeIcon className="w-3 h-3" />
                                <span className="font-medium">Maps Grounding On</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="max-w-3xl mx-auto bg-eburon-panel/80 backdrop-blur-xl border border-eburon-border/50 rounded-2xl shadow-2xl flex items-end p-2 transition-all focus-within:border-eburon-accent/50 focus-within:shadow-glow relative">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        ref={fileInputRef}
                        className="hidden"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="p-3 text-eburon-fg/50 hover:text-eburon-accent hover:bg-white/5 rounded-xl transition-all flex-shrink-0"
                        data-tooltip="Upload Image"
                    >
                        <PaperclipIcon className="w-5 h-5" />
                    </button>
                    
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isLoading) handleSend();
                            }
                        }}
                        placeholder={aiProvider === 'ollama' ? `Message Eburon Edge...` : (isRecording ? 'Listening...' : 'Type a message...')}
                        className="flex-1 bg-transparent focus:outline-none px-2 py-3 max-h-32 min-h-[44px] resize-none text-sm text-white placeholder-eburon-fg/30"
                        disabled={isLoading}
                        rows={1}
                        style={{ height: 'auto', minHeight: '44px' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                        }}
                    />

                    <div className="flex items-center gap-1 pb-0.5">
                        <button 
                            onClick={() => isRecording ? stopRecording() : startDeepgramSession()} 
                            disabled={isLoading} 
                            className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-glow' : 'text-eburon-fg/50 hover:text-eburon-fg hover:bg-white/5 disabled:opacity-30'}`}
                            data-tooltip={isRecording ? "Stop Recording" : "Voice Input (Deepgram)"}
                        >
                            {isRecording ? <StopIcon className="w-5 h-5"/> : <MicIcon className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={() => handleSend()} 
                            disabled={isLoading || (!input.trim() && !imageFile)} 
                            className="p-3 rounded-xl bg-eburon-accent text-white disabled:bg-eburon-panel disabled:text-eburon-fg/20 transition-all shadow-lg hover:shadow-glow hover:scale-105 disabled:hover:scale-100 disabled:shadow-none"
                            data-tooltip="Send"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="text-center mt-2 text-[10px] text-eburon-fg/20 font-medium tracking-widest uppercase">
                    Powered by Eburon Intelligence
                </div>
            </div>
        </div>
    );
};

export default ChatbotView;
