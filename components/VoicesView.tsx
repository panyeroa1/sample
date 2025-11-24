
import React, { useState, useEffect, useRef } from 'react';
import * as dataService from '../services/dataService';
import { Voice } from '../types';
import { PlayIcon, PauseIcon, RefreshIcon, SpeakerIcon } from './icons';
import { LoadingIndicator } from './LoadingIndicator';

const VoicesView: React.FC = () => {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Audio State
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio());

    useEffect(() => {
        loadVoices();
        
        const audio = audioRef.current;
        const onEnded = () => setPlayingVoiceId(null);
        const onError = () => {
            setPlayingVoiceId(null);
            setLoadingAudioId(null);
            alert("Failed to play audio sample.");
        };

        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        
        return () => {
            audio.pause();
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    }, []);

    const loadVoices = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Using dataService which calls backend
            const fetchedVoices = await dataService.getVoices();
            setVoices(fetchedVoices);
        } catch (err: any) {
            console.error("Failed to load voices:", err);
            setError("Could not load voices from Eburon Engine. Please check your connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlayPreview = async (voice: Voice) => {
        if (playingVoiceId === voice.id) {
            audioRef.current.pause();
            setPlayingVoiceId(null);
            return;
        }

        setLoadingAudioId(voice.id);
        try {
            const text = "Hello! I am capable of human-like speech. How can I help you?";
            // Using dataService
            const audioBlob = await dataService.generateVoiceSample(voice.id, text, 'en');
            const url = URL.createObjectURL(audioBlob);
            
            audioRef.current.src = url;
            await audioRef.current.play();
            setPlayingVoiceId(voice.id);
        } catch (err) {
            console.error(err);
            alert("Could not generate preview.");
        } finally {
            setLoadingAudioId(null);
        }
    };

    return (
        <div className="h-full flex flex-col p-6 sm:p-8 overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-eburon-fg">Voice Library</h1>
                    <p className="text-eburon-fg/70">Manage available voices from Eburon Voice Engine.</p>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={loadVoices} 
                        className="p-2 rounded-lg bg-eburon-panel border border-eburon-border text-eburon-fg hover:text-white hover:bg-white/5 transition-colors"
                        data-tooltip="Refresh List"
                    >
                        <RefreshIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="p-4 mb-4 text-center text-red-400 bg-red-900/20 border border-red-500/50 rounded-lg">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex-grow flex items-center justify-center">
                    <LoadingIndicator text="Fetching voices from Eburon Engine..." size="large" />
                </div>
            ) : (
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {voices.map(voice => (
                            <div key={voice.id} className="bg-eburon-panel border border-eburon-border rounded-xl p-4 flex flex-col transition-all hover:border-eburon-accent/50 hover:shadow-lg group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-eburon-fg/50 border border-white/5">
                                            <SpeakerIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-eburon-fg truncate max-w-[120px]" title={voice.name}>{voice.name}</h3>
                                            <span className="text-[10px] uppercase tracking-wider text-eburon-fg/40 bg-black/20 px-1.5 py-0.5 rounded">
                                                {voice.type || 'Public'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-grow">
                                     <div className="flex flex-wrap gap-1 mt-2">
                                        {voice.tags && voice.tags.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="text-[10px] text-eburon-fg/60 bg-eburon-bg border border-eburon-border px-2 py-1 rounded-full">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                                     <span className="text-xs text-eburon-fg/30 font-mono truncate max-w-[100px]" title={voice.id}>
                                        {voice.id}
                                     </span>
                                     <button 
                                        onClick={() => handlePlayPreview(voice)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            playingVoiceId === voice.id 
                                            ? 'bg-eburon-accent text-white shadow-glow' 
                                            : 'bg-eburon-bg text-eburon-fg/70 hover:text-white hover:bg-white/10'
                                        }`}
                                        disabled={loadingAudioId !== null && loadingAudioId !== voice.id}
                                    >
                                        {loadingAudioId === voice.id ? (
                                            <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                        ) : playingVoiceId === voice.id ? (
                                            <PauseIcon className="w-3 h-3" />
                                        ) : (
                                            <PlayIcon className="w-3 h-3" />
                                        )}
                                        {playingVoiceId === voice.id ? 'Stop' : 'Sample'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoicesView;
