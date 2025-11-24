
import { CallLog, Voice, Agent } from "../types";
import { STEPHEN_PROMPT } from "../constants";
import { getConfig } from "./configService";
// Remove static import to avoid circular dependency
// import * as dataService from './dataService';

const EBURON_ERROR_MESSAGE = "The Phone API service encountered an error. Please try again.";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getHeaders = (withEncryptedKey = true): HeadersInit => {
    const config = getConfig();
    const headers: any = {
        'authorization': config.apiKeys.blandApiKey,
    };
    if (withEncryptedKey && config.apiKeys.blandEncryptedKey) {
        headers['encrypted_key'] = config.apiKeys.blandEncryptedKey;
    }
    return headers;
}

const API_BASE_URL = 'https://api.bland.ai'; 

const apiFetch = async (endpoint: string, options: RequestInit = {}, withEncryptedKey = true) => {
    const defaultHeaders = getHeaders(withEncryptedKey);

    if (options.body) {
        (defaultHeaders as any)['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });

    if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        let errorCode = null;
        try {
            const errorBody = await response.json();
            if (errorBody.errors && Array.isArray(errorBody.errors) && errorBody.errors.length > 0) {
                errorMessage = errorBody.errors[0].message || errorMessage;
                errorCode = errorBody.errors[0].error || null;
            } else if (errorBody.message) {
                errorMessage = errorBody.message;
            } else {
                 errorMessage = JSON.stringify(errorBody);
            }
        } catch (e) {
            // Ignore if body isn't JSON
        }
        const customError: any = new Error(errorMessage);
        customError.code = errorCode;
        throw customError;
    }
    return response;
};

export const fetchCallLogs = async (): Promise<CallLog[]> => {
    try {
        const response = await apiFetch('/v1/calls');
        const data = await response.json();
        return data.calls.map((call: any) => ({
            call_id: call.call_id,
            created_at: call.created_at,
            duration: Math.round(call.call_length * 60),
            from: call.from,
            to: call.to,
            recording_url: call.recording_url || '',
            concatenated_transcript: call.concatenated_transcript || 'Transcript not available in summary.',
            transcript: call.transcript || [],
        }));
    } catch (error) {
        console.error("Bland AI Service Error (fetchCallLogs):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const fetchCallDetails = async (callId: string): Promise<CallLog> => {
    try {
        const response = await apiFetch(`/v1/calls/${callId}`);
        const call = await response.json();
        return {
            call_id: call.call_id,
            created_at: call.created_at,
            duration: Math.round(call.call_length * 60),
            from: call.from,
            to: call.to,
            recording_url: call.recording_url || '',
            concatenated_transcript: call.concatenated_transcript || 'No transcript available.',
            transcript: call.transcript || [],
            summary: call.summary || ''
        };
    } catch (error) {
        console.error("Bland AI Service Error (fetchCallDetails):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const fetchRecording = async (callId: string): Promise<Blob> => {
    const MAX_RETRIES = 7;
    const INITIAL_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await apiFetch(`/v1/recordings/${callId}`);
            const blob = await response.blob();
            if (blob.size > 0) {
                return blob;
            }
            const emptyFileError: any = new Error('Empty recording file received.');
            emptyFileError.code = 'CALL_RECORDING_NOT_FOUND';
            throw emptyFileError;

        } catch (error: any) {
            const isNotFound = error.code === 'CALL_RECORDING_NOT_FOUND';

            if (!isNotFound || attempt === MAX_RETRIES) {
                console.error(`Final error fetching recording for call ${callId} on attempt ${attempt}:`, error);
                throw new Error(`Failed to fetch recording for call ${callId}. It may not be available yet.`);
            }

            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`Recording not found for call ${callId}. Retrying in ${delay}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
            await sleep(delay);
        }
    }
    throw new Error(`Failed to fetch recording for call ${callId} after all retries.`);
};

export const listenToActiveCall = async (callId: string): Promise<{ success: boolean; url?: string; message?: string }> => {
    try {
        const config = getConfig();
        const wsUrl = `wss://api.bland.ai/v1/listen/${callId}?api_key=${config.apiKeys.blandApiKey}`;
        return { success: true, url: wsUrl };
    } catch (error) {
        console.error("Bland AI Service Error (listenToActiveCall):", error);
        return { success: false, message: EBURON_ERROR_MESSAGE };
    }
};

export const listVoices = async (): Promise<Voice[]> => {
    try {
        const response = await apiFetch('/v1/voices', {}, false);
        const data = await response.json();
        const voicesData = data.voices || [];
        return voicesData.map((v: any) => {
            let displayName = v.name || `Voice ${v.id}`;
            const apiIdentifier = v.public ? v.name : v.id;

            if (displayName === 'Brh Callcenter') {
                displayName = 'Eburon Ayla';
            }
            return {
                id: apiIdentifier,
                uuid: v.id,
                name: displayName,
                provider: 'Eburon TTS',
                type: v.public ? 'Prebuilt' : 'Cloned',
                tags: v.tags || [],
            };
        });
    } catch (error) {
        console.error("Bland AI Service Error (listVoices):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const generateVoiceSample = async (voiceId: string, text: string, language: string): Promise<Blob> => {
     try {
        const payload = {
            text: text,
            language: language,
            voice_settings: {},
            model: "base",
        };
        const response = await apiFetch(`/v1/voices/${voiceId}/sample`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }, false);
        
        const audioBlob = await response.blob();

        if (audioBlob.size === 0) {
             throw new Error("API returned an empty audio file. This may indicate an issue with the voice or input text.");
        }
        
        return audioBlob;
    } catch (error) {
        console.error("Bland AI Service Error (generateVoiceSample):", error);
        throw new Error(EBURON_ERROR_MESSAGE);
    }
};

export const placeCall = async (phoneNumber: string, agent: Agent): Promise<{ success: boolean; call_id?: string; message?: string }> => {
    try {
        let tools = [];
        if (agent.tools && agent.tools.length > 0) {
             // Dynamic import to avoid circular dependency
             const dataService = await import('./dataService');
             const allTools = await dataService.getTools();
             
             tools = agent.tools.map(toolId => {
                 const t = allTools.find(at => at.id === toolId);
                 if (!t) return null;
                 
                 return {
                     name: t.name,
                     description: t.description,
                     url: t.url,
                     method: t.method,
                     headers: t.headers ? JSON.parse(t.headers) : {},
                     body: t.body ? JSON.parse(t.body) : {},
                 };
             }).filter(Boolean);
        }

        // Use Stephen's Prompt if it's the default Stephen agent, otherwise use agent's prompt
        const promptToUse = agent.id === 'default-stephen-agent' ? STEPHEN_PROMPT : agent.systemPrompt;
        
        // Override voice if it's the default agent to ensure it uses a male voice on Bland (e.g. 'Josh')
        const voiceToUse = agent.id === 'default-stephen-agent' ? 'Josh' : agent.voice;

        const payload: any = {
            "phone_number": phoneNumber,
            "voice": voiceToUse,
            "wait_for_greeting": false,
            "record": true,
            "answered_by_enabled": true,
            "noise_cancellation": true,
            "interruption_threshold": 750,
            "block_interruptions": false,
            "max_duration": 27.9,
            "model": agent.thinkingMode ? "enhanced" : "base",
            "language": "eng", 
            "task": promptToUse,
            "first_sentence": agent.firstSentence,
            "tools": tools.length > 0 ? tools : undefined,
            "voicemail_action": "hangup",
        };
        
        const response = await apiFetch('/v1/calls', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return { success: true, call_id: data.call_id };
    } catch (error) {
        console.error("Bland AI Service Error (placeCall):", error);
        return { success: false, message: EBURON_ERROR_MESSAGE };
    }
};

export const startStephenCall = async (phoneNumber: string): Promise<{ success: boolean; call_id?: string; message?: string }> => {
    try {
        const payload = {
            phone_number: phoneNumber,
            task: STEPHEN_PROMPT, 
            voice: "Josh", // Use a standard male voice for Bland
            first_sentence: "Hello, good afternoon. ...Is this the Engineer?",
            wait_for_greeting: true,
            record: true,
            answered_by_enabled: true,
            noise_cancellation: true,
            interruption_threshold: 500,
            block_interruptions: false,
            max_duration: 12,
            model: "base",
        };
        
        const response = await apiFetch('/v1/calls', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return { success: true, call_id: data.call_id };
    } catch (error) {
        console.error("Bland AI Service Error (startStephenCall):", error);
        return { success: false, message: EBURON_ERROR_MESSAGE };
    }
};

// --- INBOUND CALL CONFIGURATION ---

export const configureInboundCall = async (phoneNumber: string, agent: Agent): Promise<{ success: boolean; message?: string }> => {
    try {
        let tools = [];
        if (agent.tools && agent.tools.length > 0) {
             // Dynamic import to avoid circular dependency
             const dataService = await import('./dataService');
             const allTools = await dataService.getTools();
             
             tools = agent.tools.map(toolId => {
                 const t = allTools.find(at => at.id === toolId);
                 if (!t) return null;
                 
                 return {
                     name: t.name,
                     description: t.description,
                     url: t.url,
                     method: t.method,
                     headers: t.headers ? JSON.parse(t.headers) : {},
                     body: t.body ? JSON.parse(t.body) : {},
                 };
             }).filter(Boolean);
        }

        // Use Stephen's Prompt if it's the default Stephen agent
        const promptToUse = agent.id === 'default-stephen-agent' ? STEPHEN_PROMPT : agent.systemPrompt;
        const voiceToUse = agent.id === 'default-stephen-agent' ? 'Josh' : agent.voice;

        const payload = {
            "phone_number": phoneNumber, // The Twilio/Bland number to configure
            "voice": voiceToUse,
            "task": promptToUse,
            "first_sentence": agent.firstSentence,
            "record": true,
            "model": agent.thinkingMode ? "enhanced" : "base",
            "tools": tools.length > 0 ? tools : undefined,
            "wait_for_greeting": true,
            "interruption_threshold": 100,
            "max_duration": 30
        };

        const response = await apiFetch(`/v1/inbound/${phoneNumber}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if(data.status === 'success') {
             return { success: true, message: "Inbound agent deployed successfully." };
        } else {
             return { success: false, message: "Failed to update inbound settings." };
        }

    } catch (error) {
        console.error("Bland AI Service Error (configureInboundCall):", error);
        return { success: false, message: EBURON_ERROR_MESSAGE };
    }
};
