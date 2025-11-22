
import React, { useState, useRef } from 'react';
import { PlusIcon, PlayIcon, PauseIcon } from './icons';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../services/audioUtils';

const voices = [
    { name: 'Amber', style: 'Warm, organic, and inviting', prebuilt: 'Kore' },
    { name: 'Onyx', style: 'Deep, clear, and authoritative', prebuilt: 'Puck' },
    { name: 'Citrine', style: 'Bright, energetic, and positive', prebuilt: 'Zephyr' },
    { name: 'Jade', style: 'Serene, smooth, and narrative', prebuilt: 'Charon' },
    { name: 'Peridot', style: 'A pleasant and approachable tone', prebuilt: 'Fenrir' },
    { name: 'Diamond', style: 'Clear, brilliant, and sophisticated', prebuilt: 'Aoede' },
    { name: 'Orion', style: 'A calm, professional, and trustworthy voice', prebuilt: 'Orion' },
    { name: 'Lyra', style: 'A youthful and energetic female voice', prebuilt: 'Lyra' },
    { name: 'Calypso', style: 'A mature and reassuring female voice', prebuilt: 'Calypso' },
    { name: 'Helios', style: 'A mature and authoritative male voice', prebuilt: 'Helios' },
    { name: 'Echo', style: 'A neutral, standard male voice', prebuilt: 'Echo' },
    { name: 'Aura', style: 'A neutral, standard female voice', prebuilt: 'Aura' },
];

const VoicesView: React.FC = () => {
    const [playingVoice, setPlayingVoice] = useState<string | null>(null);
    const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const playPreview = async (voiceName: string, prebuiltVoice: string) => {
        if (loadingVoice) return;
        
        if (playingVoice) {
            audioSourceRef.current?.stop();
            audioSourceRef.current = null;
            setPlayingVoice(null);
            if (playingVoice === voiceName) {
                return; // just stop if clicking the same one
            }
        }
        
        setError(null);
        setLoadingVoice(voiceName);

        try {
            if (!process.env.API_KEY) {
                throw new Error("API_KEY not set.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Hello, this is the ${voiceName} voice.` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: prebuiltVoice },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                const source = outputAudioContext.createBufferSource();
                audioSourceRef.current = source;
                source.buffer = audioBuffer;
                source.connect(outputAudioContext.destination);
                source.start();
                setPlayingVoice(voiceName);
                source.onended = () => {
                    // Check if this source is still the one playing
                    if (audioSourceRef.current === source) {
                        setPlayingVoice(null);
                        audioSourceRef.current = null;
                    }
                };
            } else {
                throw new Error("API did not return audio data.");
            }
        } catch (error) {
            console.error("Error generating speech:", error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            setError(`Failed to play voice preview: ${message}`);
        } finally {
            setLoadingVoice(null);
        }
    };
    

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-eburon-fg">Voices</h1>
                    <p className="text-eburon-fg/70">Preview and select a voice for your agents.</p>
                </div>
                <button className="flex items-center space-x-2 bg-eburon-accent text-white font-semibold px-4 py-2 rounded-lg hover:bg-eburon-accent-dark transition-colors">
                    <PlusIcon className="w-5 h-5" />
                    <span>Add Voice</span>
                </button>
            </div>
            
            {error && <div className="p-4 mb-4 text-center text-red-400 bg-red-900/50 border border-red-500 rounded-lg">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {voices.map(voice => (
                    <div key={voice.name} className="bg-eburon-panel border border-eburon-border rounded-xl p-4 flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold text-eburon-fg">{voice.name}</h3>
                            <p className="text-eburon-fg/70 text-sm">{voice.style}</p>
                        </div>
                        <button 
                            onClick={() => playPreview(voice.name, voice.prebuilt)}
                            disabled={!!loadingVoice && loadingVoice !== voice.name}
                            className="w-10 h-10 rounded-full bg-eburon-bg hover:bg-eburon-accent flex items-center justify-center transition-colors text-eburon-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                            {loadingVoice === voice.name ? 
                                <div className="w-5 h-5 border-2 border-eburon-fg/50 border-t-eburon-fg rounded-full animate-spin"></div> : 
                            playingVoice === voice.name ? 
                                <PauseIcon className="w-5 h-5"/> : 
                                <PlayIcon className="w-5 h-5"/>
                            }
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VoicesView;
