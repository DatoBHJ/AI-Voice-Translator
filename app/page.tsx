'use client';

import { useState, useCallback, useRef } from 'react';
import { LanguageSelector } from '@/components/language-selector';
import { MessageDisplay } from '@/components/message-display';
import { useAudioRecorder } from '@/hooks/use-audio';
import { Language } from '@/lib/types';
import { VoiceSettings, VoiceSettings as VoiceSettingsType } from '@/components/voice-settings';

interface Message {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
  sourceLang: string;
  targetLang: string;
}

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const processingRef = useRef(false);
  const [isInitialSetup, setIsInitialSetup] = useState(true);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>({
    silenceThreshold: -65,
    silenceTimeout: 800,
    smoothingTimeConstant: 0.92,
  });

  const resetState = useCallback(() => {
    setError(null);
  }, []);

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
                    if (translation) {  // 번역이 있을 때만 업데이트
                      setTranslatedText(translation);
                    }
                    resolve(translation);
                    return;
                  }

                  // Only try to parse if it's not the completion message
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      translation += parsed.content;
                      if (translation.trim()) {  // 의미 있는 번역이 있을 때만 업데이트
                        setTranslatedText(translation);
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing SSE message:', e);
                  }
                }
              }
            }
            if (translation) {  // 번역이 있을 때만 업데이트
              setTranslatedText(translation);
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
    if (processingRef.current) {
      return;
    }

    // Check if the audio is too short (less than 0.5 seconds)
    if (audioBlob.size < 15000) {  // Roughly 0.5s of audio at 128kbps
      console.log('Audio too short, ignoring');
      return;
    }

    try {
      processingRef.current = true;
      setIsProcessing(true);
      setError(null);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      if (isInitialSetup) {
        // Initial language setup phase
        const transcriptionResponse = await fetch('/api/speech', {
          method: 'POST',
          body: formData,
        });

        const transcriptionData = await transcriptionResponse.json();

        if (!transcriptionResponse.ok) {
          // Ignore quality check failures silently
          if (transcriptionData.error === 'Low quality speech detected' || 
              transcriptionData.error === 'No speech detected' ||
              transcriptionData.error === 'Transcription too short') {
            console.log('Ignoring low quality audio:', transcriptionData.error);
            return;
          }
          throw new Error(transcriptionData.details || transcriptionData.error || 'Failed to transcribe audio');
        }

        setTranscribedText(transcriptionData.text);

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
        setIsInitialSetup(false);
      } else {
        // Translation phase
        const transcriptionResponse = await fetch('/api/speech', {
          method: 'POST',
          body: formData,
        });

        const transcriptionData = await transcriptionResponse.json();

        if (!transcriptionResponse.ok) {
          // Ignore quality check failures silently
          if (transcriptionData.error === 'Low quality speech detected' || 
              transcriptionData.error === 'No speech detected' ||
              transcriptionData.error === 'Transcription too short') {
            console.log('Ignoring low quality audio:', transcriptionData.error);
            return;
          }
          throw new Error(transcriptionData.details || transcriptionData.error || 'Failed to transcribe audio');
        }

        setTranscribedText(transcriptionData.text);

        const translation = await translateText(transcriptionData.text, supportedLanguages);

        const newMessage: Message = {
          id: Date.now().toString(),
          originalText: transcriptionData.text,
          translatedText: translation,
          timestamp: Date.now(),
          sourceLang: transcriptionData.language,
          targetLang: supportedLanguages[1].code
        };

        setMessages(prev => [...prev, newMessage]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(message);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  const { startRecording, stopRecording, isRecording, startListening, stopListening, isListening } = useAudioRecorder({
    onRecordingComplete: processAudio,
    silenceThreshold: voiceSettings.silenceThreshold,
    silenceTimeout: voiceSettings.silenceTimeout,
  });

  return (
    <main className="flex min-h-screen flex-col items-center p-20 pt-12">
      <VoiceSettings
        currentSettings={voiceSettings}
        onSettingsChange={setVoiceSettings}
      />
      <div className="w-full max-w-md space-y-8">
        {isInitialSetup ? (
          // Language Selection Phase
          <LanguageSelector
            isRecording={isRecording}
            isListening={isListening}
            isProcessing={isProcessing}
            onRecordingStart={startRecording}
            onRecordingStop={stopRecording}
            onListeningStart={startListening}
            onListeningStop={stopListening}
            transcribedText={transcribedText}
            showWelcomeMessage={true}
          />
        ) : (
          // Translation Interface
          <>
            <div className="flex justify-center mb-16">
              <div className="inline-flex items-center gap-1.5 px-3 py-1">
                <span className="text-xs font-medium text-gray-600">{supportedLanguages[0].name}</span>
                <span className="text-gray-300 text-[10px] leading-none translate-y-px pb-1">⟷</span>
                <span className="text-xs font-medium text-gray-600">{supportedLanguages[1].name}</span>
              </div>
            </div>
            
            <LanguageSelector
              isRecording={isRecording}
              isListening={isListening}
              isProcessing={isProcessing}
              onRecordingStart={startRecording}
              onRecordingStop={stopRecording}
              onListeningStart={startListening}
              onListeningStop={stopListening}
              transcribedText={transcribedText}
              translatedText={translatedText}
            />

            <MessageDisplay 
              messages={messages} 
              currentLanguage={supportedLanguages[0].name}
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