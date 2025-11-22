import * as idbService from './idbService';
import * as supabaseService from './supabaseService';
import * as blandAiService from './blandAiService';
import * as geminiService from './geminiService';
import { Agent, Voice, CallLog, TtsGeneration, ChatMessage, Feedback, AgentFeedback, LiveTranscript, CrmBooking, TranscriptSegment } from '../types';
import { crmService } from './crmService';
import { AYLA_DEFAULT_AGENT } from '../constants';

type DbMode = 'supabase' | 'indexedDB';
let dbMode: DbMode = 'supabase'; // Assume online by default

// --- CSV Parsing Utilities ---
const parseCSV = (csvText: string): { headers: string[], rows: string[][] } => {
    // 1. Re-join multiline records. A new record is assumed to start with a UUID.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const allLines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    
    if (allLines.length < 1) return { headers: [], rows: [] };
    
    const headers = allLines.shift()!.split(',').map(h => h.trim());
    const singleLineRecords: string[] = [];

    if (allLines.length > 0) {
        let recordBuffer = '';
        for(const line of allLines) {
            // A new record starts with a UUID, and is not a continuation line inside a JSON string.
            if (uuidRegex.test(line)) {
                if (recordBuffer) {
                    singleLineRecords.push(recordBuffer);
                }
                recordBuffer = line;
            } else {
                // Join multiline fields with a space. This assumes newlines within fields are not significant for parsing.
                recordBuffer += ' ' + line; 
            }
        }
        if (recordBuffer) {
            singleLineRecords.push(recordBuffer);
        }
    }
    
    // 2. Parse each joined line using the original simple parser
    const rows = singleLineRecords.map(line => {
        const fields = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    field += '"'; // Escaped quote
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                fields.push(field);
                field = '';
            } else {
                field += char;
            }
        }
        fields.push(field);
        return fields;
    });
    
    return { headers, rows };
};

const parseTranscriptString = (transcriptStr: string): TranscriptSegment[] => {
    if (!transcriptStr || typeof transcriptStr !== 'string' || transcriptStr.trim() === '-') return [];

    const stripSsml = (s: string) => s.replace(/<[^>]+>/g, '').trim();

    return transcriptStr.split('|').map((part, index) => {
        const trimmedPart = part.trim();
        let role: 'user' | 'agent' | null = null;
        let text = '';

        if (trimmedPart.toLowerCase().startsWith('user:')) {
            role = 'user';
            text = trimmedPart.substring(5).trim();
        } else if (trimmedPart.toLowerCase().startsWith('assistant:')) {
            role = 'agent';
            text = stripSsml(trimmedPart.substring(10));
        } else if (trimmedPart.toLowerCase().startsWith('agent-action:')) {
            role = null; // Ignore agent actions
        } else if (trimmedPart.length > 0) {
            // This is likely a continuation from an interruption.
            // Based on the data, these can be treated as user speech.
            role = 'user';
            text = trimmedPart;
        }
        
        return {
            user: role,
            text: text,
            start_time: 0 // Will be estimated later
        };
    })
    .filter((segment): segment is Omit<TranscriptSegment, 'start_time'> & { user: 'user' | 'agent', start_time: number } => {
        if (!segment.user || !segment.text) return false;
        if (segment.text.length < 2 && !/[a-zA-Z0-9]/.test(segment.text)) return false;
        return true;
    });
};
// --- End CSV Parsing Utilities ---


export async function initializeDataLayer(): Promise<void> {
  try {
    const { error } = await supabaseService.supabase
      .from('agents')
      .select('id', { count: 'exact', head: true });

    if (error && (error.message.includes('network error') || error.message.includes('Failed to fetch'))) {
      throw new Error('Supabase network error');
    }
    
    console.log('Supabase connection successful. Using online mode.');
    dbMode = 'supabase';
  } catch (e) {
    console.warn('Supabase connection failed. Falling back to IndexedDB for this session.', (e as Error).message);
    dbMode = 'indexedDB';
  }
  
  await idbService.initDB();
}

// --- AGENTS ---
export async function getActiveDialerAgent(): Promise<Agent | null> {
    const agents = await idbService.getAgentsFromIdb();
    return agents.find(a => a.isActiveForDialer) || null;
}

export async function getAgents(): Promise<Agent[]> {
    let agentsFromDb: Agent[];
    if (dbMode === 'supabase') {
        try {
            const agentsFromSupabase = await supabaseService.getAgentsFromSupabase();
            const activeAgent = await getActiveDialerAgent();
            const mergedAgents = agentsFromSupabase.map(agent => ({
                ...agent,
                isActiveForDialer: activeAgent ? agent.id === activeAgent.id : false,
            }));
            idbService.upsertAgentsToIdb(mergedAgents).catch(err => console.error("Failed to cache agents:", err));
            agentsFromDb = mergedAgents;
        } catch (error) {
            console.error("Supabase failed to get agents, falling back to IDB", (error as Error).message);
            dbMode = 'indexedDB';
            agentsFromDb = await idbService.getAgentsFromIdb();
        }
    } else {
        agentsFromDb = await idbService.getAgentsFromIdb();
    }

    const isAnyDbAgentActive = agentsFromDb.some(a => a.isActiveForDialer);
    const defaultAgentWithState = { ...AYLA_DEFAULT_AGENT, isActiveForDialer: !isAnyDbAgentActive };
    
    return [defaultAgentWithState, ...agentsFromDb];
}

export async function setActiveDialerAgent(agentId: string): Promise<void> {
    if (agentId === AYLA_DEFAULT_AGENT.id) {
        await deactivateActiveDialerAgent();
        return;
    }
    const agents = await idbService.getAgentsFromIdb();
    const updatedAgents = agents.map(a => ({ ...a, isActiveForDialer: a.id === agentId }));
    await idbService.upsertAgentsToIdb(updatedAgents);
}

export async function deactivateActiveDialerAgent(): Promise<void> {
    const agents = await idbService.getAgentsFromIdb();
    const updatedAgents = agents.map(a => ({ ...a, isActiveForDialer: false }));
    await idbService.upsertAgentsToIdb(updatedAgents);
}

export async function upsertAgents(agents: Agent[]): Promise<void> {
    await idbService.upsertAgentsToIdb(agents);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertAgentsToSupabase(agents);
        } catch (error) {
            console.error("Supabase failed to upsert agents", (error as Error).message);
        }
    }
}

export async function deleteAgent(agentId: string): Promise<void> {
    if (agentId === AYLA_DEFAULT_AGENT.id) return;
    await idbService.deleteAgentFromIdb(agentId);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.deleteAgentFromSupabase(agentId);
        } catch (error) {
            console.error("Supabase failed to delete agent", (error as Error).message);
        }
    }
}


// --- VOICES ---
export async function getVoices(): Promise<Voice[]> {
    try {
        const freshVoices = await blandAiService.listVoices();
        let customTagsMap = new Map<string, string[]>();
        if (dbMode === 'supabase') {
            try {
                customTagsMap = await supabaseService.getCustomVoiceTags();
            } catch (e) {
                console.warn("Could not fetch custom tags from Supabase.", e);
            }
        }
        
        const mergedVoices = freshVoices.map(voice => ({ ...voice, tags: [...new Set([...(voice.tags || []), ...(customTagsMap.get(voice.uuid) || [])])] }));
        upsertVoices(mergedVoices).catch(err => console.error("Failed to cache voices:", err));
        return mergedVoices;
    } catch (error) {
        console.error("Failed to fetch fresh voices, falling back to IDB", (error as Error).message);
        return idbService.getVoicesFromIdb();
    }
}

export async function upsertVoices(voices: Voice[]): Promise<void> {
    await idbService.upsertVoicesToIdb(voices);
}

export const generateVoiceSample = blandAiService.generateVoiceSample;
export const generateTtsWithGemini = geminiService.generateTtsWithGemini;

export async function updateVoiceTags(voiceUuid: string, newTags: string[]): Promise<void> {
    const freshVoices = await blandAiService.listVoices();
    const targetVoice = freshVoices.find(v => v.uuid === voiceUuid);
    const baseTags = targetVoice?.tags || [];
    const customTags = newTags.filter(tag => !baseTags.includes(tag));
    
    if (dbMode === 'supabase') {
        try {
            await supabaseService.updateCustomVoiceTags(voiceUuid, customTags);
        } catch (error) {
            console.error("Supabase failed to update voice tags", (error as Error).message);
            throw error;
        }
    }
    const voicesFromIdb = await idbService.getVoicesFromIdb();
    const updatedVoices = voicesFromIdb.map(v => v.uuid === voiceUuid ? { ...v, tags: newTags } : v);
    await idbService.upsertVoicesToIdb(updatedVoices);
}


// --- CALL LOGS ---
export async function loadCallLogsFromCSV(): Promise<CallLog[]> {
    const response = await fetch('/data.csv');
    if (!response.ok) throw new Error(`Failed to fetch data.csv: ${response.statusText}`);
    
    const csvText = await response.text();
    const { headers, rows } = parseCSV(csvText);
    
    const requiredHeaders = ['c_id', 'created_at', 'call_length', 'from', 'to', 'recording_url', 'summary', 'transcripts'];
    if (!requiredHeaders.every(h => headers.includes(h))) {
        throw new Error(`CSV is missing required headers. Found: ${headers.join(', ')}`);
    }

    return rows.map(row => {
        const rowData: { [key: string]: string } = {};
        headers.forEach((header, i) => { rowData[header] = row[i] || ''; });

        const transcriptSegments = parseTranscriptString(rowData.transcripts);
        const fullTranscriptText = transcriptSegments.map(segment => `${segment.user}: ${segment.text}`).join('\n');
        const totalDuration = Math.round(parseFloat(rowData.call_length) * 60) || 0;

        if (transcriptSegments.length > 0 && totalDuration > 0) {
            const totalWords = transcriptSegments.reduce((sum, seg) => sum + seg.text.split(/\s+/).filter(Boolean).length, 0);
            const wordsPerSecond = totalWords > 0 ? totalWords / totalDuration : 3; // Fallback to 3 WPS

            let cumulativeTime = 0;
            transcriptSegments.forEach(segment => {
                segment.start_time = cumulativeTime;
                const segmentWords = segment.text.split(/\s+/).filter(Boolean).length;
                const segmentDuration = segmentWords / wordsPerSecond;
                cumulativeTime += segmentDuration;
            });
        }

        return {
            call_id: rowData.c_id,
            created_at: rowData.created_at,
            duration: totalDuration,
            from: rowData.from,
            to: rowData.to,
            recording_url: rowData.recording_url || '',
            summary: rowData.summary && rowData.summary.trim() !== '-' ? rowData.summary : 'No summary available.',
            concatenated_transcript: fullTranscriptText,
            transcript: transcriptSegments,
        };
    }).filter(log => log.call_id);
}


export async function getCallLogs(): Promise<CallLog[]> {
    let logs = await idbService.getCallLogsFromIdb();
    if (logs && logs.length > 0) {
        return logs;
    }
    
    try {
        const csvLogs = await loadCallLogsFromCSV();
        await upsertCallLogs(csvLogs);
        return csvLogs;
    } catch (error) {
        console.error("Failed to load call logs from data.csv", (error as Error).message);
        // If CSV fails, try fetching from API as a final fallback
        try {
            const apiLogs = await blandAiService.fetchCallLogs();
            await upsertCallLogs(apiLogs);
            return apiLogs;
        } catch (apiError) {
             console.error("Failed to fetch logs from API as well.", (apiError as Error).message);
             throw new Error(`Could not load call history: ${(apiError as Error).message}`);
        }
    }
}

export async function upsertCallLogs(logs: CallLog[]): Promise<void> {
    await idbService.upsertCallLogsToIdb(logs);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertCallLogsToSupabase(logs);
        } catch (error) {
            console.error("Supabase failed to upsert call logs", (error as Error).message);
        }
    }
}

export async function clearCallLogs(): Promise<void> {
    await idbService.clearCallLogsFromIdb();
    if (dbMode === 'supabase') {
        try {
            await supabaseService.clearCallLogsFromSupabase();
        } catch (error) {
            console.error("Supabase failed to clear call logs", (error as Error).message);
            throw error;
        }
    }
}

// --- TTS GENERATIONS ---
export async function getTtsGenerations(): Promise<TtsGeneration[]> {
    return idbService.getTtsGenerationsFromIdb();
}

export async function saveTtsGeneration(generationData: {
    input_text: string;
    audio_url: string;
}): Promise<TtsGeneration> {
    const newGeneration: TtsGeneration = {
        ...generationData,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
    };
    await idbService.upsertTtsGenerationsToIdb([newGeneration]);
    return newGeneration;
}

// --- CHATBOT MESSAGES ---
export async function getChatbotMessages(): Promise<ChatMessage[]> {
    return idbService.getChatbotMessagesFromIdb();
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
    await idbService.upsertChatbotMessagesToIdb([message]);
}

export async function clearChatbotMessages(): Promise<void> {
    await idbService.clearChatbotMessagesFromIdb();
}

// --- FEEDBACK ---
export async function submitFeedback(feedbackText: string): Promise<void> {
    const newFeedback: Feedback = {
        id: `feedback-${Date.now()}`,
        created_at: new Date().toISOString(),
        feedback_text: feedbackText,
    };
    await idbService.upsertFeedbackToIdb([newFeedback]);
    if (dbMode === 'supabase') {
        supabaseService.saveFeedbackToSupabase(feedbackText).catch(err => console.error("Failed to sync feedback to Supabase:", err));
    }
}

export async function submitAgentFeedback(
    agentId: string,
    sessionId: string,
    transcript: LiveTranscript[],
    feedbackText: string
): Promise<void> {
    const newFeedback: AgentFeedback = {
        id: `agent-feedback-${sessionId}`,
        created_at: new Date().toISOString(),
        agent_id: agentId,
        session_id: sessionId,
        transcript,
        feedback_text: feedbackText,
    };
    await idbService.upsertAgentFeedbackToIdb([newFeedback]);
    if (dbMode === 'supabase') {
        supabaseService.saveAgentFeedbackToSupabase(newFeedback).catch(err => console.error("Failed to sync agent feedback to Supabase:", err));
    }
}

// --- CRM DATA ---
export async function getCrmBookings(): Promise<CrmBooking[]> {
    return crmService.getBookings();
}

export async function createCrmBooking(booking: CrmBooking): Promise<CrmBooking> {
    return crmService.addBooking(booking);
}

export async function updateCrmBooking(pnr: string, updates: Partial<CrmBooking>): Promise<CrmBooking> {
    return crmService.updateBooking(pnr, updates);
}

export async function deleteCrmBooking(pnr: string): Promise<void> {
    return crmService.deleteBooking(pnr);
}