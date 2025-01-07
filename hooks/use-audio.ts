import { useState, useCallback, useRef } from 'react';

interface UseAudioRecorderProps {
  onRecordingComplete: (blob: Blob) => Promise<void>;
}

export function useAudioRecorder({ onRecordingComplete }: UseAudioRecorderProps) {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioChunksRef = useRef<Blob[]>([]);

  const cleanup = useCallback(() => {
    if (mediaRecorder?.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setMediaRecorder(null);
  }, [mediaRecorder]);

  const startRecording = useCallback(async () => {
    try {
      console.log('Starting recording...');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Got audio stream');

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Received audio chunk:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        console.log('Recording stopped');
        setIsRecording(false);
        
        if (audioChunksRef.current.length > 0) {
          console.log('Creating audio blob from', audioChunksRef.current.length, 'chunks');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          console.log('Audio blob created:', audioBlob.size, 'bytes');
          await onRecordingComplete(audioBlob);
          audioChunksRef.current = [];
        } else {
          console.error('No audio data recorded');
        }
        
        cleanup();
      };

      // Start recording and request data every 500ms
      recorder.start(500);
      console.log('Recorder started');
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      cleanup();
    }
  }, [onRecordingComplete, cleanup]);

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      cleanup();
    }
  }, [mediaRecorder, cleanup]);

  return {
    startRecording,
    stopRecording,
    isRecording,
  };
} 