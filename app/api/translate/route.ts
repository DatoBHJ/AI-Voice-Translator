import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
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
  const { text, languages } = await req.json();
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

  const prompt = `You are a professional translator for ${languages[0].name} and ${languages[1].name}.
First, determine if the input text is in ${languages[0].name} or ${languages[1].name}.
Then, translate the text to the other language while maintaining the original meaning and nuance.
Respond with only the translation, no explanations.

Text to translate: ${text}`;

  try {
    // Use retry logic for the stream creation
    const stream = await withRetry(async () => {
      return await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        stream: true,
      });
    });

    // Create a new ReadableStream that will be our response
    const textEncoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let firstChunkTime: number | null = null;
          
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
              
              // Send the chunk as a Server-Sent Event
              const message = `data: ${JSON.stringify({ content })}\n\n`;
              controller.enqueue(textEncoder.encode(message));
            }
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