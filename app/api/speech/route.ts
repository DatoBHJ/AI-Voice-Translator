import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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
    });

    console.log('Transcription received:', transcription.text);

    return NextResponse.json({ text: transcription.text });
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