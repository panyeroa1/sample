
// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Import service
import { listVoices } from '../services/blandAiService';

async function testConnection() {
  console.log("Testing Bland.ai connection...");
  try {
    const voices = await listVoices();
    console.log("Successfully fetched voices:", voices.length);
    console.log("Connection OK.");
  } catch (error: any) {
    console.error("Connection Failed:", error.message);
    if (error.cause) {
        console.error("Cause:", error.cause);
    }
  }
}

testConnection();
