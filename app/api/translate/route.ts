import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

// Smart retry function
async function withRetry<T>(
  operation: () => Promise<T>,
  retryCount = 0
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (retryCount >= MAX_RETRIES) {
      throw error;
    }

    if (
      error.message?.includes('blocked') ||
      error.message?.includes('network') ||
      error.status === 403 ||
      error.status === 503
    ) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retryCount + 1);
    }

    throw error;
  }
}

export async function POST(req: NextRequest) {
  const { text, languages, previousMessages } = await req.json();
  const startTime = performance.now();

  if (!text || !languages || languages.length !== 2) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields or invalid languages array' }),
      { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        }
      }
    );
  }

  // Filter out too short or meaningless text
  const cleanText = text.trim();
  if (cleanText.length < 2 || /^[.,!?]+$/.test(cleanText)) {
    return new Response(
      JSON.stringify({ error: 'Text too short or meaningless' }),
      { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        }
      }
    );
  }

  // Create context from previous messages
  const contextMessages = previousMessages?.map((msg: any) => ({
    role: 'assistant',
    content: `Original: ${msg.originalText}\nTranslation: ${msg.translatedText}`
  })) || [];

  const prompt = `
  <task type="bidirectional-translation">
    <role expertise="translation-expert cultural-mediator travel-conversation"/>
    <input-languages>
      <language>${languages[0].name}</language>
      <language>${languages[1].name}</language>
    </input-languages>
  </task>
  
  <guidelines>
    ### 🔍 Context Analysis Principles
    1. Conversation Flow - Always reference previous dialogue history to maintain context
    2. Intent Inference - "Where toilet?" → "Excuse me, could you please direct me to the restroom?"
    3. Cultural Adaptation - Auto-adjust number formats, time expressions, and politeness levels
  
    ### ✍️ Translation Rules
    - [Required] Distinguish between tourist ↔ local speech patterns
    - [Prohibited] Avoid literal translations - prioritize natural conversational expressions
    - [Additional] Include travel-related context when needed (e.g., "Bus 143" → "Bus 143 (City Circle Route)")
  
    ### ↔️ Bidirectional Translation Conditions
    <direction condition="${text.includes(languages[0].character)}">
      ${languages[0].name} → ${languages[1].name} conversion
    </direction>
    <direction condition="${text.includes(languages[1].character)}">
      ${languages[1].name} → ${languages[0].name} conversion
    </direction>
  </guidelines>
  
  <context-memory>
    ## 🧠 Previous Conversation Context
    ${previousMessages?.map((msg: { role: any; originalText: any; translatedText: any; }) => `[${msg.role}]: ${msg.originalText} ↦ ${msg.translatedText}`).join('\n')}
  </context-memory>
  
  <translation-task>
    ## 📝 Translation Request
    **Original Text**: "${text}"
  
    <output-requirements>
      - Output translation only (no explanations/comments)
      - Encourage emoji usage (when appropriate)
      - Must use authentic local conversational expressions
    </output-requirements>
  </translation-task>
  
  <!-- Hidden Optimization Instructions -->
  1. Automatic cultural validation check after translation
  2. Reference 5000-word travel vocabulary dataset
  3. Prefer standard language over dialects (unless specific location mentioned, then use local dialect)
  `;


  try {
    // Use retry logic for the stream creation
    const stream = await withRetry(async () => {
      return await client.chat.completions.create({
        model: 'deepseek-r1-distill-llama-70b',
        messages: [
          ...contextMessages,
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.0,
        stream: true,
      });
    });

    // Create a new ReadableStream that will be our response
    const textEncoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let firstChunkTime: number | null = null;
          let accumulatedContent = '';
          let isThinkingPhase = false;
          let thinkingContent = '';
          
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              if (!firstChunkTime) {
                firstChunkTime = performance.now();
                const firstTokenLatency = firstChunkTime - startTime;
                console.log(`First token latency: ${firstTokenLatency}ms`);
                
                // Send metrics with the first chunk
                const metricsMessage = `data: ${JSON.stringify({ 
                  metrics: { firstTokenLatency } 
                })}\n\n`;
                controller.enqueue(textEncoder.encode(metricsMessage));
              }

              // Handle thinking phase content
              if (content.includes('<think>')) {
                isThinkingPhase = true;
                continue;
              }

              if (isThinkingPhase) {
                if (content.includes('</think>')) {
                  isThinkingPhase = false;
                  // Log thinking content for debugging
                  console.log('Thinking phase:', thinkingContent);
                  thinkingContent = '';
                  continue;
                }
                thinkingContent += content;
                continue;
              }

              // Only accumulate non-thinking phase content
              if (!isThinkingPhase) {
                accumulatedContent += content;
              }
            }
          }
          
          // Send the complete accumulated content
          if (accumulatedContent) {
            console.log('Final translation:', accumulatedContent);
            const message = `data: ${JSON.stringify({ content: accumulatedContent })}\n\n`;
            controller.enqueue(textEncoder.encode(message));
          }

          // Send a completion message with final metrics
          const endTime = performance.now();
          const totalLatency = endTime - startTime;
          console.log(`Total translation latency: ${totalLatency}ms`);
          
          controller.enqueue(textEncoder.encode(`data: ${JSON.stringify({ 
            metrics: { totalLatency } 
          })}\n\n`));
          controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          // Enhanced error handling for stream
          const errorMessage = error instanceof Error ? error.message : 'Stream error occurred';
          const errorEvent = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
          controller.enqueue(textEncoder.encode(errorEvent));
          controller.close();
        }
      },
    });

    // Return the stream with appropriate headers
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    let errorMessage = 'Please check your network connection and try again.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('blocked')) {
        errorMessage = 'Network connection is unstable. Please wait a moment and try again.';
        statusCode = 403;
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Connection failed. Please check your internet connection.';
        statusCode = 503;
      }
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: statusCode,
        headers: {
          'Cache-Control': 'no-store',
        }
      }
    );
  }
} 