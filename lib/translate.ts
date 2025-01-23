import { Language } from './types';

interface TranslationMetrics {
  firstTokenLatency?: number;
  totalLatency?: number;
  sttLatency?: number;
  translationLatency?: number;
}

interface TranslationOptions {
  onPartial?: (text: string) => void;
  onMetrics?: (metrics: TranslationMetrics) => void;
}

export async function translateText(
  text: string, 
  languages: Language[], 
  options?: TranslationOptions
): Promise<string> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, languages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Translation failed');
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullTranslation = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the stream chunk and split into SSE messages
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(5).trim();
          
          if (data === '[DONE]') {
            return fullTranslation;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullTranslation += parsed.content;
              // Call the partial translation callback if provided
              options?.onPartial?.(fullTranslation);
            }
            // Handle metrics if present
            if (parsed.metrics) {
              options?.onMetrics?.(parsed.metrics);
            }
          } catch (e) {
            console.error('Error parsing SSE message:', e);
          }
        }
      }
    }
  } catch (error) {
    throw error;
  }

  return fullTranslation;
} 