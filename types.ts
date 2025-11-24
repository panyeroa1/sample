
import React from 'react';
import { Session } from '@supabase/supabase-js';

export enum ActiveView {
  History = 'History',
  Agents = 'Agents',
  CRM = 'CRM',
  DataImport = 'DataImport',
  Voices = 'Voices',
  TTSStudio = 'TTSStudio',
  Chatbot = 'Chatbot',
  WebDemo = 'WebDemo',
  AdminSettings = 'AdminSettings', // New Admin View
}

export type AuthSession = Session | null;

export type AiProvider = 'gemini' | 'ollama';

export interface AppConfig {
  modules: {
    showAgents: boolean;
    showCRM: boolean;
    showDataImport: boolean;
    showVoices: boolean;
    showTTS: boolean;
    showChatbot: boolean;
    showHistory: boolean;
    showWebDemo: boolean;
  };
  apiKeys: {
    geminiApiKey: string;
    blandApiKey: string;
    blandEncryptedKey: string;
    supabaseUrl: string;
    supabaseKey: string;
    vapiPublicKey: string;
    deepgramApiKey: string;
  };
  services: {
    ollamaBaseUrl: string;
    ollamaModel: string;
    ollamaType: 'local' | 'cloud';
    ollamaApiKey: string;
  };
  chatbot: {
    enableSearch: boolean;
    enableThinking: boolean;
    enableMaps: boolean;
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  useCases: string[];
  systemPrompt: string;
  firstSentence: string;
  recommendedVoice: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets: any[];
    };
  };
}

export interface TelemetryData {
  tokensUsed?: number;
  energy?: string;
  wps?: number;
  model?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // for local preview
  imageUrl?: string; // for remote storage
  groundingChunks?: GroundingChunk[];
  telemetry?: TelemetryData;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST';
  url: string;
  headers?: string; // JSON string
  body?: string; // JSON string (schema)
  timeout?: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  voice: string;
  systemPrompt: string;
  firstSentence: string;
  thinkingMode: boolean;
  avatarUrl: string | null;
  tools?: string[]; // Array of Tool IDs
  isActiveForDialer?: boolean;
}

export interface Voice {
  id: string; // API identifier (name for public, UUID for cloned)
  uuid: string; // Stable, unique identifier (always UUID)
  name: string;
  provider: string;
  type: 'Prebuilt' | 'Cloned';
  tags: string[];
}

export interface TranscriptSegment {
  user: 'agent' | 'user';
  text: string;
  start_time: number;
}

export interface CallLog {
  call_id: string;
  created_at: string;
  duration: number;
  from: string;
  to: string;
  recording_url: string;
  summary?: string;
  concatenated_transcript: string;
  transcript: TranscriptSegment[];
}

export interface TtsGeneration {
  id:string;
  created_at: string;
  input_text: string;
  audio_url: string;
}

export interface Feedback {
  id: string;
  created_at: string;
  feedback_text: string;
}

export interface LiveTranscript {
    id: number;
    role: 'user' | 'model';
    text: string;
    isFinal: boolean;
}

export interface AgentFeedback {
  id: string;
  created_at: string;
  agent_id: string;
  session_id: string;
  transcript: LiveTranscript[];
  feedback_text: string;
}

export interface CrmBooking {
  pnr: string;
  passenger_name: string;
  email: string;
  phone_number: string;
  flight_number: string;
  origin: string;
  destination: string;
  flight_date: string;
  status: 'confirmed' | 'checked_in' | 'completed' | 'canceled' | 'pending';
  notes?: { text: string; by: string; date: string; }[];
}

export interface ToolCallData {
    id: string;
    name: string;
    args: any;
    timestamp: number;
}

export interface OllamaSettings {
    type: 'local' | 'cloud';
    baseUrl: string;
    apiKey?: string;
    model: string;
}

export interface OllamaModel {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
        parent_model: string;
        format: string;
        family: string;
        families: string[];
        parameter_size: string;
        quantization_level: string;
    }
}

export interface SystemPromptTemplate {
  id: string;
  title: string;
  description: string;
  category: 'Customer Service' | 'Sales' | 'Technical' | 'Creative' | 'Other' | 'Airline/Travel';
  content: string;
}

export interface InboundConfiguration {
    phone_number: string;
    agent_id: string;
    last_updated: string;
}