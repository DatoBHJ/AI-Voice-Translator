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
  currentLanguage: string;
}

export function MessageDisplay({ messages, currentLanguage }: MessageDisplayProps) {
  // Sort messages by timestamp
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  const formatMessageDate = (timestamp: number) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === messageDate.toDateString();
    const isThisYear = messageDate.getFullYear() === now.getFullYear();

    const timeStr = messageDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();

    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `Yesterday ${timeStr}`;
    } else if (isThisYear) {
      return messageDate.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).toLowerCase();
    } else {
      return messageDate.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).toLowerCase();
    }
  };

  return (
    <div className="w-full space-y-2 px-2 py-4 bg-white">
      {sortedMessages.map((message, index) => {
        const isSentByUser = message.sourceLang === currentLanguage;
        const showTimestamp = index === sortedMessages.length - 1 || 
          new Date(sortedMessages[index + 1]?.timestamp).getTime() - new Date(message.timestamp).getTime() > 60000;
        
        const nextMessage = sortedMessages[index + 1];
        const isNextMessageDifferentSender = nextMessage && 
          (nextMessage.sourceLang === currentLanguage) !== isSentByUser;

        return (
          <div key={message.id} 
            className={`${isNextMessageDifferentSender ? 'mb-6' : 'mb-2'}`}
          >
            {showTimestamp && (
              <div className="flex justify-center my-4">
                <span className="text-[9px] tracking-[0.1em] uppercase text-neutral-400 font-light">
                  {formatMessageDate(message.timestamp)}
                </span>
              </div>
            )}
            <div className={`flex ${isSentByUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`relative max-w-[255px] ${isSentByUser ? 'send-bubble' : 'receive-bubble'}`}>
                <p className="text-[15px] font-medium leading-[1.3]">
                  {message.originalText}
                </p>
                <p className={`
                  text-[15px] font-light leading-[1.3] mt-2
                  ${isSentByUser ? 'text-blue-50/90' : 'text-gray-600/90'}
                `}>
                  {message.translatedText}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 