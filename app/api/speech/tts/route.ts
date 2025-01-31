import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { text, language } = await req.json();

  if (!text) {
    return new Response(
      JSON.stringify({ error: 'Text is required' }),
      { status: 400 }
    );
  }

  // ElevenLabs API configuration
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

  if (!ELEVENLABS_API_KEY || !VOICE_ID) {
    return new Response(
      JSON.stringify({ error: 'Missing API configuration' }),
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          // output_format: "mp3_22050_32",
          // apply_text_normalization: "off",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.24,
            use_speaker_boost: true
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('ElevenLabs API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      throw new Error(
        errorData.detail || 
        errorData.message || 
        `API request failed with status ${response.status}`
      );
    }

    // Ensure we have a readable stream
    if (!response.body) {
      throw new Error('No response body from ElevenLabs API');
    }

    // Forward the audio stream from ElevenLabs
    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg'
      },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate speech',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
} 