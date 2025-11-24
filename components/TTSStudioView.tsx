
import React, { useState, useEffect, useRef } from 'react';
import * as dataService from '../services/dataService';
import { TtsGeneration, Voice } from '../types';
import { DownloadIcon, SoundWaveIcon, HistoryIcon, PlayIcon, PauseIcon, CheckCircleIcon } from './icons';
import { LoadingIndicator } from './LoadingIndicator';

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';
type ActiveTab = 'generator' | 'history';

const TabButton: React.FC<{
    label: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon: Icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 py-3 px-5 font-semibold transition-colors border-b-2 ${
            isActive
                ? 'text-eburon-accent border-eburon-accent'
                : 'text-eburon-fg/70 hover:text-eburon-fg border-transparent hover:border-eburon-border'
        }`}
    >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
    </button>
);

const TTSStudioView: React.FC = () => {
    const [inputText, setInputText] = useState(
`Welcome to Eburon Voice Studio. Select a voice to generate studio-quality audio.`
    );
    const [status, setStatus] = useState<GenerationStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const [generatedAudio, setGeneratedAudio] = useState<{ url: string, blob: Blob } | null>(null);
    const [history, setHistory] = useState<TtsGeneration[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    
    // Dynamic voices state
    const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
    const [isLoadingVoices, setIsLoadingVoices] = useState(true);

    const [activeTab, setActiveTab] = useState<ActiveTab>('generator');
    
    // Audio playback state
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playingId, setPlayingId] = useState<string | null>(null); // 'current' for generator, or history ID

    useEffect(() => {
        const loadVoices = async () => {
            try {
                const voices = await dataService.getVoices();
                setAvailableVoices(voices);
                if (voices.length > 0) {
                    setSelectedVoiceId(voices[0].id);
                }
            } catch (err) {
                console.error("Failed to load voices:", err);
                setError("Failed to load voice list.");
            } finally {
                setIsLoadingVoices(false);
            }
        };
        loadVoices();
        
        const loadHistory = async () => {
            try {
                const gens = await dataService.getTtsGenerations();
                setHistory(gens);
            } catch (e) {
                console.error("Failed to load history", e);
            } finally {
                setIsLoadingHistory(false);
            }
        }
        loadHistory();
        
        // Cleanup function for Blob URLs
        return () => {
            if (generatedAudio && generatedAudio.url.startsWith('blob:')) {
                URL.revokeObjectURL(generatedAudio.url);
            }
        };
    }, []);

    // Handle audio ending to reset UI state
    const handleAudioEnded = () => {
        setPlayingId(null);
    };

    const handleGenerate = async () => {
        if (!inputText.trim() || !selectedVoiceId) {
            setError("Please enter text and select a voice.");
            return;
        }
        
        setStatus('generating');
        setError(null);
        
        // Cleanup previous URL if exists and is blob
        if (generatedAudio && generatedAudio.url.startsWith('blob:')) {
            URL.revokeObjectURL(generatedAudio.url);
            setGeneratedAudio(null);
        }
        
        try {
            // API call to Bland AI via dataService to get BLOB
            const audioBlob = await dataService.generateVoiceSample(selectedVoiceId, inputText, 'en'); 

            // Persist to Supabase/IDB and get record with proper URL
            const newGenerationRecord = await dataService.saveTtsGeneration(inputText, audioBlob);

            setGeneratedAudio({ url: newGenerationRecord.audio_url, blob: audioBlob });
            setHistory(prev => [newGenerationRecord, ...prev]);
            setStatus('success');

        } catch (err: any) {
            console.error("TTS Generation failed:", err);
            setError(err.message || "Failed to generate audio. Please try again.");
            setStatus('error');
        }
    };

    const togglePlayback = (url: string, id: string) => {
        if (audioRef.current) {
            if (playingId === id) {
                audioRef.current.pause();
                setPlayingId(null);
            } else {
                audioRef.current.src = url;
                audioRef.current.play().catch(e => console.error("Playback failed", e));
                setPlayingId(id);
            }
        }
    };

    const getStatusMessage = () => {
        switch (status) {
            case 'generating': return 'Generating Audio...';
            default: return 'Generate Speech';
        }
    };

    const renderGenerator = () => (
        <div className="flex flex-col gap-6 h-full animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-2 flex flex-col gap-4">
                    <label className="text-sm font-bold text-eburon-fg/60 uppercase tracking-wide">Script</label>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Enter text here..."
                        className="w-full h-64 bg-eburon-panel border border-eburon-border rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-eburon-accent text-lg font-mono resize-none transition-all"
                        disabled={status === 'generating'}
                    />
                 </div>
                 
                 <div className="flex flex-col gap-4">
                    <label className="text-sm font-bold text-eburon-fg/60 uppercase tracking-wide">Voice Selection</label>
                    {isLoadingVoices ? (
                        <LoadingIndicator size="small" text="Loading voices..." />
                    ) : (
                        <div className="flex flex-col gap-2 h-64 overflow-y-auto bg-eburon-panel border border-eburon-border rounded-xl p-2 no-scrollbar">
                            {availableVoices.map(voice => (
                                <button
                                    key={voice.id}
                                    onClick={() => setSelectedVoiceId(voice.id)}
                                    className={`text-left px-4 py-3 rounded-lg transition-all flex items-center justify-between group ${
                                        selectedVoiceId === voice.id 
                                        ? 'bg-eburon-accent text-white shadow-md' 
                                        : 'hover:bg-white/5 text-eburon-fg/80'
                                    }`}
                                >
                                    <span className="font-medium truncate mr-2">{voice.name}</span>
                                    {selectedVoiceId === voice.id && <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    )}
                 </div>
            </div>

            <div className="flex items-center justify-between border-t border-eburon-border pt-6 mt-auto">
                <div className="text-sm text-eburon-fg/40 font-mono">
                    {inputText.length} chars
                </div>
                <div className="flex items-center gap-4">
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button 
                        onClick={handleGenerate} 
                        disabled={status === 'generating' || isLoadingVoices}
                        className="bg-eburon-accent hover:bg-eburon-accent-dark text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-glow flex items-center justify-center disabled:bg-eburon-panel disabled:text-eburon-fg/30 disabled:cursor-not-allowed disabled:shadow-none active:scale-95"
                    >
                        {status === 'generating' ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <SoundWaveIcon className="w-5 h-5 mr-2" />
                                {getStatusMessage()}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {generatedAudio && (
                <div className="bg-eburon-panel p-6 rounded-xl border border-eburon-accent/30 shadow-lg animate-slide-up flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => togglePlayback(generatedAudio.url, 'current')}
                            className="w-12 h-12 rounded-full bg-eburon-accent text-white flex items-center justify-center hover:scale-105 transition-transform shadow-glow"
                        >
                             {playingId === 'current' ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-1" />}
                        </button>
                        <div>
                            <h3 className="font-bold text-white text-sm">Generation Complete</h3>
                            <p className="text-xs text-eburon-fg/50">Ready for preview</p>
                        </div>
                    </div>
                    
                     <a 
                        href={generatedAudio.url} 
                        download={`eburon_tts_${Date.now()}.wav`}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-eburon-accent transition-colors border border-eburon-border hover:border-eburon-accent/50"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download WAV
                    </a>
                </div>
            )}
        </div>
    );

    const renderHistory = () => (
        <div className="animate-fade-in">
            {isLoadingHistory ? (
                <LoadingIndicator text="Loading History" size="small" />
            ) : history.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-eburon-fg/30">
                    <HistoryIcon className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No generation history yet.</p>
                    <button onClick={() => setActiveTab('generator')} className="mt-4 text-eburon-accent hover:underline">Create your first clip</button>
                </div>
            ) : (
                <div className="space-y-4">
                    {history.map(gen => (
                        <div key={gen.id} className="bg-eburon-panel border border-eburon-border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center transition-all hover:border-eburon-accent/30 hover:bg-eburon-panel/80 group">
                             <div className="flex-grow min-w-0 w-full">
                                <p className="text-eburon-fg/90 font-medium line-clamp-1 mb-1 font-mono text-sm">"{gen.input_text}"</p>
                                <p className="text-xs text-eburon-fg/40">{new Date(gen.created_at).toLocaleString()}</p>
                             </div>
                             <div className="flex items-center gap-3 flex-shrink-0">
                                <button 
                                    onClick={() => togglePlayback(gen.audio_url, gen.id)}
                                    className={`p-3 rounded-full transition-colors ${playingId === gen.id ? 'bg-eburon-accent text-white' : 'bg-eburon-bg text-eburon-fg hover:text-white'}`}
                                >
                                     {playingId === gen.id ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
                                </button>
                                <a 
                                    href={gen.audio_url} 
                                    download={`eburon_tts_${gen.id}.wav`}
                                    className="p-3 text-eburon-fg/50 hover:text-eburon-accent bg-eburon-bg rounded-full transition-colors"
                                    title="Download"
                                >
                                    <DownloadIcon className="w-4 h-4" />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
    
    return (
        <div className="p-6 sm:p-8 h-full flex flex-col">
            <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
            
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-eburon-fg mb-2">Eburon Voice Studio</h1>
                <p className="text-eburon-fg/70">
                    Generate lifelike speech using Eburon's advanced neural audio models.
                </p>
            </div>
            
            <div className="flex border-b border-eburon-border mb-6">
                <TabButton
                    label="Studio"
                    icon={SoundWaveIcon}
                    isActive={activeTab === 'generator'}
                    onClick={() => setActiveTab('generator')}
                />
                <TabButton
                    label="History"
                    icon={HistoryIcon}
                    isActive={activeTab === 'history'}
                    onClick={() => setActiveTab('history')}
                />
            </div>
            
            <div className="flex-grow overflow-y-auto">
                {activeTab === 'generator' && renderGenerator()}
                {activeTab === 'history' && renderHistory()}
            </div>
        </div>
    );
};

export default TTSStudioView;
