import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { VALID_MODELS, DEFAULT_MODEL } from "@/convex/modelPreferences";
import { NextResponse } from "next/server";

// Ensure the route handler is treated as dynamic
export const dynamic = "force-dynamic";

// Initialize Convex client
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://fortunate-dragon-78.convex.cloud";
const client = new ConvexHttpClient(convexUrl);

export async function POST(req: Request) {
  try {
    const { messages, chatId, model } = await req.json();

    // Ensure model is valid or use default
    const selectedModel = VALID_MODELS.includes(model) ? model : DEFAULT_MODEL;

    // Debug: Log the model being used and chat ID
    console.log("Chat API using model:", selectedModel);
    console.log("Number of messages:", messages.length);
    console.log("Chat ID:", chatId);

    if (!chatId) {
      console.error("Missing chatId in request");
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    // Call the multiModelAI.chat action directly
    // The action itself handles saving the response to the database
    await client.action(api.multiModelAI.chat, {
      messages,
      chatId,
    });

    console.log("Convex action api.multiModelAI.chat triggered successfully.");

    // Return a simple success response
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in /api/chat route:", error);

    // Generate a more helpful error message
    let errorMessage = "Failed to process chat request.";
    if (error.message) {
      errorMessage += ` Error: ${error.message}`;
    }

    // Return an error response
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
