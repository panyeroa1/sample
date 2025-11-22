import React from 'react';
import { Session } from '@supabase/supabase-js';

// FIX: The global JSX declaration for 'vapi-widget' was overriding all default HTML and SVG element types from React, causing widespread TypeScript errors.
// Since 'vapi-widget' is not used in the provided components, this declaration has been removed to restore the standard JSX types.
/*
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vapi-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        'public-key'?: string;
        'assistant-id'?: string;
        mode?: string;
        theme?: string;
        'base-bg-color'?: string;
        'accent-color'?: string;
        'cta-button-color'?: string;
        'cta-button-text-color'?: string;
        'border-radius'?: string;
        size?: string;
        position?: string;
        title?: string;
        'start-button-text'?: string;
        'end-button-text'?: string;
        'chat-first-message'?: string;
        'chat-placeholder'?: string;
        'voice-show-transcript'?: string;
        'consent-required'?: string;
        'consent-title'?: string;
        'consent-content'?: string;
        'consent-storage-key'?: string;
      }, HTMLElement>;
    }
  }
}
*/

export enum ActiveView {
  History = 'History',
  Agents = 'Agents',
  CRM = 'CRM',
  DataImport = 'DataImport',
  Voices = 'Voices',
  TTSStudio = 'TTSStudio',
  Chatbot = 'Chatbot',
  WebDemo = 'WebDemo',
}

export type AuthSession = Session | null;

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

export interface Agent {
  id: string;
  name: string;
  description: string;
  voice: string;
  systemPrompt: string;
  firstSentence: string;
  thinkingMode: boolean;
  avatarUrl: string | null;
  tools?: any[];
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