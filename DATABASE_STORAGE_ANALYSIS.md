# Database and Storage Integration Analysis

## Executive Summary

This document identifies database and storage integrations that are not properly implemented or are missing from the Eburon Voice Studio application. The application uses a hybrid approach with Supabase (PostgreSQL) for persistence, IndexedDB for offline caching, and various in-memory stores.

---

## Critical Issues Found

### 1. **CRM Service - No Database Persistence**

**Location:** `services/crmService.ts`

**Issue:** The CRM service uses entirely in-memory storage with mock data. No database persistence exists.

**Current State:**
- Data stored in: In-memory JavaScript array
- Data lost on: Page refresh/app restart
- Persistence: None

**Missing Integration:**
- No Supabase table for `crm_bookings`
- No IndexedDB caching
- No sync mechanism with backend

**Recommendation:**
```typescript
// Required Supabase Table Schema
CREATE TABLE crm_bookings (
  pnr VARCHAR(50) PRIMARY KEY,
  passenger_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(50),
  flight_number VARCHAR(50),
  origin VARCHAR(255),
  destination VARCHAR(255),
  flight_date TIMESTAMPTZ,
  status VARCHAR(50),
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Required Implementation:**
- Add Supabase CRUD operations in `services/supabaseService.ts`
- Add IndexedDB store in `services/idbService.ts`
- Update `services/dataService.ts` to route CRM operations through data layer

---

### 2. **Missing Supabase Tables**

**Location:** Database schema files appear corrupted

**Issue:** Both `schema.sql` and `database.sql` files contain corrupted/binary data and cannot be read.

**Files Affected:**
- `schema.sql` - Unreadable binary content
- `database.sql` - Unreadable binary content

**Impact:**
- Cannot verify existing table structures
- Cannot set up database from schema files
- Potential deployment issues

**Recommendation:**
- Regenerate schema files from Supabase
- Export current database schema using: `supabase db dump`
- Commit readable SQL schema files to repository

---

### 3. **Missing Database Columns**

**Location:** `services/supabaseService.ts`

**Issues Identified:**

#### 3.1 Agents Table - Missing Columns
```typescript
// Missing from database schema:
- description (String)
- avatar_url (String, nullable)
- is_active_for_dialer (Boolean)
```

**Current Workaround:**
- `description`: Falls back to empty string
- `avatarUrl`: Always returns null
- `isActiveForDialer`: Managed only in IndexedDB

**Impact:**
- Agent descriptions not persisted
- Avatar URLs not stored in database
- Active dialer state not synchronized across sessions

#### 3.2 Call Logs Table - Missing Column
```typescript
// Missing from database schema:
- summary (Text)
```

**Current Workaround:**
- Summary field stripped before upserting to Supabase
- Summary data only available from CSV import or IndexedDB

**Impact:**
- Call summaries not persisted to database
- Data loss when clearing IndexedDB cache

---

### 4. **Voices Table - Completely Missing**

**Location:** `services/supabaseService.ts`

**Issue:** The `voices` table does not exist in Supabase.

**Current State:**
- Voices fetched from Bland AI API
- Only custom tags stored in `voices_tags_backup` table
- No caching of voice data in Supabase

**Note from Code:**
```typescript
// FIX: The 'public.voices' table does not exist in Supabase.
// The functions getVoicesFromSupabase and upsertVoicesToSupabase 
// have been removed to prevent errors.
```

**Recommendation:**
```sql
CREATE TABLE voices (
  id VARCHAR(255) PRIMARY KEY,
  uuid VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(100),
  type VARCHAR(50), -- 'Prebuilt' or 'Cloned'
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 5. **Environment Variables Not Properly Configured**

**Location:** `services/supabaseService.ts`, `services/blandAiService.ts`

**Issue:** API keys are hardcoded instead of using environment variables.

**Current State:**
```typescript
// Hardcoded credentials:
const SUPABASE_URL = 'https://xibssyjivjzcjmleupsb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Security Risk:** HIGH - Credentials exposed in source code

**Recommendation:**
```typescript
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Supabase credentials not configured');
}
```

**Required `.env.local`:**
```env
VITE_SUPABASE_URL=https://xibssyjivjzcjmleupsb.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_BLAND_AI_API_KEY=your_bland_ai_key_here
GEMINI_API_KEY=your_gemini_key_here
```

---

### 6. **Incomplete Supabase Storage Integration**

**Location:** `services/supabaseService.ts`

**Issue:** Storage bucket implementation exists but is underutilized.

**Current Implementation:**
- ✅ Agent avatars upload function exists
- ✅ Voice sample upload function exists
- ✅ TTS audio upload function exists
- ✅ Chat image upload function exists

**Missing Integration:**
- Agent avatars not displayed (always null)
- No cleanup of old files
- No validation of file types/sizes
- No error handling for storage quota

**Recommendation:**
- Update `AgentsView.tsx` to use avatar upload
- Implement file cleanup on deletion
- Add storage quota monitoring
- Implement file type validation

---

### 7. **IndexedDB Stores Without Supabase Tables**

**Location:** `services/idbService.ts`

**Issue:** Some IndexedDB stores don't have corresponding Supabase tables.

**Stores with Incomplete Sync:**
- `feedback` - Has IDB and Supabase ✅
- `agent_feedback` - Has IDB and Supabase ✅
- `tts_generations` - Has IDB and Supabase ✅
- `chatbot_messages` - Has IDB and Supabase ✅
- `voices` - Has IDB but NO Supabase table ❌

---

### 8. **Data Layer Inconsistencies**

**Location:** `services/dataService.ts`

**Issues:**

#### 8.1 Active Dialer Agent State
```typescript
// State only in IndexedDB, not synced to Supabase
export async function getActiveDialerAgent(): Promise<Agent | null> {
  const agents = await idbService.getAgentsFromIdb();
  return agents.find(a => a.isActiveForDialer) || null;
}
```

**Impact:** Active state lost when clearing browser data

#### 8.2 TTS Generations
```typescript
// Saves to IDB only, never syncs to Supabase
export async function saveTtsGeneration(generationData: {...}): Promise<TtsGeneration> {
  const newGeneration: TtsGeneration = {
    ...generationData,
    id: `local-${Date.now()}`, // Local ID only
    created_at: new Date().toISOString(),
  };
  await idbService.upsertTtsGenerationsToIdb([newGeneration]);
  return newGeneration; // Never saved to Supabase
}
```

**Impact:** TTS history lost across devices/sessions

---

## Missing Database Tables Summary

### Required Tables Not in Supabase:

1. **`crm_bookings`** - Critical for CRM functionality
2. **`voices`** - For caching voice data from Bland AI
3. **Migration needed for `agents`** - Add missing columns
4. **Migration needed for `call_logs`** - Add summary column

---

## Storage Bucket Issues

**Bucket Name:** `eburon-files`

**Structure:**
```
eburon-files/
├── public/
│   ├── agent-avatars/{agentId}/avatar.{ext}
│   ├── voice-previews/{voiceName}_{timestamp}.{ext}
│   ├── tts-generations/{timestamp}.{ext}
│   └── chat-images/{timestamp}.{ext}
```

**Issues:**
- No file lifecycle management
- No cleanup of orphaned files
- No size limits enforced at application level
- No CDN configuration mentioned

---

## Recommended Priority Fixes

### Priority 1 (Critical - Data Loss Risk):
1. Fix corrupted `schema.sql` and `database.sql` files
2. Add missing columns to `agents` table
3. Add missing `summary` column to `call_logs` table
4. Create `crm_bookings` table with full CRUD

### Priority 2 (High - Functionality Impact):
5. Move hardcoded API keys to environment variables
6. Create `voices` table for caching
7. Fix TTS generations sync to Supabase
8. Implement active dialer agent sync

### Priority 3 (Medium - Enhancement):
9. Add storage file cleanup mechanisms
10. Implement proper error boundaries for storage operations
11. Add data validation layers
12. Implement storage quota monitoring

---

## Implementation Checklist

### Database Schema Updates:
- [ ] Export current Supabase schema to readable SQL
- [ ] Create migration for missing agent columns
- [ ] Create migration for call_logs summary column
- [ ] Create crm_bookings table
- [ ] Create voices table
- [ ] Test migrations in development environment

### Code Updates:
- [ ] Move API keys to environment variables
- [ ] Update supabaseService to handle new columns
- [ ] Implement CRM Supabase integration
- [ ] Fix TTS generations sync
- [ ] Add voices table sync
- [ ] Update dataService routing

### Testing Required:
- [ ] Test offline-first functionality
- [ ] Test Supabase sync on reconnection
- [ ] Test IndexedDB fallback
- [ ] Test storage upload/download
- [ ] Test data migration scenarios

---

## SQL Migration Scripts

### Migration 1: Add Missing Agent Columns
```sql
ALTER TABLE agents 
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active_for_dialer BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_agents_active_dialer 
  ON agents(is_active_for_dialer) 
  WHERE is_active_for_dialer = TRUE;
```

### Migration 2: Add Call Logs Summary
```sql
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS summary TEXT;
```

### Migration 3: Create CRM Bookings Table
```sql
CREATE TABLE IF NOT EXISTS crm_bookings (
  pnr VARCHAR(50) PRIMARY KEY,
  passenger_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(50),
  flight_number VARCHAR(50),
  origin VARCHAR(255),
  destination VARCHAR(255),
  flight_date TIMESTAMPTZ,
  status VARCHAR(50) CHECK (status IN ('confirmed', 'checked_in', 'completed', 'canceled', 'pending')),
  notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_bookings_status ON crm_bookings(status);
CREATE INDEX IF NOT EXISTS idx_crm_bookings_flight_date ON crm_bookings(flight_date);
CREATE INDEX IF NOT EXISTS idx_crm_bookings_passenger_name ON crm_bookings(passenger_name);
```

### Migration 4: Create Voices Table
```sql
CREATE TABLE IF NOT EXISTS voices (
  id VARCHAR(255) PRIMARY KEY,
  uuid VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(100),
  type VARCHAR(50) CHECK (type IN ('Prebuilt', 'Cloned')),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voices_type ON voices(type);
CREATE INDEX IF NOT EXISTS idx_voices_provider ON voices(provider);
```

---

## Conclusion

The application has a solid foundation with offline-first architecture using IndexedDB, but several critical database integrations are missing or incomplete:

1. **CRM data is completely ephemeral** (in-memory only)
2. **Database schema files are corrupted**
3. **Multiple columns missing from existing tables**
4. **No voices table for caching API data**
5. **API keys hardcoded (security risk)**
6. **Incomplete sync between IndexedDB and Supabase**

These issues should be addressed in the priority order listed above to ensure data persistence, security, and proper offline-first functionality.
