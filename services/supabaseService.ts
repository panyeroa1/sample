
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Agent, Voice, CallLog, TtsGeneration, ChatMessage, AgentFeedback, CrmBooking, AgentTool } from '../types';
import { getConfig } from './configService';

let supabaseInstance: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const config = getConfig();
  // Fallback to defaults if config is empty (should ideally come from config service defaults)
  const url = config.apiKeys.supabaseUrl;
  const key = config.apiKeys.supabaseKey;

  if (!url || !key) {
      console.warn("Supabase credentials missing in config. Using hardcoded fallbacks for demo.");
      supabaseInstance = createClient(
          'https://xibssyjivjzcjmleupsb.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpYnNzeWppdmp6Y2ptbGV1cHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTMzNjAsImV4cCI6MjA3ODM4OTM2MH0.2HEI12clyZRZ3gM0sUvGq5nFLkGUKKhcfPKyFUMDk34'
      );
  } else {
      supabaseInstance = createClient(url, key);
  }
  
  return supabaseInstance;
};

// Export a proxy to always use the current instance or create one
export const supabase = new Proxy({} as SupabaseClient, {
    get: (_target, prop) => {
        const client = getSupabase();
        return (client as any)[prop];
    }
});


// Force recreation of client if config changes
window.addEventListener('eburon-config-changed', () => {
    supabaseInstance = null;
});

// === AGENTS ===
export const getAgentsFromSupabase = async (): Promise<Agent[]> => {
    const { data, error } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    // Map snake_case from DB to camelCase in application
    return data.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description || '', 
        voice: agent.voice,
        systemPrompt: agent.system_prompt,
        firstSentence: agent.first_sentence || '',
        thinkingMode: agent.thinking_mode,
        avatarUrl: agent.avatar_url || null,
        tools: agent.tools || [],
        isActiveForDialer: agent.is_active_for_dialer || false,
    }));
};

export const upsertAgentsToSupabase = async (agents: Agent[]): Promise<Agent[]> => {
    const payloads = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        voice: agent.voice,
        system_prompt: agent.systemPrompt,
        first_sentence: agent.firstSentence,
        thinking_mode: agent.thinkingMode,
        avatar_url: agent.avatarUrl,
        tools: agent.tools || [],
        is_active_for_dialer: agent.isActiveForDialer
    }));

    const { data, error } = await supabase.from('agents').upsert(payloads).select();

    if (error) {
        console.error("Supabase failed to upsert agents:", error);
        throw error;
    }

    return data.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description || '',
        voice: agent.voice,
        systemPrompt: agent.system_prompt,
        firstSentence: agent.first_sentence || '',
        thinkingMode: agent.thinking_mode,
        avatarUrl: agent.avatar_url || null,
        tools: agent.tools || [],
        isActiveForDialer: agent.is_active_for_dialer || false,
    }));
};


export const updateAgentInSupabase = async (agent: Agent) => {
    // Map camelCase properties to snake_case for Supabase.
    const { id, description, systemPrompt, firstSentence, thinkingMode, avatarUrl, isActiveForDialer, ...rest } = agent;
    const updatePayload = {
        ...rest, // includes name, voice, tools
        description,
        system_prompt: systemPrompt,
        first_sentence: firstSentence,
        thinking_mode: thinkingMode,
        avatar_url: avatarUrl,
        is_active_for_dialer: isActiveForDialer
    };
    
    const { error } = await supabase.from('agents').update(updatePayload).eq('id', agent.id);
    if (error) throw error;
};

export const deleteAgentFromSupabase = async (agentId: string) => {
    const { error } = await supabase.from('agents').delete().eq('id', agentId);
    if (error) throw error;
};

// === VOICES ===
export const saveEmotionTagForVoice = async (voiceId: string, emotionTag: string): Promise<void> => {
    // Fetch existing tags first
    const { data: existingData, error: selectError } = await supabase
        .from('voices_tags_backup')
        .select('tags')
        .eq('id', voiceId)
        .single();

    // PGRST116 = 'single row not found', which is a normal case for the first tag.
    if (selectError && selectError.code !== 'PGRST116') {
        console.error("Supabase failed to select existing tags:", selectError);
        throw selectError;
    }

    const existingTags = existingData?.tags ? existingData.tags.split(', ') : [];
    if (!existingTags.includes(emotionTag)) {
        existingTags.push(emotionTag);
    }
    
    const newTags = existingTags.join(', ');

    const { error: upsertError } = await supabase
        .from('voices_tags_backup')
        .upsert({ id: voiceId, tags: newTags });

    if (upsertError) {
        console.error("Supabase failed to save emotion tag:", upsertError);
        throw upsertError;
    }
};

export const getCustomVoiceTags = async (): Promise<Map<string, string[]>> => {
    const { data, error } = await supabase.from('voices_tags_backup').select('id, tags');
    if (error) {
        throw error;
    }
    const tagMap = new Map<string, string[]>();
    data.forEach((item: any) => {
        if (item.id && item.tags) {
            tagMap.set(item.id, item.tags.split(',').map((t: string) => t.trim()).filter(Boolean));
        }
    });
    return tagMap;
};

export const updateCustomVoiceTags = async (voiceId: string, tags: string[]): Promise<void> => {
    const tagsString = tags.join(', ');
    const { error } = await supabase.from('voices_tags_backup').upsert({ id: voiceId, tags: tagsString }, { onConflict: 'id' });
    if (error) {
        console.error("Supabase failed to update custom voice tags:", error);
        throw error;
    }
};


// === CALL LOGS ===
export const getCallLogsFromSupabase = async (): Promise<CallLog[]> => {
    const { data, error } = await supabase.from('call_logs').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export const upsertCallLogsToSupabase = async (logs: CallLog[]) => {
    const sanitizedLogs = logs.map(log => ({
        call_id: log.call_id,
        created_at: log.created_at,
        duration: log.duration,
        from: log.from,
        to: log.to,
        recording_url: log.recording_url,
        concatenated_transcript: log.concatenated_transcript,
        transcript: log.transcript,
    }));
    const { error } = await supabase.from('call_logs').upsert(sanitizedLogs);
    if (error) throw error;
}

export const clearCallLogsFromSupabase = async (): Promise<void> => {
    const { error } = await supabase.from('call_logs').delete().neq('call_id', 'dummy-id-to-delete-all');
    if (error) throw error;
}

// === FILE STORAGE ===
const FILE_BUCKET = 'eburon-files';

// Helper to determine file extension from MIME type
const getExtensionFromMimeType = (mimeType: string) => {
    if (!mimeType) return 'wav'; // Default extension
    if (mimeType.includes('mpeg')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('png')) return 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
    return mimeType.split('/')[1] || 'bin';
};


export const uploadAgentAvatar = async (
  agentId: string,
  imageFile: File
): Promise<string> => {
  const fileExtension = imageFile.name.split('.').pop() || 'png';
  const fileName = `agent-avatars/${agentId}/avatar.${fileExtension}`;

  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(fileName, imageFile, {
      cacheControl: '3600',
      upsert: true, // Replace if exists
    });

  if (error) throw new Error(`Avatar upload failed: ${error.message}`);

  const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(fileName);
  return `${data.publicUrl}?t=${new Date().getTime()}`; // Add timestamp to break cache
};


export const uploadAudioSample = async (
  voiceName: string,
  audioBlob: Blob
): Promise<string> => {
  const extension = getExtensionFromMimeType(audioBlob.type);
  const fileName = `voice-previews/${voiceName.toLowerCase().replace(/ /g, '_')}_${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(fileName, audioBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

// === TTS STUDIO ===
const TTS_AUDIO_FOLDER = 'tts-generations';

export const uploadTtsAudio = async (
  audioBlob: Blob
): Promise<string> => {
  const extension = getExtensionFromMimeType(audioBlob.type);
  const fileName = `${TTS_AUDIO_FOLDER}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(fileName, audioBlob, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(`TTS audio upload failed: ${error.message}`);

  const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

export const saveTtsGeneration = async (generation: TtsGeneration): Promise<void> => {
    const { error } = await supabase.from('tts_generations').insert([generation]);
    if (error) throw error;
};

export const getTtsGenerationsFromSupabase = async (): Promise<TtsGeneration[]> => {
    const { data, error } = await supabase.from('tts_generations').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

// === CHATBOT ===
const CHAT_IMAGES_FOLDER = 'chat-images';

export const uploadChatImage = async (imageFile: File): Promise<string> => {
    const fileExtension = imageFile.name.split('.').pop() || 'png';
    const fileName = `${CHAT_IMAGES_FOLDER}/${Date.now()}.${fileExtension}`;
    
    const { error } = await supabase.storage
        .from(FILE_BUCKET)
        .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) throw new Error(`Chat image upload failed: ${error.message}`);
    
    const { data } = supabase.storage.from(FILE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
};

export const getChatbotMessagesFromSupabase = async (): Promise<ChatMessage[]> => {
    const { data, error } = await supabase.from('chatbot_messages').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        text: msg.text,
        imageUrl: msg.image_url,
        groundingChunks: msg.grounding_chunks,
        telemetry: msg.telemetry
    }));
};

export const upsertChatbotMessageToSupabase = async (message: ChatMessage) => {
    const { error } = await supabase.from('chatbot_messages').upsert({
        id: message.id,
        role: message.role,
        text: message.text,
        image_url: message.imageUrl,
        grounding_chunks: message.groundingChunks,
        telemetry: message.telemetry
    });
    if (error) throw error;
};

export const clearChatbotMessagesFromSupabase = async (): Promise<void> => {
    const { error } = await supabase.from('chatbot_messages').delete().neq('role', 'system');
    if (error) throw error;
};

// === TOOLS ===
export const getToolsFromSupabase = async (): Promise<AgentTool[]> => {
    const { data, error } = await supabase.from('tools').select('*');
    if (error) throw error;
    return data;
};

export const upsertToolsToSupabase = async (tools: AgentTool[]): Promise<void> => {
    const { error } = await supabase.from('tools').upsert(tools);
    if (error) throw error;
};

export const deleteToolFromSupabase = async (toolId: string): Promise<void> => {
    const { error } = await supabase.from('tools').delete().eq('id', toolId);
    if (error) throw error;
};

// === CRM ===
export const getCrmBookingsFromSupabase = async (): Promise<CrmBooking[]> => {
    const { data, error } = await supabase.from('crm_bookings').select('*');
    if (error) throw error;
    return data;
};

export const upsertCrmBookingToSupabase = async (booking: CrmBooking): Promise<void> => {
    const { error } = await supabase.from('crm_bookings').upsert(booking);
    if (error) throw error;
};

export const deleteCrmBookingFromSupabase = async (pnr: string): Promise<void> => {
    const { error } = await supabase.from('crm_bookings').delete().eq('pnr', pnr);
    if (error) throw error;
};

// === MEMORY & RECALL ===
export interface AgentMemory {
    id: string;
    phone_number: string;
    note: string;
    created_at: string;
    session_id?: string;
}

export const getAgentMemoryFromSupabase = async (phoneNumber: string): Promise<AgentMemory[]> => {
    const { data, error } = await supabase
        .from('agent_memory')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: true });
    
    if (error) {
        // This likely means table doesn't exist yet. Return empty without throwing.
        console.warn("Could not fetch memory (Table might not exist):", error.message);
        return []; 
    }
    return data;
};

export const saveAgentMemoryToSupabase = async (phoneNumber: string, note: string, sessionId: string): Promise<void> => {
    const { error } = await supabase.from('agent_memory').insert({
        phone_number: phoneNumber,
        note: note,
        session_id: sessionId
    });
    if (error) {
        console.error("Failed to save agent memory:", error.message);
    }
};


// === FEEDBACK ===
export const saveFeedbackToSupabase = async (feedbackText: string): Promise<void> => {
    const { error } = await supabase.from('feedback').insert([{ feedback_text: feedbackText }]);
    if (error) throw error;
};

export const saveAgentFeedbackToSupabase = async (feedback: Omit<AgentFeedback, 'id' | 'created_at'>): Promise<void> => {
    const { error } = await supabase.from('agent_feedback').insert([
        {
            agent_id: feedback.agent_id,
            session_id: feedback.session_id,
            transcript: feedback.transcript, 
            feedback_text: feedback.feedback_text,
        }
    ]);
    if (error) throw error;
};

// === IMPORT / EXPORT UTILITIES ===
const formatValueForCSV = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        // Escape double quotes for CSV format
        return JSON.stringify(val).replace(/"/g, '""');
    }
    return String(val).replace(/"/g, '""');
};

export const exportTableToCSV = async (tableName: string): Promise<string> => {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) throw error;
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map((row: any) => 
            headers.map(fieldName => `"${formatValueForCSV(row[fieldName])}"`).join(',')
        )
    ];

    return csvRows.join('\n');
};

const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    return lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        
        return headers.reduce((obj: any, header, index) => {
            let val = values[index] ? values[index].replace(/^"|"$/g, '') : '';
            val = val.replace(/""/g, '"');
            
            if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
                try {
                    obj[header] = JSON.parse(val);
                } catch {
                    obj[header] = val;
                }
            } else {
                obj[header] = val;
            }
            return obj;
        }, {});
    });
};

export const importCSVToTable = async (tableName: string, csvText: string) => {
    const data = parseCSV(csvText);
    if (data.length === 0) throw new Error("No data found in CSV");

    const { error, count } = await supabase.from(tableName).upsert(data, { count: 'exact' });
    
    if (error) throw error;
    return { success: true, count };
};
