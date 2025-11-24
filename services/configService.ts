
import { AppConfig } from '../types';
import { OLLAMA_CONFIG } from '../constants';

const STORAGE_KEY = 'eburon_app_config';

// Default configuration
const defaultConfig: AppConfig = {
  modules: {
    showAgents: true,
    showCRM: true,
    showDataImport: true,
    showVoices: true,
    showTTS: true,
    showChatbot: true,
    showHistory: true,
    showWebDemo: true,
  },
  apiKeys: {
    geminiApiKey: process.env.API_KEY || '',
    blandApiKey: 'org_cf03de3e723e5273a0d07f88e9169e91440e313915f1cdd6f6fcf45214f04506b22905a38af3a6169f4969', // Default from code
    blandEncryptedKey: '9b0318c3-8cdc-4db8-b2d4-c802fd72216f', // Default from code
    supabaseUrl: 'https://xibssyjivjzcjmleupsb.supabase.co', // Default from code
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpYnNzeWppdmp6Y2ptbGV1cHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTMzNjAsImV4cCI6MjA3ODM4OTM2MH0.2HEI12clyZRZ3gM0sUvGq5nFLkGUKKhcfPKyFUMDk34', // Default from code
    vapiPublicKey: '',
    deepgramApiKey: '', // User must provide
  },
  services: {
    ollamaBaseUrl: OLLAMA_CONFIG.baseUrl,
    ollamaModel: OLLAMA_CONFIG.defaultModel,
    ollamaType: 'local',
    ollamaApiKey: '',
  },
  chatbot: {
    enableSearch: true,
    enableThinking: true,
    enableMaps: true,
  }
};

export const getConfig = (): AppConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with default to ensure new keys are present
      return {
        modules: { ...defaultConfig.modules, ...parsed.modules },
        apiKeys: { ...defaultConfig.apiKeys, ...parsed.apiKeys },
        services: { ...defaultConfig.services, ...parsed.services },
        chatbot: { ...defaultConfig.chatbot, ...parsed.chatbot },
      };
    }
  } catch (e) {
    console.error("Failed to load config", e);
  }
  return defaultConfig;
};

export const saveConfig = (config: AppConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    // Dispatch a custom event so components can react if needed immediately
    window.dispatchEvent(new Event('eburon-config-changed'));
  } catch (e) {
    console.error("Failed to save config", e);
  }
};

export const resetConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('eburon-config-changed'));
};
