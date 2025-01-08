import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { LanguagePair } from '@/lib/types';

export const runtime = 'edge';

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

    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a language detection expert. Extract the source and target languages from the user\'s input and return them in a structured format. Use ISO 639-1 codes and English language names.'
        },
        {
          role: 'user',
          content: text
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

    const functionCall = completion.choices[0]?.message?.function_call;
    if (!functionCall?.arguments) {
      throw new Error('Failed to extract language information');
    }

    const languagePair = JSON.parse(functionCall.arguments) as LanguagePair;
    return NextResponse.json(languagePair);
  } catch (error) {
    console.error('Language detection error:', error);
    return NextResponse.json(
      { error: 'Failed to detect languages' },
      { status: 500 }
    );
  }
} 