
import * as idbService from './idbService';
import * as supabaseService from './supabaseService';
import * as blandAiService from './blandAiService';
import * as geminiService from './geminiService';
import { Agent, Voice, CallLog, TtsGeneration, ChatMessage, Feedback, AgentFeedback, LiveTranscript, CrmBooking, TranscriptSegment, AgentTool } from '../types';
import { crmService } from './crmService';
import { STEPHEN_DEFAULT_AGENT } from '../constants';

type DbMode = 'supabase' | 'indexedDB';
let dbMode: DbMode = 'supabase'; 
const FILTER_OUT_NUMBER = '+639056741316';

const parseCSV = (csvText: string): { headers: string[], rows: string[][] } => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const allLines = csvText.trim().replace(/\r\n/g, '\n').split('\n');
    
    if (allLines.length < 1) return { headers: [], rows: [] };
    
    const headers = allLines.shift()!.split(',').map(h => h.trim());
    const singleLineRecords: string[] = [];

    if (allLines.length > 0) {
        let recordBuffer = '';
        for(const line of allLines) {
            if (uuidRegex.test(line)) {
                if (recordBuffer) {
                    singleLineRecords.push(recordBuffer);
                }
                recordBuffer = line;
            } else {
                recordBuffer += ' ' + line; 
            }
        }
        if (recordBuffer) {
            singleLineRecords.push(recordBuffer);
        }
    }
    
    const rows = singleLineRecords.map(line => {
        const fields = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    field += '"';
                    i++;
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
            role = null;
        } else if (trimmedPart.length > 0) {
            role = 'user';
            text = trimmedPart;
        }
        
        return {
            user: role,
            text: text,
            start_time: 0
        };
    })
    .filter((segment): segment is Omit<TranscriptSegment, 'start_time'> & { user: 'user' | 'agent', start_time: number } => {
        if (!segment.user || !segment.text) return false;
        if (segment.text.length < 2 && !/[a-zA-Z0-9]/.test(segment.text)) return false;
        return true;
    });
};


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
  await initializeDefaultTools();
}

async function initializeDefaultTools() {
    const existingTools = await getTools();
    if (existingTools.length === 0) {
        const defaultTools: AgentTool[] = [
            {
                id: 'transfer-call',
                name: 'Transfer Call',
                description: 'Transfers the call to a human agent or another number.',
                method: 'POST',
                url: 'https://api.bland.ai/v1/calls/transfer',
                body: JSON.stringify({
                    phone_number: "+15551234567",
                    task: "Handle customer support"
                })
            },
            {
                id: 'check-availability',
                name: 'Check Availability',
                description: 'Checks calendar availability for booking.',
                method: 'POST',
                url: 'https://api.eburon.ai/tools/calendar/check',
                body: JSON.stringify({
                    date: "YYYY-MM-DD",
                    time: "HH:mm"
                })
            }
        ];
        await upsertTools(defaultTools);
    }
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
    const defaultAgentWithState = { ...STEPHEN_DEFAULT_AGENT, isActiveForDialer: !isAnyDbAgentActive };
    
    return [defaultAgentWithState, ...agentsFromDb];
}

export async function setActiveDialerAgent(agentId: string): Promise<void> {
    if (agentId === STEPHEN_DEFAULT_AGENT.id) {
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
    if (agentId === STEPHEN_DEFAULT_AGENT.id) return;
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

export async function generateVoiceSample(voiceId: string, text: string, language: string): Promise<Blob> {
    return blandAiService.generateVoiceSample(voiceId, text, language);
}

export async function generateTtsWithGemini(text: string, voiceName: string = 'Kore'): Promise<Blob> {
    return geminiService.generateTtsWithGemini(text, voiceName);
}

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
    }).filter(log => log.call_id && log.from !== FILTER_OUT_NUMBER && log.to !== FILTER_OUT_NUMBER);
}


export async function getCallLogs(): Promise<CallLog[]> {
    try {
        const apiLogs = await blandAiService.fetchCallLogs();
        const filteredLogs = apiLogs.filter(log => log.from !== FILTER_OUT_NUMBER && log.to !== FILTER_OUT_NUMBER);
        await upsertCallLogs(filteredLogs);
        return filteredLogs;
    } catch (apiError) {
        console.warn("Failed to fetch logs from Bland AI API, checking cache/CSV...", (apiError as Error).message);
        
        let logs = await idbService.getCallLogsFromIdb();
        if (logs && logs.length > 0) {
            return logs.filter(log => log.from !== FILTER_OUT_NUMBER && log.to !== FILTER_OUT_NUMBER);
        }
        
        try {
            const csvLogs = await loadCallLogsFromCSV();
            await upsertCallLogs(csvLogs);
            return csvLogs;
        } catch (error) {
             console.error("Failed to load call logs from data.csv", (error as Error).message);
             return [];
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
    if (dbMode === 'supabase') {
        try {
             const remoteData = await supabaseService.getTtsGenerationsFromSupabase();
             await idbService.upsertTtsGenerationsToIdb(remoteData); // cache locally
             return remoteData;
        } catch (error) {
            console.error("Failed to fetch TTS generations from Supabase, falling back to IDB", error);
            return idbService.getTtsGenerationsFromIdb();
        }
    }
    return idbService.getTtsGenerationsFromIdb();
}

export async function saveTtsGeneration(input_text: string, audioBlob: Blob): Promise<TtsGeneration> {
    const id = `gen-${Date.now()}`;
    const created_at = new Date().toISOString();
    
    // 1. Optimistically create a local record with a blob URL for immediate UI feedback
    let audio_url = URL.createObjectURL(audioBlob); 
    const localRecord: TtsGeneration = { id, input_text, audio_url, created_at };
    await idbService.upsertTtsGenerationsToIdb([localRecord]);

    // 2. If Online, Upload to Storage and Persist Record
    if (dbMode === 'supabase') {
        try {
            const publicUrl = await supabaseService.uploadTtsAudio(audioBlob);
            
            const remoteRecord: TtsGeneration = {
                id,
                input_text,
                audio_url: publicUrl, // Persistent public URL
                created_at
            };
            
            await supabaseService.saveTtsGeneration(remoteRecord);
            
            // Update local IDB with the persistent remote URL so it survives page reloads
            await idbService.upsertTtsGenerationsToIdb([remoteRecord]);
            
            return remoteRecord;
        } catch (error) {
            console.error("Failed to sync TTS generation to Supabase:", error);
            // Return local record if sync fails, so UI still works temporarily
        }
    }

    return localRecord;
}

// --- CHATBOT MESSAGES ---
export async function getChatbotMessages(): Promise<ChatMessage[]> {
    if (dbMode === 'supabase') {
        try {
            const remoteMessages = await supabaseService.getChatbotMessagesFromSupabase();
            await idbService.upsertChatbotMessagesToIdb(remoteMessages);
            return remoteMessages;
        } catch (error) {
             console.error("Failed to fetch Chat history from Supabase, falling back to IDB", error);
             return idbService.getChatbotMessagesFromIdb();
        }
    }
    return idbService.getChatbotMessagesFromIdb();
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
    await idbService.upsertChatbotMessagesToIdb([message]);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertChatbotMessageToSupabase(message);
        } catch (error) {
            console.error("Failed to sync chat message to Supabase", error);
        }
    }
}

export async function clearChatbotMessages(): Promise<void> {
    await idbService.clearChatbotMessagesFromIdb();
    if (dbMode === 'supabase') {
        try {
            await supabaseService.clearChatbotMessagesFromSupabase();
        } catch (error) {
            console.error("Failed to clear chat history from Supabase", error);
        }
    }
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
    if (dbMode === 'supabase') {
        try {
             // Assuming we sync CRM data to Supabase table `crm_bookings`
             return await supabaseService.getCrmBookingsFromSupabase();
        } catch (error) {
             console.warn("Supabase CRM fetch failed, checking fallback", error);
             // Fallback to crmService's internal/mock data for now if API fails or isn't set up
             return crmService.getBookings();
        }
    }
    return crmService.getBookings();
}

export async function createCrmBooking(booking: CrmBooking): Promise<CrmBooking> {
    const result = crmService.addBooking(booking); // Update local state
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertCrmBookingToSupabase(booking);
        } catch (e) {
            console.error("Failed to sync CRM creation to Supabase", e);
        }
    }
    return result;
}

export async function updateCrmBooking(pnr: string, updates: Partial<CrmBooking>): Promise<CrmBooking> {
    const result = crmService.updateBooking(pnr, updates); // Update local state
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertCrmBookingToSupabase(result);
        } catch (e) {
             console.error("Failed to sync CRM update to Supabase", e);
        }
    }
    return result;
}

export async function deleteCrmBooking(pnr: string): Promise<void> {
    crmService.deleteBooking(pnr); // Update local state
    if (dbMode === 'supabase') {
         try {
            await supabaseService.deleteCrmBookingFromSupabase(pnr);
         } catch (e) {
              console.error("Failed to sync CRM deletion to Supabase", e);
         }
    }
}

// --- TOOLS ---
export async function getTools(): Promise<AgentTool[]> {
    if (dbMode === 'supabase') {
        try {
             const tools = await supabaseService.getToolsFromSupabase();
             await idbService.upsertToolsToIdb(tools);
             return tools;
        } catch (error) {
            console.error("Supabase tools fetch failed, falling back to IDB", error);
            return idbService.getToolsFromIdb();
        }
    }
    return idbService.getToolsFromIdb();
}

export async function saveTool(tool: AgentTool): Promise<void> {
    await idbService.upsertToolsToIdb([tool]);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertToolsToSupabase([tool]);
        } catch (error) {
            console.error("Failed to sync tool to Supabase", error);
        }
    }
}

export async function upsertTools(tools: AgentTool[]): Promise<void> {
    await idbService.upsertToolsToIdb(tools);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.upsertToolsToSupabase(tools);
        } catch (error) {
            console.error("Failed to sync tools to Supabase", error);
        }
    }
}

export async function deleteTool(toolId: string): Promise<void> {
    await idbService.deleteToolFromIdb(toolId);
    if (dbMode === 'supabase') {
        try {
            await supabaseService.deleteToolFromSupabase(toolId);
        } catch (error) {
            console.error("Failed to sync tool deletion to Supabase", error);
        }
    }
}
