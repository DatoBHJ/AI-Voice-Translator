interface Message {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

interface MessageDisplayProps {
  messages: Message[];
}

export function MessageDisplay({ messages }: MessageDisplayProps) {
  return (
    <div className="w-full space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className="p-4 bg-white rounded-lg shadow-sm border border-gray-100"
        >
          <div className="space-y-2">
            <p className="text-gray-900">{message.originalText}</p>
            <p className="text-gray-600 italic">({message.translatedText})</p>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
} 