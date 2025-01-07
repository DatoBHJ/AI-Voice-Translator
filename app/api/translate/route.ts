import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const { text, languages } = await req.json();

    if (!text || !languages || languages.length !== 2) {
      return NextResponse.json(
        { error: 'Missing required fields or invalid languages array' },
        { status: 400 }
      );
    }

    console.log('Translation request:', { text, languages });

    const prompt = `You are a professional translator for ${languages[0].name} and ${languages[1].name}.
First, determine if the input text is in ${languages[0].name} or ${languages[1].name}.
Then, translate the text to the other language while maintaining the original meaning and nuance.
Respond with only the translation, no explanations.

Text to translate: ${text}`;

    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
    });

    const translation = completion.choices[0]?.message?.content;
    if (!translation) {
      throw new Error('No translation received');
    }

    console.log('Translation:', translation);

    return NextResponse.json({ translation: translation.trim() });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to translate text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 