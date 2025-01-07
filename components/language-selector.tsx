import { Button } from './ui/button';
import { Mic, Loader2 } from 'lucide-react';

interface LanguageSelectorProps {
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  isRecording: boolean;
  isProcessing?: boolean;
  transcribedText?: string;
  translatedText?: string;
}

export function LanguageSelector({
  onRecordingStart,
  onRecordingStop,
  isRecording,
  isProcessing = false,
  transcribedText,
  translatedText
}: LanguageSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white">
      {/* Text display */}
      {transcribedText && !isRecording && !isProcessing && (
        <div className="mb-8 text-center">
          <p className="text-lg text-gray-900">
            "{transcribedText}"
            {translatedText && (
              <span className="text-gray-600 italic">
                {" "}({translatedText})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Recording button */}
      <Button
        variant="outline"
        size="lg"
        className={`
          w-32 h-32 rounded-full border-4 
          ${isRecording ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'}
          transition-all duration-200 ease-in-out
          hover:scale-105 active:scale-95
          flex items-center justify-center
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={isRecording ? onRecordingStop : onRecordingStart}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <Loader2 className="w-12 h-12 text-gray-500 animate-spin" />
        ) : (
          <Mic className={`w-12 h-12 ${isRecording ? 'text-red-500' : 'text-gray-500'}`} />
        )}
      </Button>

      {/* Status text */}
      <p className="mt-6 text-gray-500 text-center">
        {isProcessing 
          ? "Processing your speech..."
          : isRecording 
            ? "Recording... Click to stop"
            : "Press the circle to speak"}
      </p>
    </div>
  );
} 