



import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from '@google/genai';
import { Agent, LiveTranscript, ToolCallData } from '../types';

// --- Audio Helper Functions (from Gemini Docs) ---
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createBlob(data: Float32Array): GenaiBlob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// FIX: Updated `decodeAudioData` to match the Gemini API guidelines for robustness.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// --- End Audio Helper Functions ---

export const useGeminiLiveAgent = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);
    const [toolCalls, setToolCalls] = useState<ToolCallData[]>([]);

    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<any | null>(null);
    
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    
    // Refs for noise cancellation nodes
    const highPassFilterRef = useRef<BiquadFilterNode | null>(null);
    const compressorRef = useRef<DynamicsCompressorNode | null>(null);

    const playbackQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const isMicrophonePaused = useRef(false);

    const pauseMicrophoneStream = useCallback(() => {
        isMicrophonePaused.current = true;
    }, []);

    const resumeMicrophoneStream = useCallback(() => {
        isMicrophonePaused.current = false;
    }, []);

    const cleanup = useCallback(() => {
        setIsSessionActive(false);
        setIsConnecting(false);

        sessionPromiseRef.current?.then((session: any) => session.close());
        sessionPromiseRef.current = null;

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (compressorRef.current) {
            compressorRef.current.disconnect();
            compressorRef.current = null;
        }
        if (highPassFilterRef.current) {
            highPassFilterRef.current.disconnect();
            highPassFilterRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }

        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        playbackQueueRef.current.forEach(source => source.stop());
        playbackQueueRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    const startSession = useCallback(async (agent: Agent, tools?: any[]) => {
        if (isSessionActive || isConnecting) return;

        setIsConnecting(true);
        setError(null);
        setTranscripts([]);
        setToolCalls([]);
        isMicrophonePaused.current = false;

        try {
            if (!aiRef.current) {
                if (!process.env.API_KEY) {
                    throw new Error("API_KEY environment variable not set");
                }
                aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            let currentInputTranscription = '';
            let currentOutputTranscription = '';

            const connectConfig: any = {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                systemInstruction: agent.systemPrompt,
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            };
            if (tools) {
                connectConfig.tools = tools;
            }

            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: connectConfig,
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsSessionActive(true);
                        
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        sourceNodeRef.current = source;

                        // --- Noise Cancellation Setup ---
                        const highPassFilter = inputAudioContextRef.current!.createBiquadFilter();
                        highPassFilter.type = 'highpass';
                        highPassFilter.frequency.value = 100; // Cut off low-frequency rumble
                        highPassFilterRef.current = highPassFilter;

                        const compressor = inputAudioContextRef.current!.createDynamicsCompressor();
                        compressor.threshold.value = -50; // Quieter sounds below this are not boosted
                        compressor.knee.value = 40;
                        compressor.ratio.value = 12;
                        compressor.attack.value = 0;
                        compressor.release.value = 0.25;
                        compressorRef.current = compressor;
                        // --- End Noise Cancellation Setup ---

                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            if (isMicrophonePaused.current) return;
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        // Connect the audio chain with noise cancellation
                        source.connect(highPassFilter);
                        highPassFilter.connect(compressor);
                        compressor.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall?.functionCalls) {
                            const newCalls: ToolCallData[] = message.toolCall.functionCalls.map(fc => ({
                                id: fc.id,
                                name: fc.name,
                                args: fc.args,
                                timestamp: Date.now()
                            }));
                            setToolCalls(prev => [...prev, ...newCalls]);

                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendToolResponse({
                                    functionResponses: message.toolCall.functionCalls.map(fc => ({
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "CRM action logged for demo." }
                                    }))
                                });
                            });
                        }
                        
                        if (message.serverContent?.inputTranscription) {
                            const transcription = message.serverContent.inputTranscription;
                            const text = transcription.text;
                            // Safely access `isFinal` as it might not exist on the type.
                            const isFinal = 'isFinal' in transcription ? !!(transcription as any).isFinal : false;
                            currentInputTranscription += text;
                            setTranscripts(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.role === 'user' && !last.isFinal) {
                                    // Perform immutable update
                                    const updatedLast = { ...last, text: currentInputTranscription, isFinal };
                                    return [...prev.slice(0, -1), updatedLast];
                                }
                                return [...prev, { id: Date.now(), role: 'user', text: currentInputTranscription, isFinal }];
                            });
                        }
                        if (message.serverContent?.outputTranscription) {
                            const transcription = message.serverContent.outputTranscription;
                            const text = transcription.text;
                            // Safely access `isFinal` as it might not exist on the type.
                            const isFinal = 'isFinal' in transcription ? !!(transcription as any).isFinal : false;
                            currentOutputTranscription += text;
                            setTranscripts(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.role === 'model' && !last.isFinal) {
                                     // Perform immutable update
                                    const updatedLast = { ...last, text: currentOutputTranscription, isFinal };
                                    return [...prev.slice(0, -1), updatedLast];
                                }
                                return [...prev, { id: Date.now(), role: 'model', text: currentOutputTranscription, isFinal }];
                            });
                        }
                         if (message.serverContent?.turnComplete) {
                            currentInputTranscription = '';
                            currentOutputTranscription = '';
                        }
                        
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            const ctx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            // FIX: Updated `decodeAudioData` call to pass sample rate and channel count explicitly.
                            const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            source.addEventListener('ended', () => {
                                playbackQueueRef.current.delete(source);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            playbackQueueRef.current.add(source);
                        }
                    },
                    onclose: () => {
                        cleanup();
                    },
                    onerror: (e: ErrorEvent) => {
                        setError(`Session error: ${e.message}`);
                        console.error(e);
                        cleanup();
                    }
                }
            });
            await sessionPromiseRef.current;
        } catch (e: any) {
            setError(`Failed to start session: ${e.message}`);
            console.error(e);
            cleanup();
            setIsConnecting(false);
            throw e;
        }
    }, [isSessionActive, isConnecting, cleanup]);

    const endSession = useCallback(() => {
        cleanup();
        setTranscripts([]);
        setToolCalls([]);
    }, [cleanup]);

    return { isConnecting, isSessionActive, transcripts, toolCalls, error, startSession, endSession, pauseMicrophoneStream, resumeMicrophoneStream };
};