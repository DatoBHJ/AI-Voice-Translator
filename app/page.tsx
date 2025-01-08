'use client';

import { useState, useCallback } from 'react';
import { LanguageSelector } from '@/components/language-selector';
import { MessageDisplay } from '@/components/message-display';
import { useAudioRecorder } from '@/hooks/use-audio';
import { Language } from '@/lib/types';

interface Message {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
}

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);

  const translateText = useCallback(async (text: string, languages: Language[]) => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          languages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Translation failed');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Create a new promise that will resolve with the full translation
      return new Promise<string>((resolve, reject) => {
        let translation = '';
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        async function readStream() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Decode the stream chunk and split into SSE messages
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(5).trim();
                  
                  // Check for the completion message
                  if (data === '[DONE]') {
                    resolve(translation);
                    return;
                  }

                  // Only try to parse if it's not the completion message
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      translation += parsed.content;
                      setTranslatedText(translation);
                    }
                  } catch (e) {
                    console.error('Error parsing SSE message:', e);
                  }
                }
              }
            }
            resolve(translation);
          } catch (error) {
            reject(error);
          }
        }

        readStream();
      });
    } catch (error) {
      throw error;
    }
  }, [setTranslatedText]);

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setError(null);
      setTranscribedText('');
      setTranslatedText('');

      // Create form data for the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      // Send audio for transcription
      const transcriptionResponse = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      const transcriptionData = await transcriptionResponse.json();

      if (!transcriptionResponse.ok) {
        throw new Error(transcriptionData.details || transcriptionData.error || 'Failed to transcribe audio');
      }

      setTranscribedText(transcriptionData.text);

      if (supportedLanguages.length === 0) {
        // Initial language setup phase
        const languageResponse = await fetch('/api/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: transcriptionData.text }),
        });

        const languageData = await languageResponse.json();

        if (!languageResponse.ok) {
          throw new Error(languageData.error || 'Failed to detect languages');
        }

        setSupportedLanguages([
          languageData.sourceLanguage,
          languageData.targetLanguage
        ]);
      } else {
        // Translation phase
        setIsProcessing(true);
        const translation = await translateText(
          transcriptionData.text,
          supportedLanguages
        );

        // Add the message to the conversation
        const newMessage: Message = {
          id: Date.now().toString(),
          originalText: transcriptionData.text,
          translatedText: translation,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newMessage]);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const { startRecording, stopRecording, isRecording } = useAudioRecorder({
    onRecordingComplete: processAudio,
  });

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="w-full max-w-md space-y-8">
        {supportedLanguages.length === 0 ? (
          // Language Selection Phase
          <LanguageSelector
            isRecording={isRecording}
            isProcessing={isProcessing}
            onRecordingStart={startRecording}
            onRecordingStop={stopRecording}
            transcribedText={transcribedText}
            showWelcomeMessage={true}
          />
        ) : (
          // Translation Interface
          <>
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500">
                Translating between {supportedLanguages[0].name} and {supportedLanguages[1].name}
              </p>
            </div>
            
            <LanguageSelector
              isRecording={isRecording}
              isProcessing={isProcessing}
              onRecordingStart={startRecording}
              onRecordingStop={stopRecording}
              transcribedText={transcribedText}
              translatedText={translatedText}
            />

            <MessageDisplay 
              messages={messages.map(msg => ({
                ...msg,
                sourceLang: supportedLanguages[0].code,
                targetLang: supportedLanguages[1].code
              }))} 
            />
          </>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
