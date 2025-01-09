import { Button } from './ui/button';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface LanguageSelectorProps {
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isProcessing?: boolean;
  transcribedText?: string;
  translatedText?: string;
  showWelcomeMessage?: boolean;
}

export function LanguageSelector({
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isProcessing = false,
  transcribedText,
  translatedText,
  showWelcomeMessage = false
}: LanguageSelectorProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsPlaying(false);
  };

  const playTranslatedText = async () => {
    if (!translatedText || isPlaying) return;
    
    try {
      setIsPlaying(true);
      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: translatedText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        cleanupAudio();
      };

      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      cleanupAudio();
    }
  };

  const handleRecordingStart = () => {
    cleanupAudio();
    onRecordingStart();
  };

  return (
    <div className="relative min-h-[60vh] bg-white">
      {showWelcomeMessage && (
        <div className="text-gray-500 text-center space-y-0.5 text-sm pt-20">
          <p>"English and Japanese"</p>
          <p>"한국어랑 스페인어"</p>
          <p>"Français et 中文"</p>
          <p>Deutsch und العربية</p>
          <br /> 
          <p className="text-gray-300 mt-2">name two languages</p>
        </div>
      )}

      {transcribedText && !isRecording && (
        <div className="text-center mt-10 space-y-4">
          <p className="text-lg text-gray-900">
            "{transcribedText}"
          </p>
          {translatedText && (
            <div className="flex flex-col items-center">
              <button
                onClick={playTranslatedText}
                disabled={isPlaying}
                className="group hover:bg-gray-50 px-4 pt-2 rounded-lg transition-colors duration-200"
                aria-label="Play translation"
              >
                <p className="text-gray-600 italic group-hover:text-gray-800">
                  ({translatedText})
                </p>
              </button>
              <button
                onClick={playTranslatedText}
                disabled={isPlaying}
                className={`
                  w-8 h-8 rounded-full
                  flex items-center justify-center
                  hover:bg-gray-100 transition-colors duration-200
                  ${isPlaying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                aria-label="Play translation"
              >
                <Volume2 className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className={`
        fixed bottom-28 left-0 right-0 h-32 bg-transparent 
        flex flex-col items-center justify-center
        transition-opacity duration-300 ease-in-out
        ${isScrolled ? 'opacity-50' : 'opacity-100'}
      `}>
        <Button
          variant="outline"
          size="lg"
          className={`
            w-24 h-24 aspect-square rounded-full border-4 
            ${isRecording ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}
            transition-colors duration-200 ease-in-out
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            shadow-lg
          `}
          onClick={isRecording ? onRecordingStop : handleRecordingStart}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-gray-500 animate-spin" />
          ) : (
            <Mic className={`w-10 h-10 ${isRecording ? 'text-red-500' : 'text-gray-500'}`} />
          )}
        </Button>

        <div className="h-6 text-gray-500 text-center text-sm mt-4">
          {isProcessing 
            ? "Processing your speech..."
            : isRecording 
              ? "Recording... Click to stop"
              : "\u00A0"}
        </div>
      </div>
    </div>
  );
} 