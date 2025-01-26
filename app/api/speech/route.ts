import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Edge Runtime declaration
export const runtime = 'edge';

// Initialize OpenAI client
const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    console.log('Received speech-to-text request');
    const startTime = performance.now();
    
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const languagesJson = formData.get('languages');

    let languages = null;
    if (languagesJson && typeof languagesJson === 'string') {
      try {
        languages = JSON.parse(languagesJson);
      } catch (e) {
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
    
    const file = await OpenAI.toFile(
      new Blob([buffer], { type: audioFile.type || 'audio/webm' }),
      'audio.webm'
    );

    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      temperature: 0.0,
      response_format: 'verbose_json',
    });

    const sttEndTime = performance.now();
    const sttLatency = sttEndTime - startTime;
    console.log(`STT Latency: ${sttLatency}ms`);

    if (!transcription.segments || transcription.segments.length === 0) {
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

    if (qualityChecks.noSpeechProb || qualityChecks.lowConfidence || qualityChecks.unusualCompression) {
      return NextResponse.json({ 
        error: 'Low quality speech detected',
        details: 'The audio quality is too low for accurate transcription'
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
        speechProb: 1 - segment.no_speech_prob
      },
      metrics: {
        sttLatency
      }
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('Speech-to-text error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    let errorMessage = 'Network error occurred';
    let errorDetails = '';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('Cloudflare') || error.message.includes('<!DOCTYPE html>')) {
        errorMessage = 'Cellular data access restricted';
        errorDetails = 'Service is temporarily restricted on cellular data. Please try using a Wi-Fi connection or use a VPN.';
        statusCode = 403;
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        errorMessage = 'Network connection failed';
        errorDetails = 'Network connection is unstable. Please check your internet connection and try again.';
        statusCode = 503;
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