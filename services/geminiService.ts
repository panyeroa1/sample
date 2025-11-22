import { GoogleGenAI, GenerateContentResponse, GroundingMetadata, Modality, Content, Part } from "@google/genai";
import { ChatMessage } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
// --- End Audio Helper Functions ---


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
        let modelName = 'gemini-2.5-flash';
        if (options.useThinkingMode) modelName = 'gemini-2.5-pro';
        else if (options.useLowLatency) modelName = 'gemini-2.5-flash-lite';

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
        
        if (options.useThinkingMode) {
            config.thinkingConfig = { thinkingBudget: 32768 };
        } else {
            // Ensure thinking is off for other models
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        const tools: any[] = [];
        if (options.useSearchGrounding) tools.push({ googleSearch: {} });
        if (options.useMapsGrounding) tools.push({ googleMaps: {} });
        if (tools.length > 0) config.tools = tools;

        const toolConfig: any = {};
        if (options.useMapsGrounding && options.userLocation) {
            toolConfig.retrievalConfig = {
                latLng: {
                    latitude: options.userLocation.latitude,
                    longitude: options.userLocation.longitude
                }
            };
        }
        if (Object.keys(toolConfig).length > 0) {
            config.toolConfig = toolConfig;
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
        const parts: Part[] = [{ text: prompt }];
        if (imageFile) {
            const imagePart = await fileToGenerativePart(imageFile);
            parts.unshift(imagePart); // Image comes first for editing
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
        return response.text;
    } catch (error) {
        console.error("Eburon AI Service Error (Transcription):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};