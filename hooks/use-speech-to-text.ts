import { useState, useRef, useCallback } from "react";

interface UseSpeechToTextReturn {
    isRecording: boolean;
    isTranscribing: boolean;
    transcript: string;
    error: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    resetTranscript: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 48000,
                }
            });

            // Create MediaRecorder
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
            });

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Create blob from recorded chunks
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: "audio/webm;codecs=opus",
                });

                // Send to API for transcription
                await transcribeAudio(audioBlob);

                // Stop all tracks
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsRecording(true);

            console.log("Recording started");
        } catch (err: any) {
            console.error("Error starting recording:", err);
            setError(err.message || "Failed to start recording");
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            console.log("Recording stopped");
        }
    }, [isRecording]);

    const transcribeAudio = async (audioBlob: Blob) => {
        try {
            setIsTranscribing(true);
            console.log("Sending audio for transcription...");

            const formData = new FormData();
            formData.append("audio", audioBlob);

            const response = await fetch("/api/speech-to-text", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Transcription failed");
            }

            const data = await response.json();
            console.log("Transcription result:", data);

            if (data.transcription) {
                setTranscript(data.transcription);
            } else {
                setError("No transcription returned");
            }
        } catch (err: any) {
            console.error("Error transcribing audio:", err);
            setError(err.message || "Failed to transcribe audio");
        } finally {
            setIsTranscribing(false);
        }
    };

    const resetTranscript = useCallback(() => {
        setTranscript("");
        setError(null);
    }, []);

    return {
        isRecording,
        isTranscribing,
        transcript,
        error,
        startRecording,
        stopRecording,
        resetTranscript,
    };
}
