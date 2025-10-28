"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type TTSOptions = {
  languageCode?: string
  voiceName?: string
  speakingRate?: number
  pitch?: number
  audioEncoding?: "MP3" | "OGG_OPUS" | "LINEAR16"
}

type QueueItem = { text: string; opts?: TTSOptions }

function buildApiPath(slug: string) {
  if (typeof window === "undefined") return `/api/${slug}`
  const parts = window.location.pathname.split("/").filter(Boolean)
  const seg = parts[0]
  if (seg && seg !== "api") return `/${seg}/api/${slug}`
  return `/api/${slug}`
}

export function useTextToSpeech(defaults?: TTSOptions) {
  const [enabled, setEnabled] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const queueRef = useRef<QueueItem[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef(false)
  const enabledRef = useRef(true)

  useEffect(() => {
    enabledRef.current = enabled
    if (enabled && !playingRef.current) {
      void playNext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const playNext = useCallback(async () => {
    if (playingRef.current) return
    if (!enabledRef.current) return
    const next = queueRef.current.shift()
    if (!next) return

    playingRef.current = true
    setIsPlaying(true)

    const apiPath = buildApiPath("text-to-speech")

    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next.text, ...(defaults || {}), ...(next.opts || {}) }),
      })

      if (!res.ok) throw new Error("TTS request failed")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        playingRef.current = false
        setIsPlaying(false)
        void playNext()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        playingRef.current = false
        setIsPlaying(false)
        void playNext()
      }

      try {
        await audio.play()
      } catch (err) {
        URL.revokeObjectURL(url)
        audioRef.current = null
        // Optional fallback to Web Speech API
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            const u = new SpeechSynthesisUtterance(next.text)
            const lang = (next.opts?.languageCode || defaults?.languageCode) ??
              (navigator.language?.toLowerCase().startsWith("es") ? "es-ES" : "en-US")
            u.lang = lang
            u.onend = () => {
              playingRef.current = false
              setIsPlaying(false)
              void playNext()
            }
            u.onerror = () => {
              playingRef.current = false
              setIsPlaying(false)
              void playNext()
            }
            window.speechSynthesis.speak(u)
            return
          } catch {
            // ignore
          }
        }
        playingRef.current = false
        setIsPlaying(false)
        void playNext()
      }
    } catch {
      playingRef.current = false
      setIsPlaying(false)
      void playNext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults])

  const enqueue = useCallback((text: string, opts?: TTSOptions) => {
    if (!text || !text.trim()) return
    queueRef.current.push({ text: text.trim(), opts })
    if (enabledRef.current && !playingRef.current) {
      void playNext()
    }
  }, [playNext])

  const clearQueue = useCallback(() => {
    queueRef.current = []
  }, [])

  const stop = useCallback(() => {
    try {
      audioRef.current?.pause()
      if (audioRef.current) {
        audioRef.current.src = ""
      }
    } finally {
      audioRef.current = null
      playingRef.current = false
      setIsPlaying(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause()
        if (audioRef.current) {
          audioRef.current.src = ""
        }
      } finally {
        audioRef.current = null
      }
    }
  }, [])

  return { enqueue, enabled, setEnabled, isPlaying, clearQueue, stop }
}
