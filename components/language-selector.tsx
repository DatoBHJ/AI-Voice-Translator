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
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset transcription display when recording starts or processing state changes
  useEffect(() => {
    if (isRecording || isProcessing) {
      setShowTranscription(false);
    } else if (transcribedText && !isRecording && !isProcessing) {
      setShowTranscription(true);
    }
  }, [isRecording, isProcessing, transcribedText]);

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
    // Abort any ongoing fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cleanup audio element
    if (audioRef.current) {
      const audio = audioRef.current;
      
      // Remove all event listeners
      audio.oncanplaythrough = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onloadstart = null;
      audio.onloadeddata = null;
      
      // Stop and cleanup
      audio.pause();
      audio.currentTime = 0;
      audio.src = ''; // Clear source
      audio.load(); // Reset audio element
      audioRef.current = null;
    }

    // Cleanup URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  const handleRecordingStart = () => {
    // If there's any audio playing, stop it immediately
    if (isPlaying || isLoadingAudio) {
      cleanupAudio();
    }
    
    // Start recording immediately
    onRecordingStart();
  };

  const playTranslatedText = async () => {
    if (!translatedText || isPlaying || isLoadingAudio || isRecording || isProcessing) return;
    
    try {
      cleanupAudio(); // Cleanup any existing audio first
      setIsLoadingAudio(true);
      
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: translatedText,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      
      // Verify blob is audio
      if (!audioBlob.type.startsWith('audio/')) {
        throw new Error(`Invalid audio format: ${audioBlob.type}`);
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      
      const audio = new Audio();
      
      // Set up audio event handlers before setting source
      audio.oncanplaythrough = () => {
        setIsLoadingAudio(false);
        setIsPlaying(true);
      };
      
      audio.onended = () => {
        cleanupAudio();
      };
      
      audio.onerror = () => {
        console.error('Audio playback error:', {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState,
          currentSrc: audio.currentSrc,
        });
        cleanupAudio();
      };

      // Only store the audio reference after all event handlers are set
      audioRef.current = audio;
      
      // Set source and load
      audio.src = audioUrl;
      
      try {
        await audio.play();
      } catch (playError) {
        console.error('Audio play failed:', playError);
        cleanupAudio();
        throw playError;
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Audio fetch aborted');
      } else {
        console.error('Failed to play audio:', error);
      }
      cleanupAudio();
    }
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

      {showTranscription && (
        <div className="text-center mt-10 space-y-4">
          <p className="text-sm text-gray-500">
            "{transcribedText}"
          </p>
          {translatedText && !isRecording && !isProcessing && (
            <div className="flex flex-col items-center">
              <div className="space-y-2">
                <p className="text-xl font-medium text-gray-900">
                  {translatedText}
                </p>
                <button
                  onClick={playTranslatedText}
                  disabled={isPlaying || isLoadingAudio || isRecording || isProcessing}
                  className={`
                    w-10 h-10 rounded-full mx-auto
                    flex items-center justify-center
                    transition-all duration-200 bg-gray-50
                    ${(isPlaying || isLoadingAudio || isRecording || isProcessing) 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:bg-gray-100 cursor-pointer'}
                  `}
                  aria-label="Play translation"
                >
                  <Volume2 className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`
        fixed bottom-28 left-0 right-0 h-32 bg-transparent 
        flex flex-col items-center justify-center
        transition-opacity duration-300 ease-in-out
        ${isScrolled ? 'opacity-0' : 'opacity-100'}
      `}>
        <Button
          variant="outline"
          size="lg"
          className={`
            w-24 h-24 min-w-[96px] min-h-[96px] max-w-[96px] max-h-[96px] rounded-full border-4 
            ${isRecording ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}
            transition-all duration-200 ease-in-out
            ${(isProcessing || isPlaying || isLoadingAudio) ? 'opacity-50 cursor-not-allowed' : ''}
            shadow-lg
          `}
          onClick={isRecording ? onRecordingStop : handleRecordingStart}
          disabled={isProcessing || isPlaying || isLoadingAudio}
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