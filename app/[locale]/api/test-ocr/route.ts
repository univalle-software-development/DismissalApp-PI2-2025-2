import { NextRequest, NextResponse } from "next/server";
import createClient from "@azure-rest/ai-vision-image-analysis";
import { AzureKeyCredential } from "@azure/core-auth";

export async function POST(request: NextRequest) {
    console.log("=== OCR Test Endpoint Called ===");
    
    try {
        // Verificar variables de entorno
        const endpoint = process.env.AZURE_VISION_ENDPOINT;
        const key = process.env.AZURE_VISION_KEY;

        console.log("Environment check:", { 
            hasEndpoint: !!endpoint, 
            hasKey: !!key,
            endpointLength: endpoint?.length,
            keyLength: key?.length,
            keyFirstChars: key?.substring(0, 4)
        });

        if (!endpoint || !key) {
            console.error("Missing Azure credentials!");
            return NextResponse.json(
                { 
                    success: false,
                    error: "Azure credentials not configured",
                    details: "AZURE_VISION_ENDPOINT or AZURE_VISION_KEY is missing"
                },
                { status: 500 }
            );
        }

        // Obtener imagen del form data
        const formData = await request.formData();
        const imageFile = formData.get("image") as Blob;

        if (!imageFile) {
            console.error("No image file in request");
            return NextResponse.json(
                { success: false, error: "No image file provided" },
                { status: 400 }
            );
        }

        console.log("Image file received:", {
            type: imageFile.type,
            size: imageFile.size
        });

        // Convertir imagen a buffer
        const arrayBuffer = await imageFile.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        console.log("Creating Azure client...");
        
        // Crear cliente de Azure
        const client = createClient(endpoint, new AzureKeyCredential(key));

        console.log("Sending request to Azure...");

        // Analizar imagen
        const result = await client.path("/imageanalysis:analyze").post({
            body: imageBuffer,
            queryParameters: {
                features: ["Read"],
                "api-version": "2023-10-01"
            },
            contentType: "application/octet-stream",
        });

        console.log("Azure response status:", result.status);

        if (result.status !== "200") {
            console.error("Azure API error:", result.body);
            return NextResponse.json(
                {
                    success: false,
                    error: "Azure API error",
                    status: result.status,
                    details: result.body,
                },
                { status: 500 }
            );
        }

        // Extraer texto de los resultados
        const body = result.body as any;
        console.log("Full Azure response:", JSON.stringify(body, null, 2));
        
        const readResult = body.readResult;
        const extractedText = readResult?.blocks
            ?.map((block: any) => 
                block.lines?.map((line: any) => line.text).join(" ")
            )
            .join("\n") || "";

        console.log("Extracted text:", extractedText);

        return NextResponse.json({
            success: true,
            text: extractedText,
            fullResult: readResult,
            message: "Azure Computer Vision is working correctly!",
        });

    } catch (error: unknown) {
        console.error("=== ERROR in test-ocr endpoint ===");
        console.error("Error type:", error?.constructor?.name);
        console.error("Error message:", error instanceof Error ? error.message : String(error));
        console.error("Error stack:", error instanceof Error ? error.stack : "N/A");
        
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { 
                success: false,
                error: "Internal server error", 
                message,
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}
