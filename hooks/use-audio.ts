import { useState, useCallback, useRef } from 'react';

interface UseAudioRecorderProps {
  onRecordingComplete: (blob: Blob) => Promise<void>;
}

export function useAudioRecorder({ onRecordingComplete }: UseAudioRecorderProps) {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioChunksRef = useRef<Blob[]>([]);
  const isProcessingRef = useRef(false);

  const cleanup = useCallback(() => {
    if (mediaRecorder?.stream) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setMediaRecorder(null);
    audioChunksRef.current = [];
    isProcessingRef.current = false;
  }, [mediaRecorder]);

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('Found supported MIME type:', type);
        return type;
      }
    }

    throw new Error('No supported audio MIME type found');
  };

  const startRecording = useCallback(async () => {
    // Prevent multiple starts
    if (isProcessingRef.current || isRecording) {
      console.log('Recording already in progress');
      return;
    }

    try {
      isProcessingRef.current = true;
      console.log('Starting recording...');
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported');
      }

      // Reset audio chunks
      audioChunksRef.current = [];

      // Check if we're on HTTPS
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        throw new Error('Recording requires HTTPS (except on localhost)');
      }

      // Request audio permission with constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      console.log('Requesting audio permission...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got audio stream');

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error('MediaRecorder not supported');
      }

      // Get supported MIME type
      const mimeType = getSupportedMimeType();
      console.log('Using MIME type:', mimeType);

      // Create new MediaRecorder instance
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
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
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          console.log('Audio blob created:', audioBlob.size, 'bytes');
          
          try {
            await onRecordingComplete(audioBlob);
          } catch (error) {
            console.error('Error processing recording:', error);
          }
          
          audioChunksRef.current = [];
        } else {
          console.error('No audio data recorded');
        }
        
        cleanup();
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        cleanup();
      };

      // Start recording and request data every 500ms
      recorder.start(500);
      console.log('Recorder started');
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if ('constraint' in error) {
          console.error('Constraint error:', (error as any).constraint);
        }
      }
      cleanup();
      throw error;
    } finally {
      isProcessingRef.current = false;
    }
  }, [onRecordingComplete, cleanup, isRecording]);

  const stopRecording = useCallback(() => {
    // Prevent multiple stops
    if (isProcessingRef.current) {
      console.log('Already processing stop request');
      return;
    }

    console.log('Stopping recording...');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      isProcessingRef.current = true;
      try {
        mediaRecorder.stop();
      } catch (error) {
        console.error('Error stopping recording:', error);
        cleanup();
      }
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