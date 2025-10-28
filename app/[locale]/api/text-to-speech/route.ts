// app/[locale]/api/text-to-speech/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TTSBody = {
  text: string;
  languageCode?: string; // e.g., "es-ES" | "en-US"
  voiceName?: string; // e.g., "es-ES-Standard-A"
  speakingRate?: number; // 0.25–4.0 (1.0 default)
  pitch?: number; // -20.0 to 20.0 (0 default)
  audioEncoding?: "MP3" | "OGG_OPUS" | "LINEAR16";
};

/**
 * Synthesizes speech via Google Cloud Text-to-Speech using API key auth.
 * Mirrors the style used by speech-to-text: simple fetch with `?key=...`.
 */
export async function POST(
  request: NextRequest,
  context: { params: { locale: string } }
) {
  try {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_CLOUD_API_KEY is not set");
      return NextResponse.json(
        { error: "Text-to-Speech API is not configured" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as TTSBody;
    const text = (body?.text ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Missing 'text' in request body" },
        { status: 400 }
      );
    }

    const locale = context?.params?.locale || "en";
    const defaultLanguage = locale.toLowerCase().startsWith("es")
      ? "es-ES"
      : "en-US";

    const languageCode = body.languageCode || defaultLanguage;
    const voiceName = body.voiceName; // optional
    const audioEncoding = body.audioEncoding || "MP3";
    const speakingRate =
      typeof body.speakingRate === "number" ? body.speakingRate : 1.0;
    const pitch = typeof body.pitch === "number" ? body.pitch : 0;

    console.log("TTS request:", {
      textLength: text.length,
      languageCode,
      voiceName,
      audioEncoding,
      speakingRate,
      pitch,
    });

    // Call Google Cloud Text-to-Speech API using API key (similar to STT route)
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode,
            name: voiceName, // let Google choose default if not provided
          },
          audioConfig: {
            audioEncoding, // "MP3" | "OGG_OPUS" | "LINEAR16"
            speakingRate,
            pitch,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text().catch(() => "");
      console.error("Google TTS API error:", errorData || response.statusText);
      return NextResponse.json(
        { error: "Failed to synthesize speech" },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) {
      console.error("Google TTS returned no audio content");
      return NextResponse.json(
        { error: "Empty audio from TTS" },
        { status: 502 }
      );
    }

    const audioBuffer = Buffer.from(data.audioContent, "base64");
    const contentType =
      audioEncoding === "MP3"
        ? "audio/mpeg"
        : audioEncoding === "OGG_OPUS"
        ? "audio/ogg"
        : "audio/wav"; // LINEAR16

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Error in text-to-speech endpoint:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Internal server error", message },
      { status: 500 }
    );
  }
}
