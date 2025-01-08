import { Button } from './ui/button';
import { Mic, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100); // 100px 이상 스크롤되면 투명도 적용
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-[60vh] bg-white">
      {/* Content area */}
      {/* <div className="pb-10"> */}
        {/* Welcome Message at top */}
        {showWelcomeMessage && (
          <div className="text-gray-500 text-center space-y-0.5 text-sm pt-20">
            <p>"English and Japanese"</p>
            <p>"한국어랑 스페인어"</p>
            <p>"Français et 中文"</p>
            <p>Deutsch und العربية</p>
          </div>
        )}

        {/* Text display */}
        {transcribedText && !isRecording && !isProcessing && (
          <div className="text-center mt-10">
            <p className="text-lg text-gray-900">
              "{transcribedText}"
              {translatedText && (
                <span className="text-gray-600 italic">
                  {" "}<br /><br />({translatedText})
                </span>
              )}
            </p>
          </div>
        )}
      {/* </div> */}

      {/* Fixed position container for button and status */}
      <div className={`
        fixed bottom-28 left-0 right-0 h-32 bg-transparent 
        flex flex-col items-center justify-center
        transition-opacity duration-300 ease-in-out
        ${isScrolled ? 'opacity-50' : 'opacity-100'}
      `}>
        {/* Recording button */}
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
          onClick={isRecording ? onRecordingStop : onRecordingStart}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-10 h-10 text-gray-500 animate-spin" />
          ) : (
            <Mic className={`w-10 h-10 ${isRecording ? 'text-red-500' : 'text-gray-500'}`} />
          )}
        </Button>

        {/* Status text - with fixed height */}
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