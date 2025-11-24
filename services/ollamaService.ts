
import { OLLAMA_CONFIG } from '../constants';
import { ChatMessage, OllamaSettings, OllamaModel } from '../types';

const cleanUrl = (url: string) => {
    let cleaned = url.trim();
    // Remove all trailing slashes
    cleaned = cleaned.replace(/\/+$/, '');
    // Remove trailing /api
    if (cleaned.endsWith('/api')) {
        cleaned = cleaned.slice(0, -4);
    }
    // Remove trailing /v1 (common if copying OpenAI-compatible endpoint)
    if (cleaned.endsWith('/v1')) {
        cleaned = cleaned.slice(0, -3);
    }
    // Remove trailing slashes again just in case
    cleaned = cleaned.replace(/\/+$/, '');
    
    // Add protocol if missing
    if (!/^https?:\/\//i.test(cleaned)) {
        // Default to https for ollama.com, http for others (like localhost)
        if (cleaned.includes('ollama.com')) {
            cleaned = `https://${cleaned}`;
        } else {
            cleaned = `http://${cleaned}`;
        }
    }
    return cleaned;
};

/**
 * Checks if the Ollama service is reachable.
 * Requires Ollama to be running locally (typically on port 11434) or a valid cloud endpoint.
 * Ensure CORS is configured if accessing from a browser (OLLAMA_ORIGINS="*").
 * 
 * @param settings Optional settings to override defaults.
 */
export const checkOllamaConnection = async (settings?: OllamaSettings): Promise<boolean> => {
  const baseUrl = cleanUrl(settings?.baseUrl || OLLAMA_CONFIG.baseUrl);
  const headers: HeadersInit = {};
  
  if (settings?.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  try {
    // /api/tags is a standard Ollama endpoint to list models.
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      headers: headers
    });
    return response.ok;
  } catch (error) {
    console.warn(`Ollama connection failed for ${baseUrl}:`, error);
    return false;
  }
};

/**
 * Fetches the list of available models from the Ollama instance.
 * @param settings Optional configuration for the connection
 */
export const fetchOllamaModels = async (settings?: OllamaSettings): Promise<OllamaModel[]> => {
    const baseUrl = cleanUrl(settings?.baseUrl || OLLAMA_CONFIG.baseUrl);
    const headers: HeadersInit = {};

    if (settings?.apiKey) {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
    }

    try {
        const response = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Ollama Server Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error("Error fetching Ollama models:", error);
        throw error; // Re-throw to allow UI to handle specific error messages
    }
};

/**
 * Streams a chat completion from the Ollama instance.
 * @param history Full chat history including the latest user message
 * @param systemPrompt The system instruction for the model
 * @param model The model name (defaults to gemma)
 * @param settings Optional configuration for the connection
 */
export const sendMessageStreamToOllama = async function* (
  history: ChatMessage[],
  systemPrompt: string,
  model: string = OLLAMA_CONFIG.defaultModel,
  settings?: OllamaSettings
): AsyncIterable<string> {
  
  const baseUrl = cleanUrl(settings?.baseUrl || OLLAMA_CONFIG.baseUrl);
  const headers: HeadersInit = {
      'Content-Type': 'application/json',
  };

  if (settings?.apiKey) {
      headers['Authorization'] = `Bearer ${settings.apiKey}`;
  }

  // Convert internal ChatMessage format to Ollama's API format
  const messages = history.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.text,
    images: msg.image ? [msg.image.split(',')[1]] : undefined // Ollama expects base64 without prefix
  }));

  // Prepend system prompt
  if (systemPrompt) {
    messages.unshift({
      role: 'system',
      content: systemPrompt,
      images: undefined
    });
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: settings?.model || model, // Use setting model if provided
      messages: messages,
      stream: true, // Enable streaming
    }),
  });

  if (!response.ok) {
    let errorText = '';
    try {
        errorText = await response.text();
    } catch (e) {
        errorText = 'Unknown error';
    }
    throw new Error(`Ollama API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Ollama response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Split by newlines to handle multiple JSON objects in one chunk
      const lines = buffer.split('\n');
      
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.error) {
            throw new Error(json.error);
          }
          if (json.message && json.message.content) {
            yield json.message.content;
          }
          if (json.done) {
            return;
          }
        } catch (e) {
          console.error('Error parsing Ollama JSON chunk:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};
