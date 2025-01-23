# Real-Time AI Translation Platform
Product Requirements Document (PRD)

## Overview
A real-time AI-powered bilateral translation platform designed for travelers to facilitate communication with locals. This mobile-optimized web application enables users to conduct real-time conversations across different languages using their phone as an interview-style microphone.

### Design Philosophy
- Ultra-minimalist approach inspired by Kanye West's Yeezy product aesthetic
- Focus on mobile-first, touch-optimized interface
- Emphasis on real-time performance and accuracy

### Tech Stack
- NextJS 14
- shadcn/ui components
- Tailwind CSS
- Lucid icons

## Project Structure
```
translator-llm/
.
├── README.md
├── app
│   ├── api
│   │   ├── language
│   │   ├── speech
│   │   └── translate
│   ├── globals.css
│   ├── guide
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── language-selector.tsx
│   ├── message-display.tsx
│   ├── ui
│   │   ├── button.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── sidebar.tsx
│   └── voice-settings.tsx
├── components.json
├── docs
│   ├── groq_elevenlabs.md
│   ├── groq_inquiries.md
│   ├── groq_speach_text.md
│   ├── groq_update_thread.md
│   └── voice-detection-settings.md
├── eslint.config.mjs
├── hooks
│   ├── use-audio.ts
│   └── use-mobile.tsx
├── instructions
│   ├── instruction.md
│   └── problem.md
├── lib
│   ├── translate.ts
│   ├── types.ts
│   └── utils.ts
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── styles
│   └── animations.css
├── tailwind.config.ts
└── tsconfig.json
```

## Core Features & Technical Specifications

### 1. Language Selection Setup

#### User Flow
1. Users see a large white recording circle button on minimal white background
2. System prompts for language preferences through voice input
3. Voice input is processed through STT
4. Language preferences extracted via LLM function calling

#### Technical Implementation
- **Speech-to-Text**: Groq's whisper-large-v3 model
  - API Base URL: https://api.groq.com/openai/v1
  - Model: whisper-large-v3
  - Temperature: 0.0

**Implementation Example (speechToText.ts):**
```typescript
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Define response type for transcription
interface TranscriptionResponse {
  text: string;
  x_groq?: {
    id: string;
  };
}

// Initialize OpenAI client with Groq configuration
const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function convertSpeechToText(
  audioFilePath: string,
  prompt?: string
): Promise<string> {
  try {
    // Verify file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error('Audio file not found');
    }

    // Create read stream for the audio file
    const audioStream = fs.createReadStream(audioFilePath);

    // Call Groq's transcription API
    const transcription = await client.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-large-v3',
      prompt: prompt,
      temperature: 0.0,
    });

    return (transcription as TranscriptionResponse).text;

  } catch (error) {
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('API key')) {
        throw new Error('Invalid or missing Groq API key');
      }
      if (error.message.includes('file not found')) {
        throw new Error(`Audio file not found at path: ${audioFilePath}`);
      }
      throw new Error(`Speech to text conversion failed: ${error.message}`);
    }
    // Handle unknown errors
    throw new Error('An unexpected error occurred during speech to text conversion');
  }
}
```

- **Language Detection**: Groq's llama-3.3-70b-versatile model
  - Implements function calling for structured output
  - Returns ISO 639-1 language codes and English names

**Implementation Example (languageDetection.ts):**
```typescript
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import {
  Language,
  LanguagePair,
  UnrecognizedLanguageError,
  InvalidInputFormatError,
  MissingLanguagePairError,
} from '../types/language';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize OpenAI client with Groq configuration
const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

// Function to validate the language pair
function validateLanguagePair(pair: LanguagePair): void {
  if (!pair.sourceLanguage || !pair.targetLanguage) {
    throw new MissingLanguagePairError();
  }
  
  if (!pair.sourceLanguage.code || !pair.targetLanguage.code) {
    throw new UnrecognizedLanguageError('Language code is missing');
  }
  
  if (!pair.sourceLanguage.name || !pair.targetLanguage.name) {
    throw new UnrecognizedLanguageError('Language name is missing');
  }
}

export async function detectLanguagePreferences(input: string): Promise<LanguagePair> {
  try {
    if (!input.trim()) {
      throw new InvalidInputFormatError('Input is empty');
    }

    // Call Groq's LLM with function calling
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a language detection expert. Extract the source and target languages from the user's input and return them in a structured format. Use ISO 639-1 codes and English language names.`
        },
        {
          role: 'user',
          content: input
        }
      ],
      functions: [
        {
          name: 'extract_languages',
          description: 'Extract source and target languages from user input',
          parameters: {
            type: 'object',
            properties: {
              sourceLanguage: {
                type: 'object',
                properties: {
                  code: { type: 'string', description: 'ISO 639-1 language code' },
                  name: { type: 'string', description: 'Full language name in English' }
                },
                required: ['code', 'name']
              },
              targetLanguage: {
                type: 'object',
                properties: {
                  code: { type: 'string', description: 'ISO 639-1 language code' },
                  name: { type: 'string', description: 'Full language name in English' }
                },
                required: ['code', 'name']
              }
            },
            required: ['sourceLanguage', 'targetLanguage']
          }
        }
      ],
      function_call: { name: 'extract_languages' }
    });

    // Extract the function call response
    const functionCall = completion.choices[0]?.message?.function_call;
    if (!functionCall || !functionCall.arguments) {
      throw new InvalidInputFormatError('Failed to extract language information');
    }

    // Parse the response
    const languagePair = JSON.parse(functionCall.arguments) as LanguagePair;
    
    // Validate the extracted language pair
    validateLanguagePair(languagePair);

    return languagePair;

  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new InvalidInputFormatError('Failed to parse LLM response');
    }
    if (error instanceof Error) {
      // Re-throw our custom errors
      if (error.name.includes('LanguageDetection')) {
        throw error;
      }
      throw new InvalidInputFormatError(error.message);
    }
    throw new InvalidInputFormatError('An unexpected error occurred');
  }
}
```

### 2. Real-time Translation Interface

#### UI Components
- Prominent white circular recording button
- "Press the circle" initial text
- Original and translated text display above circle
- Message format: "Original Text (Translated Text)"

#### Technical Requirements
- Message clearing between recording sessions
- Real-time text updates
- Mobile-optimized touch interactions
- Responsive design for various screen sizes

### 3. Conversation Flow

#### Technical Stack
1. **Speech-to-Text**: Groq's whisper-large-model
   - Handles audio file processing and transcription
   - Includes error handling for common scenarios

2. **Function Calling**: llama-3.3-70b-versatile
   - Used for structured data extraction
   - Handles language detection and preferences

3. **Translation**: DeepSeek-V3 model
   - API Base URL: https://api.deepseek.com/v1
   - Maintains conversation context
   - Handles bidirectional translation

**Implementation Example (translationService.ts):**
```typescript
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import {
  Language,
  LanguageConfig,
  TranslationMessage,
  ConversationContext,
  TranslationError,
  APIError,
  RateLimitError,
  LanguageDetectionError,
  EmptyInputError,
} from '../types/translation';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize OpenAI client with DeepSeek configuration
const client = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',  // Replace with actual DeepSeek endpoint
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

function createTranslationPrompt(
  sourceLanguage: Language,
  targetLanguage: Language,
  text: string
): string {
  return `You are a professional translator for ${sourceLanguage.name} to ${targetLanguage.name}. 
Translate the following text while maintaining the original meaning and nuance. 
Respond with only the translation, no explanations.
Text to translate: ${text}`;
}

async function detectLanguage(
  text: string,
  config: LanguageConfig,
  context?: ConversationContext
): Promise<Language> {
  try {
    // First, try to predict based on conversation context
    if (context?.lastSpeaker === 'first') {
      return config.secondLanguage;
    } else if (context?.lastSpeaker === 'second') {
      return config.firstLanguage;
    }

    // If no context, use DeepSeek to detect language
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',  // Replace with actual model name
      messages: [
        {
          role: 'system',
          content: 'You are a language detection expert. Analyze the text and determine if it is in the first or second language. Respond with only "first" or "second".'
        },
        {
          role: 'user',
          content: `First Language: ${config.firstLanguage.name}
Second Language: ${config.secondLanguage.name}
Text to analyze: ${text}`
        }
      ],
      temperature: 0.1,
    });

    const result = completion.choices[0]?.message?.content?.trim().toLowerCase();
    
    if (result === 'first') {
      return config.firstLanguage;
    } else if (result === 'second') {
      return config.secondLanguage;
    }

    throw new LanguageDetectionError('Could not determine language');

  } catch (error) {
    if (error instanceof TranslationError) {
      throw error;
    }
    throw new APIError(error instanceof Error ? error.message : 'Unknown error during language detection');
  }
}

async function translateText(
  text: string,
  sourceLanguage: Language,
  targetLanguage: Language
): Promise<string> {
  try {
    const prompt = createTranslationPrompt(sourceLanguage, targetLanguage, text);
    
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',  // Replace with actual model name
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
    });

    const translation = completion.choices[0]?.message?.content;
    if (!translation) {
      throw new APIError('No translation received');
    }

    return translation.trim();

  } catch (error) {
    if (error instanceof TranslationError) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('rate limit')) {
      throw new RateLimitError();
    }
    throw new APIError(error instanceof Error ? error.message : 'Unknown error during translation');
  }
}

export async function translateConversation(
  text: string,
  config: LanguageConfig,
  context?: ConversationContext
): Promise<TranslationMessage> {
  try {
    // Validate input
    if (!text.trim()) {
      throw new EmptyInputError();
    }

    // Detect language
    const detectedLanguage = await detectLanguage(text, config, context);

    // Determine target language
    const targetLanguage = detectedLanguage.code === config.firstLanguage.code
      ? config.secondLanguage
      : config.firstLanguage;

    // Perform translation
    const translation = await translateText(text, detectedLanguage, targetLanguage);

    // Create translation message
    const message: TranslationMessage = {
      text,
      detectedLanguage,
      translation,
      timestamp: Date.now(),
    };

    return message;

  } catch (error) {
    if (error instanceof TranslationError) {
      throw error;
    }
    throw new TranslationError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export function createConversationContext(config: LanguageConfig): ConversationContext {
  return {
    config,
    messages: [],
  };
}

export function updateConversationContext(
  context: ConversationContext,
  message: TranslationMessage
): ConversationContext {
  return {
    ...context,
    messages: [...context.messages, message],
    lastSpeaker: message.detectedLanguage.code === context.config.firstLanguage.code
      ? 'first'
      : 'second',
  };
}
```

### 4. Environment Setup

#### Required Environment Variables
```env
# API Keys
GROQ_API_KEY=your_groq_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```
