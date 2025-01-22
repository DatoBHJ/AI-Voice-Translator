import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Edge Runtime declaration
export const runtime = 'edge';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

// Initialize OpenAI client
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
    console.log('Received speech-to-text request');
    
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const languagesJson = formData.get('languages');
    let languages = null;
    
    if (languagesJson && typeof languagesJson === 'string') {
      try {
        languages = JSON.parse(languagesJson);
      } catch (e) {
        console.warn('Failed to parse languages:', e);
      }
    }

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'No valid audio file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Log file details for debugging
    console.log('Audio file details:', {
      size: buffer.length,
      type: audioFile.type,
      name: (audioFile as File).name
    });

    // Ensure correct mime type is passed from the original file
    const file = await OpenAI.toFile(
      new Blob([buffer], { type: audioFile.type || 'audio/webm' }),
      'audio.webm'
    );

    // Log the created file for debugging
    console.log('Created file details:', {
      size: file.size,
      type: file.type,
      name: file.name
    });

    // Groq API call with retry logic
    const transcription = await withRetry(async () => {
      return await client.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3',
        temperature: 0.0,
        response_format: 'verbose_json',
      });
    });

    if (!transcription.segments || transcription.segments.length === 0) {
      return NextResponse.json({ 
        error: 'No voice detected. Please speak clearly into your microphone.',
      }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        }
      });
    }

    const segment = transcription.segments[0];
    const qualityChecks = {
      noSpeechProb: segment.no_speech_prob > 0.5,
      lowConfidence: segment.avg_logprob < -1,
      unusualCompression: segment.compression_ratio < 0 || segment.compression_ratio > 10 
    };

    if (qualityChecks.noSpeechProb || qualityChecks.lowConfidence || qualityChecks.unusualCompression) {
      return NextResponse.json({ 
        error: 'Speech quality is too low. Please speak louder and more clearly.',
        details: qualityChecks
      }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        }
      });
    }

    const cleanText = transcription.text.trim();
    if (cleanText.length < 2) {
      return NextResponse.json({ 
        error: 'Speech is too short. Please speak a complete sentence.',
      }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        }
      });
    }

    return NextResponse.json({ 
      text: cleanText,
      language: transcription.language,
      quality: {
        confidence: Math.exp(segment.avg_logprob),
        speechProb: 1 - segment.no_speech_prob
      }
    }, {
      headers: {
        'Cache-Control': 'no-store',
      }
    });

  } catch (error) {
    console.error('Speech-to-text error:', error);
    
    let errorMessage = 'Network error. Please check your connection and try again.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('blocked')) {
        errorMessage = 'Server is temporarily unavailable. Please wait a moment and try again.';
        statusCode = 403;
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
        statusCode = 503;
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
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