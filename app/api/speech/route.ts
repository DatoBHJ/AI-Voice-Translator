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
    
    // Log request details
    console.log('Request details:', {
      hasAudioFile: !!audioFile,
      audioFileType: audioFile instanceof Blob ? audioFile.type : typeof audioFile,
      hasLanguages: !!languagesJson,
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries())
    });

    let languages = null;
    if (languagesJson && typeof languagesJson === 'string') {
      try {
        languages = JSON.parse(languagesJson);
        console.log('Parsed languages:', languages);
      } catch (e) {
        console.error('Language parsing error:', e);
        return NextResponse.json(
          { 
            error: 'Invalid language configuration',
            details: e instanceof Error ? e.message : 'Unknown parsing error'
          },
          { status: 400 }
        );
      }
    }

    if (!audioFile || !(audioFile instanceof Blob)) {
      console.error('Audio file validation failed:', { 
        received: audioFile,
        type: audioFile ? typeof audioFile : 'null'
      });
      return NextResponse.json(
        { 
          error: 'Invalid audio file',
          details: 'The audio file is missing or in an incorrect format'
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Enhanced file details logging
    console.log('Audio file details:', {
      size: buffer.length,
      type: audioFile.type,
      name: (audioFile as File).name,
      bufferSize: buffer.byteLength,
      mimeType: audioFile.type || 'audio/webm'
    });

    const file = await OpenAI.toFile(
      new Blob([buffer], { type: audioFile.type || 'audio/webm' }),
      'audio.webm'
    );

    console.log('OpenAI file created:', {
      size: file.size,
      type: file.type,
      name: file.name
    });

    // Groq API call with retry logic and detailed error logging
    const transcription = await withRetry(async () => {
      try {
        const result = await client.audio.transcriptions.create({
          file,
          model: 'whisper-large-v3',
          temperature: 0.0,
          response_format: 'verbose_json',
        });
        console.log('Transcription success:', {
          hasSegments: !!result.segments,
          segmentCount: result.segments?.length,
          textLength: result.text?.length
        });
        return result;
      } catch (e) {
        console.error('Transcription API error:', {
          error: e instanceof Error ? e.message : 'Unknown error',
          status: (e as any)?.status,
          type: e instanceof Error ? e.constructor.name : typeof e
        });
        throw e;
      }
    });

    if (!transcription.segments || transcription.segments.length === 0) {
      console.warn('No segments in transcription');
      return NextResponse.json({ 
        error: 'No voice detected',
        details: 'The audio recording contains no recognizable speech. Please speak clearly into your microphone.'
      }, { 
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const segment = transcription.segments[0];
    const qualityChecks = {
      noSpeechProb: segment.no_speech_prob > 0.5,
      lowConfidence: segment.avg_logprob < -1,
      unusualCompression: segment.compression_ratio < 0 || segment.compression_ratio > 10 
    };

    console.log('Quality check results:', {
      ...qualityChecks,
      metrics: {
        noSpeechProb: segment.no_speech_prob,
        avgLogprob: segment.avg_logprob,
        compressionRatio: segment.compression_ratio
      }
    });

    if (qualityChecks.noSpeechProb || qualityChecks.lowConfidence || qualityChecks.unusualCompression) {
      return NextResponse.json({ 
        error: 'Low quality speech detected',
        details: {
          message: 'The audio quality is too low for accurate transcription',
          checks: qualityChecks,
          metrics: {
            speechProbability: 1 - segment.no_speech_prob,
            confidence: Math.exp(segment.avg_logprob),
            compression: segment.compression_ratio
          }
        }
      }, { 
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    const cleanText = transcription.text.trim();
    if (cleanText.length < 2) {
      return NextResponse.json({ 
        error: 'Speech too short',
        details: 'Please speak a complete sentence for accurate translation'
      }, { 
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    return NextResponse.json({ 
      text: cleanText,
      language: transcription.language,
      quality: {
        confidence: Math.exp(segment.avg_logprob),
        speechProb: 1 - segment.no_speech_prob,
        compressionRatio: segment.compression_ratio
      }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Speech-to-text error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      details: error
    });
    
    let errorMessage = 'Network error occurred';
    let errorDetails = '';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('blocked') || error.message.includes('403')) {
        errorMessage = 'API access blocked';
        errorDetails = 'The server is temporarily unavailable. This might be due to network restrictions or rate limiting.';
        statusCode = 403;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        errorMessage = 'Network connection failed';
        errorDetails = 'Unable to reach the server. This might be due to unstable mobile data connection.';
        statusCode = 503;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout';
        errorDetails = 'The server took too long to respond. This might be due to slow network speed.';
        statusCode = 504;
      } else {
        errorMessage = 'Processing error';
        errorDetails = error.message;
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
        requestId: Math.random().toString(36).substring(7)
      },
      { 
        status: statusCode,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
} 