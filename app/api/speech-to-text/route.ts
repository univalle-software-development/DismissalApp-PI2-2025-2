import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as Blob;

        if (!audioFile) {
            return NextResponse.json(
                { error: "No audio file provided" },
                { status: 400 }
            );
        }

        // Convert Blob to base64
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");

        // Call Google Cloud Speech-to-Text API
        const apiKey = process.env.GOOGLE_CLOUD_API_KEY;

        if (!apiKey) {
            console.error("GOOGLE_CLOUD_API_KEY is not set");
            return NextResponse.json(
                { error: "Speech-to-Text API is not configured" },
                { status: 500 }
            );
        }

        const response = await fetch(
            `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    config: {
                        encoding: "WEBM_OPUS",
                        sampleRateHertz: 48000,
                        languageCode: "es-ES", // Spanish
                        alternativeLanguageCodes: ["en-US"], // Fallback to English
                    },
                    audio: {
                        content: base64Audio,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Google Cloud API error:", errorData);
            return NextResponse.json(
                { error: "Failed to transcribe audio", details: errorData },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Extract transcription
        const transcription = data.results
            ?.map((result: any) => result.alternatives[0]?.transcript)
            .join(" ") || "";

        return NextResponse.json({ transcription });
    } catch (error: any) {
        console.error("Error in speech-to-text endpoint:", error);
        return NextResponse.json(
            { error: "Internal server error", message: error.message },
            { status: 500 }
        );
    }
}
