import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Language } from '@/lib/types';

const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    console.log('Language detection request for:', text);

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a language detection expert. Detect the language of the given text and return the ISO 639-1 code and English name.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      functions: [
        {
          name: 'detect_language',
          description: 'Detect the language of the input text',
          parameters: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'ISO 639-1 language code' },
              name: { type: 'string', description: 'Full language name in English' }
            },
            required: ['code', 'name']
          }
        }
      ],
      function_call: { name: 'detect_language' }
    });

    const functionCall = completion.choices[0]?.message?.function_call;
    if (!functionCall?.arguments) {
      throw new Error('Failed to detect language');
    }

    const detectedLanguage = JSON.parse(functionCall.arguments) as Language;
    console.log('Detected language:', detectedLanguage);

    return NextResponse.json({ detectedLanguage });
  } catch (error) {
    console.error('Language detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect language' },
      { status: 500 }
    );
  }
} 