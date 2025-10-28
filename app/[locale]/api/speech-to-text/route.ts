// app/api/speech-to-text/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Step 1: Transcribe Audio using Google Cloud Speech-to-Text
 */
async function transcribeWithGoogle(audioBlob: Blob): Promise<string> {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_CLOUD_API_KEY is not set");
        throw new Error("Speech-to-Text API is not configured");
    }

    // Convert Blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    console.log("Received audio blob size (bytes):", audioBlob.size);

    const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                config: {
                    encoding: "WEBM_OPUS",
                    sampleRateHertz: 48000,
                    languageCode: "es-ES", // Primary language
                    alternativeLanguageCodes: ["en-US"], // Fallback
                },
                audio: { content: base64Audio },
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Google Cloud API error:", errorData);
        throw new Error("Failed to transcribe audio");
    }

    const data = await response.json();

    console.log("Raw Google API response:", JSON.stringify(data, null, 2));

    type GoogleSpeechResult = {
        alternatives?: { transcript?: string }[];
    };

    const transcription =
        (data.results as GoogleSpeechResult[] | undefined)
            ?.map((result) => result.alternatives?.[0]?.transcript ?? "")
            .filter(Boolean)
            .join(" ") || "";

    return transcription;
}

/**
 * Step 2: Parse Transcription with OpenAI (The "Agent")
 */
async function parseCommandWithOpenAI(transcription: string) {
    if (!transcription.trim()) {
        throw new Error("No transcription to parse");
    }

    const tool = {
        type: "function",
        function: {
            name: "add_car_to_queue",
            description: "Adds a car to the specified dismissal lane.",
            parameters: {
                type: "object",
                properties: {
                    carNumber: {
                        type: "number",
                        description: "The numeric identifier for the car, e.g., 123.",
                    },
                    lane: {
                        type: "string",
                        enum: ["left", "right"],
                        description: "The lane to add the car to. 'left' (izquierda) or 'right' (derecha).",
                    },
                },
                required: ["carNumber", "lane"],
            },
        },
    } as const; // Use 'as const' for precise type inference

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5-nano", // Fast, effective, and cheap
            messages: [
                {
                    role: "system",
                    content: "You are an assistant for a school dismissal system. Parse the user's voice command to identify the car number and the intended lane (left or right). The user might speak in Spanish or English. 'Izquierda' means 'left', 'derecha' means 'right'.",
                },
                {
                    role: "user",
                    content: transcription,
                },
            ],
            tools: [tool],
            tool_choice: { type: "function", function: { name: tool.function.name } },
        });

        const toolCall = response.choices[0]?.message?.tool_calls?.[0];

        if (toolCall) {
            try {
                // Define a narrow runtime type for the tool call shape we expect and avoid using `any`.
                type ToolCallShape = {
                    arguments?: string;
                    function?: { arguments?: string };
                    [key: string]: unknown;
                };

                const tc = toolCall as unknown as ToolCallShape;
                // Arguments may be available as `arguments` or nested under `function.arguments` depending on the SDK/runtime.
                const rawArgs = tc.arguments ?? tc.function?.arguments;
                if (rawArgs) {
                    const args = JSON.parse(rawArgs);
                    // Validate the parsed arguments
                    if (args.carNumber && (args.lane === 'left' || args.lane === 'right')) {
                        return {
                            carNumber: Number(args.carNumber),
                            lane: args.lane as 'left' | 'right',
                        };
                    }
                }
            } catch (err) {
                console.error("Failed to parse tool call arguments:", err);
            }
        }
        
        // If no tool call was made or args are invalid
        throw new Error("Could not understand the car number or lane from the command.");

    } catch (error) {
        console.error("OpenAI parsing error:", error);
        throw new Error("AI failed to parse command.");
    }
}

/**
 * Main POST Handler
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get("audio") as Blob;

        if (!audioFile || audioFile.size < 100) { 
            console.warn("Received empty or tiny audio file.");
            return NextResponse.json(
                { error: "No audio file provided or file is empty" },
                { status: 400 }
            );
        }

        // Step 1: Get transcription
        const transcription = await transcribeWithGoogle(audioFile);
        console.log("Transcription:", transcription);

        // Step 2: Get command from "agent"
        const command = await parseCommandWithOpenAI(transcription);
        console.log("Parsed Command:", command);

        // Return the structured command
        return NextResponse.json({ command });

    } catch (error: unknown) {
        console.error("Error in speech-to-text endpoint:", error);
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: "Internal server error", message },
            { status: 500 }
        );
    }
}