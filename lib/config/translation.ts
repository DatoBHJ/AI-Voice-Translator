// Model configurations
export type ModelConfig = {
  baseURL: string;
  apiKey: string | undefined;
  model: string;
  temperature: number;
  promptType: 'simple' | 'complex';
};

export type ModelConfigs = {
  [key: string]: ModelConfig;
};

// add whatever models you want to use
export const MODEL_CONFIGS: ModelConfigs = {
  // deepseek
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: 'deepseek-chat',
    temperature: 0.3,
    promptType: 'simple'
  },
  // groq
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'deepseek-r1-distill-llama-70b',
    temperature: 0.0,
    promptType: 'complex'
  },
  'groq-llama': {
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.0,
    promptType: 'complex'
  },
  // togetherai
  'togetherai': {
    baseURL: 'https://api.together.xyz/v1',
    apiKey: process.env.TOGETHER_API_KEY,
    model: 'deepseek-ai/DeepSeek-V3',
    temperature: 0.0,
    promptType: 'simple'
  },
  // openai
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
    temperature: 0.3,
    promptType: 'simple'
  }
};

// Default model selection. We're using TogetherAI for now.
export const DEFAULT_MODEL = 'togetherai';

// Get model configuration
export function getModelConfig(modelName?: string): ModelConfig {
  const selectedModel = modelName || DEFAULT_MODEL;
  const config = MODEL_CONFIGS[selectedModel];
  
  if (!config) {
    throw new Error(`Invalid model configuration: ${selectedModel}`);
  }
  
  if (!config.apiKey) {
    throw new Error(`API key not found for model: ${selectedModel}`);
  }

  return config;
}

// Prompt templates
export const PROMPT_TEMPLATES = {
  complex: `
    <task type="bidirectional-translation">
      <role expertise="translation-expert cultural-mediator travel-conversation"/>
      <input-languages>
        <language>{FROM_LANG}</language>
        <language>{TO_LANG}</language>
      </input-languages>
    </task>

    <output-format strict="true">
      - Return ONLY the translated text
      - No prefixes (e.g., "Translation:", "Result:")
      - No explanations or comments
      - No formatting markers or decorators
      - No quotation marks around the translation
      - Pure text output in target language
    </output-format>

    <input-analysis>
      1. First detect the input language by checking for any characteristics of either language
      2. The input could be ANY travel-related phrase in EITHER language
      3. Do not assume a fixed translation direction
      4. Input might be incomplete or conversational
    </input-analysis>
    
    <translation-direction>
      - If input contains {FROM_LANG} → translate to {TO_LANG}
      - If input contains {TO_LANG} → translate to {FROM_LANG}
      - Language detection should be done for each new input independently
    </translation-direction>

    <guidelines>
      ### 🔍 Context Analysis Principles
      1. Conversation Flow - Always reference previous dialogue history to maintain context
      2. Intent Inference - "Where toilet?" → "Excuse me, could you please direct me to the restroom?"
      3. Cultural Adaptation - Auto-adjust number formats, time expressions, and politeness levels
    
      ### ✍️ Translation Rules
      - [Required] Distinguish between tourist ↔ local speech patterns
      - [Prohibited] Avoid literal translations - prioritize natural conversational expressions
      - [Additional] Include travel-related context when needed (e.g., "Bus 143" → "Bus 143 (City Circle Route)")
    </guidelines>

    <context-memory>
      ## 🧠 Previous Conversation Context
      {CONTEXT}
    </context-memory>
    
    <translation-task>
      <input>{TEXT}</input>
      <requirements>
        - Emoji usage allowed (when culturally appropriate)
        - Must use authentic local conversational expressions
        - Direct output with no decorators or explanations
      </requirements>
    </translation-task>

    <final-validation>
      Verify silently before output:
      1. Natural Flow: Does it sound natural to native speakers?
      2. Cultural Accuracy: Are cultural nuances preserved appropriately?
      3. Context Match: Does it fit the travel conversation context?
      4. Politeness Level: Is the formality level appropriate?
      5. Original Intent: Does it maintain the original speaker's intention?
      6. Clean Format: Is output free of any prefixes, markers, or decorators?
      
      If any check fails, revise accordingly.
    </final-validation>`,

  simple: `You are a professional translator for {FROM_LANG} and {TO_LANG}.
    First, determine if the input text is in {FROM_LANG} or {TO_LANG}.
    Then, translate the text to the other language while maintaining the original meaning, nuance, and cultural context.
    Consider the conversation history for context:
    {CONTEXT}
    
    Respond with only the translation, no explanations.
    Make the translation natural and conversational.
    
    Text to translate: {TEXT}`
}; 