
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenaiBlob } from '@google/genai';
import { LiveTranscript, ToolCallData } from '../types';
import { dispatchAylaToolCall } from '../services/toolService';

// Audio Context configuration
const AUDIO_SAMPLE_RATE = 16000;
const MODEL_SAMPLE_RATE = 24000;

// Helper to convert Float32 audio data to 16-bit PCM Base64 string
function float32ToB64PCM(float32Array: Float32Array): string {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Clamp values to [-1, 1] range and scale to 16-bit integer
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Convert Int16Array to binary string
    let binary = '';
    const bytes = new Uint8Array(int16Array.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Helper to decode Base64 PCM data to Float32Array for playback
function b64PCMToFloat32(base64: string): Float32Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Assuming 16-bit PCM little-endian
    const dataView = new DataView(bytes.buffer);
    const float32 = new Float32Array(bytes.length / 2);
    
    for (let i = 0; i < float32.length; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        float32[i] = int16 / 32768.0;
    }
    return float32;
}

export const useGeminiLiveAgent = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcripts, setTranscripts] = useState<LiveTranscript[]>([]);
    const [toolCalls, setToolCalls] = useState<ToolCallData[]>([]);

    const aiRef = useRef<GoogleGenAI | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    
    // Audio Contexts
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    
    // Nodes
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    
    // Playback Queue
    const nextStartTimeRef = useRef<number>(0);
    const playbackQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
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

        if (sessionPromiseRef.current) {
             sessionPromiseRef.current.then((session: any) => {
                 try {
                    session.close();
                 } catch(e) { console.warn("Session close error", e)}
             }).catch(() => {});
        }
        sessionPromiseRef.current = null;

        // Stop media stream tracks
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // Disconnect audio nodes
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }

        // Close contexts
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        
        // Clear playback queue
        playbackQueueRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        playbackQueueRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    const startSession = useCallback(async (systemInstruction: string, tools?: any[], voiceName: string = 'Leda') => {
        if (isSessionActive || isConnecting) return;

        setIsConnecting(true);
        setError(null);
        setTranscripts([]);
        setToolCalls([]);
        isMicrophonePaused.current = false;

        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                throw new Error("Gemini API Key not found. Please ensure process.env.API_KEY is set.");
            }
            
            aiRef.current = new GoogleGenAI({ apiKey });
            
            // Initialize Audio Contexts
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            
            // Input context (recording)
            inputAudioContextRef.current = new AudioContextClass({ sampleRate: AUDIO_SAMPLE_RATE });
            
            // Output context (playback) - Gemini usually returns 24kHz
            outputAudioContextRef.current = new AudioContextClass({ sampleRate: MODEL_SAMPLE_RATE });

            // Get Microphone Stream
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: AUDIO_SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    autoGainControl: true,
                    noiseSuppression: true
                } 
            });
            mediaStreamRef.current = stream;

            // Gemini Session Config
            const config: any = {
                responseModalities: [Modality.AUDIO],
                speechConfig: { 
                    voiceConfig: { 
                        prebuiltVoiceConfig: { voiceName } 
                    } 
                },
                systemInstruction: systemInstruction,
            };
            
            if (tools && tools.length > 0) {
                config.tools = tools;
            }

            // Connect to Gemini Live
            sessionPromiseRef.current = aiRef.current.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: config,
                callbacks: {
                    onopen: () => {
                        console.log("Gemini Live Session Opened");
                        setIsConnecting(false);
                        setIsSessionActive(true);
                        
                        // Set up Audio Input Pipeline
                        const ctx = inputAudioContextRef.current;
                        if(!ctx) return;

                        const source = ctx.createMediaStreamSource(stream);
                        sourceNodeRef.current = source;

                        // Use ScriptProcessor for simple PCM capture
                        // Buffer size 4096 provides a good balance of latency and stability
                        const processor = ctx.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;

                        processor.onaudioprocess = (e) => {
                            if (isMicrophonePaused.current) return;
                            
                            const inputData = e.inputBuffer.getChannelData(0);
                            const b64Data = float32ToB64PCM(inputData);
                            
                            sessionPromiseRef.current?.then((session: any) => {
                                session.sendRealtimeInput({ 
                                    media: {
                                        mimeType: 'audio/pcm;rate=16000',
                                        data: b64Data
                                    }
                                });
                            });
                        };

                        source.connect(processor);
                        processor.connect(ctx.destination); // Required for script processor to run
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle Tool Calls
                        if (message.toolCall) {
                            console.log("Tool Call Received:", message.toolCall);
                            
                            // We process each function call
                            const functionResponses = [];
                            
                            for (const fc of message.toolCall.functionCalls) {
                                const callId = fc.id;
                                const name = fc.name;
                                const args = fc.args;

                                // Log tool call for UI
                                setToolCalls(prev => [...prev, {
                                    id: callId,
                                    name: name,
                                    args: args,
                                    timestamp: Date.now()
                                }]);

                                // Execute Logic
                                const result = dispatchAylaToolCall({ name, args });
                                
                                // Prepare response for model
                                functionResponses.push({
                                    id: callId,
                                    name: name,
                                    response: { result: result } 
                                });
                            }

                            // Send response back to Gemini
                             sessionPromiseRef.current?.then((session: any) => {
                                session.sendToolResponse({
                                    functionResponses: functionResponses
                                });
                            });
                        }
                        
                        // Handle Audio Output
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            const ctx = outputAudioContextRef.current;
                            const float32Data = b64PCMToFloat32(audioData);
                            
                            const buffer = ctx.createBuffer(1, float32Data.length, MODEL_SAMPLE_RATE);
                            buffer.getChannelData(0).set(float32Data);

                            // Schedule playback
                            const currentTime = ctx.currentTime;
                            if (nextStartTimeRef.current < currentTime) {
                                nextStartTimeRef.current = currentTime;
                            }
                            
                            const source = ctx.createBufferSource();
                            source.buffer = buffer;
                            source.connect(ctx.destination);
                            
                            source.addEventListener('ended', () => {
                                playbackQueueRef.current.delete(source);
                            });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                            playbackQueueRef.current.add(source);
                        }
                    },
                    onclose: (e: CloseEvent) => {
                        console.log("Gemini Live Session Closed", e);
                        cleanup();
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error("Gemini Live Error", e);
                        setError(`Session error: ${e.message}`);
                        cleanup();
                    }
                }
            });

        } catch (e: any) {
            setError(`Failed to start session: ${e.message}`);
            console.error(e);
            cleanup();
        }
    }, [isSessionActive, isConnecting, cleanup]);

    const endSession = useCallback(() => {
        cleanup();
    }, [cleanup]);

    return { 
        isConnecting, 
        isSessionActive, 
        transcripts, 
        toolCalls, 
        error, 
        startSession, 
        endSession, 
        pauseMicrophoneStream, 
        resumeMicrophoneStream 
    };
};
