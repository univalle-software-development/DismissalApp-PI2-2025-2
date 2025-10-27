import { useState, useRef, useCallback } from "react";

// Define the new command structure
interface ParsedCommand {
    carNumber: number;
    lane: 'left' | 'right';
}

interface UseSpeechToTextReturn {
    isRecording: boolean;
    isTranscribing: boolean;
    command: ParsedCommand | null; // <-- CHANGED
    error: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    resetCommand: () => void; // <-- RENAMED
}

export function useSpeechToText(): UseSpeechToTextReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [command, setCommand] = useState<ParsedCommand | null>(null); // <-- CHANGED
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setCommand(null); // <-- ADDED: Reset command on new recording

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

                console.log("Audio blob size (bytes):", audioBlob.size);

                if (audioBlob.size > 1000) {
                    await transcribeAudio(audioBlob);
                } else {
                    console.warn("Audio blob is too small, not sending to API.");
                    setError("Recording was too short or silent.");
                }

                // Send to API for transcription and parsing
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
            setCommand(null); // <-- ADDED
            setError(null);   // <-- ADDED
            console.log("Sending audio for parsing...");

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
            console.log("Parsed command:", data);

            if (data.command) {
                setCommand(data.command); // <-- CHANGED
            } else if (data.error) {
                 setError(data.error);
            }
             else {
                setError("No command was returned");
            }
        } catch (err: any) {
            console.error("Error in transcribeAudio:", err);
            setError(err.message || "Failed to parse command");
        } finally {
            setIsTranscribing(false);
        }
    };

    const resetCommand = useCallback(() => { // <-- RENAMED
        setCommand(null); // <-- CHANGED
        setError(null);
    }, []);

    return {
        isRecording,
        isTranscribing,
        command, // <-- CHANGED
        error,
        startRecording,
        stopRecording,
        resetCommand, // <-- RENAMED
    };
}