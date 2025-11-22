# <img src="https://eburon.ai/assets/icon-eburon.png" alt="Eburon Logo" width="40" style="vertical-align: middle;"/> Eburon Voice Studio

> A secure, brand-controlled platform for designing, testing, and managing Customer Service Voice Agents. Build, test, and deploy with a powerful suite of tools and advanced AI.

Eburon Voice Studio is an all-in-one web application designed for the end-to-end creation and management of sophisticated conversational AI agents. It provides a robust suite of tools for prompt engineering, voice cloning, real-time testing, and performance analysis, enabling developers and designers to build human-like voice experiences with precision and control.

---

## ✨ Key Features

- **Agent Management**: Create, configure, and manage voice AI agents with detailed system prompts, voice selection, and tool integrations.
- **Voice Library**: Browse a collection of high-quality, pre-built voices and clone custom voices from audio samples for unique brand identities.
- **TTS Studio**: Generate studio-quality audio directly from text or SSML, with a history of generated samples for easy access.
- **AI Assistant Chatbot**: A powerful, multi-modal assistant for testing prompts and agent logic. Features include web/maps grounding, pro-level "thinking mode," and a developer mode for generating self-contained web applications.
- **Call History & Analysis**: Review detailed logs of past calls, listen to full recordings with synchronized transcripts, and perform AI-driven emotion analysis on conversations.
- **Live Web Demo**: An interactive, real-time IVR and voice agent demonstration environment that simulates a live customer service call.
- **Dialer Simulation**: A realistic iPhone dialer interface for initiating mobile or web-based calls to the configured agents, providing a true-to-life testing experience.
- **Offline-First Architecture**: Utilizes IndexedDB as a robust fallback, ensuring core functionalities remain available even without a stable connection to the backend.

---

## 💻 Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **AI & Voice Services**:
  - **Google Gemini API**: Powers the core LLM for the Chatbot Assistant, TTS generation, and audio transcription.
  - **Vapi AI**: Integrated for the seamless, full-screen web demo voice widget.
  - **Bland AI**: Handles telephony services, call routing, recording, and advanced call analysis features like emotion detection.
- **Backend & Database**:
  - **Supabase**: Provides authentication, real-time database, and file storage for a seamless online experience.
  - **IndexedDB**: Used for comprehensive client-side caching and offline data persistence, ensuring the application remains functional and responsive in all network conditions.

---

## 🚀 Getting Started

The application is configured to run in a web-based environment where API keys are securely managed and injected as environment variables.

- **`process.env.API_KEY`**: This variable must be present in the environment for all Google Gemini API functionalities to work correctly.
- **Bland AI & Supabase Keys**: These are hardcoded in their respective service files for this specific demo environment. In a production scenario, these would also be managed as environment variables.

There is no local build or setup process required to run the application; it is designed to be served directly as a static web application.

---

## 📂 Project Structure

The codebase is organized to maintain a clean separation of concerns:

- **/components**: Contains all React components, organized by feature view (e.g., `AgentsView.tsx`, `ChatbotView.tsx`).
- **/services**: Handles all external API interactions (e.g., `geminiService.ts`, `supabaseService.ts`, `blandAiService.ts`) and data persistence logic (`dataService.ts`, `idbService.ts`).
- **/hooks**: Houses complex custom hooks, such as `useGeminiLive.ts` for managing real-time voice sessions.
- **/contexts**: Provides shared state management across the application (e.g., `AuthContext.tsx`, `CallContext.tsx`).
- **/types.ts**: Defines all shared TypeScript types and interfaces.
- **/constants.ts**: Stores application-wide constants, such as navigation items and core system prompts.

---

## ⚠️ Important Developer Notice on Branding

This is a crucial reminder regarding the branding and user interface guidelines for all front-end development work associated with the Eburon project. As a developer, it is essential that you adhere strictly to the following requirement:

**Use Eburon Branding Exclusively:**  
All front-end UI elements must exclusively feature Eburon branding. This means that every logo, icon, color scheme, and hyperlink visible to the user should be aligned with the Eburon brand identity. Under no circumstances should any other third-party or external brand names, logos, or identifiers appear in the UI. All links should also point to `eburon.ai` or related Eburon-controlled domains to maintain brand consistency.

This enforcement is vital to ensure a unified and professional brand image. The Eburon identity should be clear and consistent across all user-facing interfaces. Please prioritize this as a non-negotiable standard in your development workflow.

By enforcing this rule, we protect the integrity and recognition of the Eburon brand. Thank you for your attention to this detail and for ensuring that all front-end elements reflect this guideline.

---

## 🤝 Contributing

Contributions to the Eburon Voice Studio are managed internally. Please adhere to the established coding standards, branding guidelines, and pull request processes. Ensure all new features and bug fixes are thoroughly tested before submission.

---

## 📜 License

This project is proprietary and licensed under the Eburon.ai commercial license. All rights reserved.
