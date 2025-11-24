
import { GoogleGenAI, GenerateContentResponse, GroundingMetadata, Modality, Content, Part } from "@google/genai";
import { ChatMessage } from '../types';
import { getConfig } from "./configService";

// Helper to get initialized AI client
const getAiClient = () => {
    // Config priority: App Config > Env Var
    // Note: In a real app, env vars are usually build-time or server-side. 
    // Here we assume process.env is available for the demo key.
    const config = getConfig();
    const apiKey = config.apiKeys.geminiApiKey || process.env.API_KEY;
    
    if (!apiKey) {
        throw new Error("Gemini API Key not configured. Please set it in Admin Settings or env.");
    }
    return new GoogleGenAI({ apiKey });
}

const EBURON_ERROR_MESSAGE = "The Eburon.ai service encountered an error. Please try again.";

// --- Audio Helper Functions ---
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function pcmToWavBlob(pcmData: Uint8Array, options: { numChannels: number, sampleRate: number, bitDepth: number }): Blob {
    const { numChannels, sampleRate, bitDepth } = options;
    const byteRate = sampleRate * numChannels * bitDepth / 8;
    const blockAlign = numChannels * bitDepth / 8;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
}

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
}

export const sendMessageStreamToGemini = async (
    history: ChatMessage[],
    newMessage: string,
    imageFile: File | null,
    options: {
        useSearchGrounding: boolean;
        useMapsGrounding: boolean;
        useLowLatency: boolean;
        useThinkingMode: boolean;
        userLocation: { latitude: number; longitude: number } | null;
    },
    systemPrompt: string
): Promise<AsyncIterable<GenerateContentResponse>> => {
    try {
        const ai = getAiClient();
        
        // Model selection logic
        let modelName = 'gemini-2.5-flash'; // Default
        
        if (options.useThinkingMode) {
            modelName = 'gemini-2.5-pro';
        } else if (options.useLowLatency) {
             // If grounding is enabled, we must use a model that supports tools reliably.
             // Flash Lite is faster but Flash is safer for complex tool use like Grounding.
             // We'll stick to Flash if grounding is on.
             if (options.useSearchGrounding || options.useMapsGrounding) {
                 modelName = 'gemini-2.5-flash'; 
             } else {
                 modelName = 'gemini-2.5-flash-lite';
             }
        }

        const contents: Content[] = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }],
        }));

        const userParts: Part[] = [{ text: newMessage }];
        if (imageFile) {
            const imagePart = await fileToGenerativePart(imageFile);
            userParts.push(imagePart);
        }
        contents.push({ role: 'user', parts: userParts });

        const config: any = {
            systemInstruction: systemPrompt,
        };
        
        // Configure Tools
        const tools: any[] = [];
        
        if (options.useSearchGrounding) {
            tools.push({ googleSearch: {} });
        }
        
        if (options.useMapsGrounding) {
            tools.push({ googleMaps: {} });
        }
        
        if (tools.length > 0) {
            config.tools = tools;
        }

        // Configure Retrieval for Maps if needed
        if (options.useMapsGrounding && options.userLocation) {
            config.toolConfig = {
                retrievalConfig: {
                    latLng: {
                        latitude: options.userLocation.latitude,
                        longitude: options.userLocation.longitude
                    }
                }
            };
        }

        // Configure Thinking (Only available on Pro/Flash 2.5)
        if (options.useThinkingMode) {
            // Note: Check model compatibility. Usually 2.5 Pro supports this.
             // Use a standard budget or the max 32k if needed for deep thought
            config.thinkingConfig = { thinkingBudget: 1024 }; 
        } else {
             // Explicitly disable thinking if not requested to avoid unexpected token usage
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        return ai.models.generateContentStream({
            model: modelName,
            contents,
            config,
        });
    } catch (error) {
        console.error("Eburon AI Service Error (Stream):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const generateImageWithGemini = async (
    prompt: string,
    imageFile: File | null
): Promise<string> => {
    try {
        const ai = getAiClient();
        const parts: Part[] = [{ text: prompt }];
        if (imageFile) {
            const imagePart = await fileToGenerativePart(imageFile);
            parts.unshift(imagePart);
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType;
                const base64ImageBytes: string = part.inlineData.data;
                return `data:${mimeType};base64,${base64ImageBytes}`;
            }
        }

        throw new Error("No image data was found in the Eburon.ai response.");

    } catch (error) {
        console.error("Eburon AI Service Error (Image Gen):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
}

export const generateTtsWithGemini = async (text: string, voiceName: string = 'Kore'): Promise<Blob> => {
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from TTS service.");
        }
        const pcmData = decode(base64Audio);
        return pcmToWavBlob(pcmData, { sampleRate: 24000, bitDepth: 16, numChannels: 1 });
    } catch (error) {
        console.error("Eburon AI Service Error (TTS):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
}

export const transcribeAudioWithGemini = async (audioFile: File): Promise<string> => {
    try {
        const ai = getAiClient();
        const audioPart = await fileToGenerativePart(audioFile);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: "Transcribe the following audio:" },
                    audioPart
                ]
            },
        });
        return response.text || "";
    } catch (error) {
        console.error("Eburon AI Service Error (Transcription):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const generateCallSummaryNote = async (transcriptText: string): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `You are a CRM note-taking assistant. 
        Summarize the following customer service call transcript into a concise, professional note for the next agent.
        
        Include:
        1. Customer Name (if known)
        2. Key Issue/Request
        3. Action Taken
        4. Sentiment (Happy, Frustrated, etc.)
        5. Next Steps
        
        Keep it under 100 words.
        
        Transcript:
        ${transcriptText}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }],
        });

        return response.text || "No summary available.";
    } catch (error) {
        console.error("Summary generation failed:", error);
        return "Failed to generate summary note.";
    }
}
