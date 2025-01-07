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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Translation failed');
      }

      return data.translation;
    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  }, []);

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setError(null);
      setTranscribedText('');
      setTranslatedText('');
      console.log('Processing audio...', { size: audioBlob.size, type: audioBlob.type });

      // Create form data for the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      // Send audio for transcription
      console.log('Sending audio for transcription...');
      const transcriptionResponse = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      const transcriptionData = await transcriptionResponse.json();
      console.log('Transcription response:', transcriptionData);

      if (!transcriptionResponse.ok) {
        throw new Error(transcriptionData.details || transcriptionData.error || 'Failed to transcribe audio');
      }

      console.log('Transcribed text:', transcriptionData.text);
      setTranscribedText(transcriptionData.text);

      if (supportedLanguages.length === 0) {
        // Initial language setup phase
        console.log('Detecting initial language pair...');
        const languageResponse = await fetch('/api/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: transcriptionData.text }),
        });

        const languageData = await languageResponse.json();
        console.log('Language detection response:', languageData);

        if (!languageResponse.ok) {
          throw new Error(languageData.error || 'Failed to detect languages');
        }

        console.log('Setting up supported languages:', languageData);
        setSupportedLanguages([
          languageData.sourceLanguage,
          languageData.targetLanguage
        ]);
      } else {
        // Translation phase
        const translation = await translateText(
          transcriptionData.text,
          supportedLanguages
        );

        setTranslatedText(translation);

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
      console.error('Error processing audio:', message);
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
