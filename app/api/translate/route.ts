import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

export async function POST(req: NextRequest) {
  const { text, languages } = await req.json();

  if (!text || !languages || languages.length !== 2) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields or invalid languages array' }),
      { status: 400 }
    );
  }

  // Filter out too short or meaningless text
  const cleanText = text.trim();
  if (cleanText.length < 2 || /^[.,!?]+$/.test(cleanText)) {
    return new Response(
      JSON.stringify({ error: 'Text too short or meaningless' }),
      { status: 400 }
    );
  }

  const prompt = `You are a professional translator for ${languages[0].name} and ${languages[1].name}.
First, determine if the input text is in ${languages[0].name} or ${languages[1].name}.
Then, translate the text to the other language while maintaining the original meaning and nuance.
Respond with only the translation, no explanations.

Text to translate: ${text}`;

  try {
    const stream = await client.chat.completions.create({
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

    // Create a new ReadableStream that will be our response
    const textEncoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              // Send the chunk as a Server-Sent Event
              const message = `data: ${JSON.stringify({ content })}\n\n`;
              controller.enqueue(textEncoder.encode(message));
            }
          }
          // Send a completion message
          controller.enqueue(textEncoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // Return the stream with appropriate headers
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to translate text',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500 }
    );
  }
} 