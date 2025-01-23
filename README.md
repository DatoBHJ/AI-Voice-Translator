# Real-Time AI Voice Translator 🌐🎙️

[![Next.js](https://img.shields.io/badge/Next.js-14.2.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)

A low-latency voice translation solution supporting 50+ languages with environment-adaptive audio processing.

## ✨ Key Features
- **Ambient Noise Optimization**  
  Auto-adjusts voice detection for different environments (Quiet/Cafe/Noisy modes)
- **Bidirectional Streaming**  
  Groq-powered AI translation with quick response time
- **Natural Voice Synthesis**  
  ElevenLabs integration for lifelike text-to-speech
- **Smart Session Management**  
  Conversation history with imessage style ui with timestamps

## 🛠 Tech Stack
**Core Framework**  
- Next.js 14 (App Router)  
- TypeScript  
- Web Audio API  

**AI Services**  
- Groq Cloud (LLM Inference)  
- ElevenLabs (Text-to-Speech)  

**UI Components**  
- Tailwind CSS + Shadcn UI  
- Framer Motion animations  
- Radix UI Primitives  

## 🚀 Quick Start
1. Install dependencies
```bash
npm install
```

2. Set environment variables (.env)
```env
DEEPSEEK_API_KEY=your_deepseek_key
ELEVENLABS_API_KEY=your_elevenlabs_key
```

3. Start development server
```bash
npm run dev
```

## 📂 Project Structure
```bash
/translator-llm
├── app/
│   ├── api/              # Edge API routes
│   │   ├── speech/       # STT processing
│   │   ├── translate/   # Streaming translations
│   │   └── language/    # Lang detection
│   └── page.tsx         # Main UI
├── components/          # Interactive components
│   ├── language-selector.tsx  # Dual-lang UI
│   ├── message-display.tsx    # Chat history
│   └── voice-settings.tsx     # Env presets
├── hooks/
│   └── use-audio.ts      # Audio processing core
├── lib/                  # Utilities & types
└── styles/               # Custom animations
```

## 🧠 Core Modules
- `use-audio.ts` - Audio pipeline with VAD (Voice Activity Detection)
  - Environment-aware silence detection
  - Pre-buffering for zero latency
  - Adaptive noise thresholds

- `voice-settings.tsx` - Contextual audio presets
  - Hotel Mode (-65dB threshold)
  - Cafe Mode (-58dB threshold) 
  - Crowd Mode (-50dB threshold)

- `/api/speech` - Audio processing endpoints
  - WebM/Opus encoding
  - Chunked audio processing
  - Error resilience

> Full structure details: [PROJECT_STRUCTURE.md](instructions/instruction.md)
