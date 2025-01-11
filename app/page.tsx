'use client';

import { useState, useCallback, useRef } from 'react';
import { LanguageSelector } from '@/components/language-selector';
import { MessageDisplay } from '@/components/message-display';
import { useAudioRecorder } from '@/hooks/use-audio';
import { Language } from '@/lib/types';
import { VoiceSettings, VoiceSettings as VoiceSettingsType, defaultVoiceSettings } from '@/components/voice-settings';
import { Button } from '@/components/ui/button';

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
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>(defaultVoiceSettings);
  const [currentMode, setCurrentMode] = useState("Quiet Room");
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);

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
                    if (translation) {
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
                      setTranslatedText(translation);
                    }
                  } catch (e) {
                    console.error('Error parsing SSE message:', e);
                  }
                }
              }
            }
            if (translation) {
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
        formData.append('languages', JSON.stringify(supportedLanguages));
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

  const handleVoiceSettingsChange = (newSettings: VoiceSettingsType) => {
    setVoiceSettings(newSettings);
    
    // Define preset values
    const presets = {
      quiet: {
        silenceThreshold: -58,
        silenceTimeout: 800,
        smoothingTimeConstant: 0.75
      },
      moderate: {
        silenceThreshold: -52,
        silenceTimeout: 1000,
        smoothingTimeConstant: 0.8
      },
      street: {
        silenceThreshold: -45,
        silenceTimeout: 1200,
        smoothingTimeConstant: 0.85
      }
    };

    // Find matching preset
    if (JSON.stringify(newSettings) === JSON.stringify(presets.quiet)) {
      setCurrentMode("Quiet Room");
    } else if (JSON.stringify(newSettings) === JSON.stringify(presets.moderate)) {
      setCurrentMode("Coffee Shop");
    } else {
      setCurrentMode("Street");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-10 pb-20 pt-12">
      <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-6 bg-white z-50">
        <Button
          variant="ghost"
          className={`
            h-auto py-2 px-4 hover:bg-transparent relative
            after:content-[''] after:absolute after:bottom-0 after:left-0 
            after:w-full after:h-[1px] after:bg-neutral-900
            after:scale-x-0 after:origin-left after:transition-transform
            ${isTTSEnabled ? 'after:scale-x-100' : 'after:scale-x-0'}
          `}
          onClick={() => setIsTTSEnabled(!isTTSEnabled)}
        >
          <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-900 font-light">
            {isTTSEnabled ? "Voice" : "Muted"}
          </div>
        </Button>
        <VoiceSettings
          currentSettings={voiceSettings}
          onSettingsChange={handleVoiceSettingsChange}
        />
      </div>
      <div className="w-full max-w-md space-y-8 mt-8">
        {isInitialSetup ? (
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
            currentMode={currentMode}
            isTTSEnabled={isTTSEnabled}
          />
        ) : (
          <>
            <div className="flex justify-center mb-16">
              <div className="inline-flex items-center gap-4 py-1">
                <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-900 font-light">
                  {supportedLanguages[0].name}
                </span>
                <span className="text-[8px] tracking-[0.2em] text-neutral-400 font-light">⟷</span>
                <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-900 font-light">
                  {supportedLanguages[1].name}
                </span>
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
              currentMode={currentMode}
              isTTSEnabled={isTTSEnabled}
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