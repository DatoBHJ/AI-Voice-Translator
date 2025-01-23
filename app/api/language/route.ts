import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { LanguagePair } from '@/lib/types';

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
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { 
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          }
        }
      );
    }

    // Use retry logic for the API call
    const completion = await withRetry(async () => {
      return await client.chat.completions.create({
        model: 'llama3-8b-8192',
        // model: 'llama-3.3-70b-versatile',
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
    });

    const functionCall = completion.choices[0]?.message?.function_call;
    if (!functionCall?.arguments) {
      throw new Error('Failed to extract language information');
    }

    const languagePair = JSON.parse(functionCall.arguments) as LanguagePair;
    return NextResponse.json(languagePair, {
      headers: {
        'Cache-Control': 'no-store',
      }
    });

  } catch (error) {
    console.error('Language detection error:', error);
    
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

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: statusCode,
        headers: {
          'Cache-Control': 'no-store',
        }
      }
    );
  }
} 