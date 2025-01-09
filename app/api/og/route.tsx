import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            padding: '40px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              marginBottom: '20px',
            }}
          >
            🌐
          </div>
          <div
            style={{
              fontSize: 50,
              fontWeight: 900,
              letterSpacing: '-0.025em',
              color: '#ffffff',
              marginBottom: '16px',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            Real-Time AI Translation
          </div>
          <div
            style={{
              fontSize: 26,
              color: '#888888',
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            Seamless communication across languages
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'cache-control': 'public, max-age=31536000, immutable',
          'content-type': 'image/png',
        },
      },
    );
  } catch (e) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
} 