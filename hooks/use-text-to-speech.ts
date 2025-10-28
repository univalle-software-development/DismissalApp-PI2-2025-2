"use client"

import * as React from "react"

export function useTextToSpeech() {
    const [isSpeaking, setIsSpeaking] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const audioRef = React.useRef<HTMLAudioElement | null>(null)

    const speak = React.useCallback(async (text: string) => {
        if (isSpeaking) return

        setIsSpeaking(true)
        setError(null)

        try {
            const response = await fetch('/api/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to fetch audio')
            }

            const data = await response.json()
            const audioContent = data.audioContent

            if (audioContent) {
                const audioSrc = `data:audio/mp3;base64,${audioContent}`
                if (audioRef.current) {
                    audioRef.current.pause()
                }
                const newAudio = new Audio(audioSrc)
                audioRef.current = newAudio
                newAudio.play()
                newAudio.onended = () => {
                    setIsSpeaking(false)
                }
            } else {
                throw new Error('No audio content received')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
            setError(errorMessage)
            setIsSpeaking(false)
        }
    }, [isSpeaking])

    return { speak, isSpeaking, error }
}
