import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// Initialize OpenAI client with Groq configuration
const client = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    console.log('Received speech-to-text request');
    
    const formData = await req.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      console.error('No valid audio file provided');
      return NextResponse.json(
        { error: 'No valid audio file provided' },
        { status: 400 }
      );
    }

    console.log('Audio file received:', {
      type: audioFile.type,
      size: audioFile.size,
    });

    // Convert the audio data to a buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File object that OpenAI can process
    const file = await OpenAI.toFile(
      new Blob([buffer], { type: 'audio/webm' }),
      'audio.webm'
    );

    console.log('Calling Groq API for transcription...');

    // Call Groq's Whisper model
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      temperature: 0.0,
      response_format: 'verbose_json'
    });

    console.log('Full response:', transcription);
    console.log('Detected language:', transcription.language);
    
    // Check if the audio is likely not speech
    if (!transcription.segments || transcription.segments.length === 0) {
      console.log('No segments found in transcription');
      return NextResponse.json({ 
        error: 'No speech detected',
      }, { status: 400 });
    }

    const segment = transcription.segments[0];
    const qualityChecks = {
      noSpeechProb: segment.no_speech_prob > 0.5,
      lowConfidence: segment.avg_logprob < -0.5,  // 낮은 신뢰도
      unusualCompression: segment.compression_ratio < 0.5 || segment.compression_ratio > 5.0  // 범위 확장
    };

    if (qualityChecks.noSpeechProb || qualityChecks.lowConfidence || qualityChecks.unusualCompression) {
      console.log('Speech quality issues detected:', qualityChecks);
      return NextResponse.json({ 
        error: 'Low quality speech detected',
        details: qualityChecks
      }, { status: 400 });
    }
    
    // Clean up transcribed text
    const cleanText = transcription.text.trim();
    if (cleanText.length < 2) {
      return NextResponse.json({ 
        error: 'Transcription too short',
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      text: cleanText,
      language: transcription.language,
      quality: {
        confidence: Math.exp(segment.avg_logprob),  // Convert log probability to probability
        speechProb: 1 - segment.no_speech_prob
      }
    });
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process audio', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 