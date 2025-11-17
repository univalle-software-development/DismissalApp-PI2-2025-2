import { NextRequest, NextResponse } from "next/server";
import createClient from "@azure-rest/ai-vision-image-analysis";
import { AzureKeyCredential } from "@azure/core-auth";

/**
 * OCR Endpoint for License Plate Recognition
 * 
 * Expected OCR pattern: "CFO-682 CALI"
 * Returns only the plate portion: "CFO-682"
 */
export async function POST(request: NextRequest) {
    console.log("=== License Plate OCR Endpoint Called ===");
    
    try {
        // Verificar variables de entorno
        const endpoint = process.env.AZURE_VISION_ENDPOINT;
        const key = process.env.AZURE_VISION_KEY;

        if (!endpoint || !key) {
            console.error("Missing Azure credentials!");
            return NextResponse.json(
                { 
                    success: false,
                    error: "AZURE_NOT_CONFIGURED",
                    message: "Azure Computer Vision credentials are not configured"
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
                { 
                    success: false,
                    error: "NO_IMAGE",
                    message: "No image file provided"
                },
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

        console.log("Sending OCR request to Azure...");

        // Analizar imagen con OCR
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
                    error: "AZURE_API_ERROR",
                    message: "Azure Computer Vision API returned an error",
                    details: result.body,
                },
                { status: 500 }
            );
        }

        // Extraer texto de los resultados
        const body = result.body as any;
        const readResult = body.readResult;
        
        // Extraer todo el texto
        const fullText = readResult?.blocks
            ?.map((block: any) => 
                block.lines?.map((line: any) => line.text).join(" ")
            )
            .join(" ") || "";

        console.log("OCR Full Text:", fullText);

        if (!fullText.trim()) {
            return NextResponse.json(
                {
                    success: false,
                    error: "NO_TEXT_DETECTED",
                    message: "No text was detected in the image"
                },
                { status: 400 }
            );
        }

        // Extraer la placa del texto
        // Patrón esperado: "CFO-682 CALI" o similar
        // Solo guardamos la parte de la placa (antes del espacio y ciudad)
        const licensePlate = extractLicensePlate(fullText);

        if (!licensePlate) {
            return NextResponse.json(
                {
                    success: false,
                    error: "INVALID_PLATE_FORMAT",
                    message: "Could not extract a valid license plate from the image",
                    detectedText: fullText
                },
                { status: 400 }
            );
        }

        console.log("Extracted License Plate:", licensePlate);

        return NextResponse.json({
            success: true,
            licensePlate,
            fullText, // Para debugging
            message: "License plate extracted successfully"
        });

    } catch (error: unknown) {
        console.error("=== ERROR in ocr-plate endpoint ===");
        console.error("Error type:", error?.constructor?.name);
        console.error("Error message:", error instanceof Error ? error.message : String(error));
        console.error("Error stack:", error instanceof Error ? error.stack : "N/A");
        
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { 
                success: false,
                error: "INTERNAL_ERROR", 
                message: `Internal server error: ${message}`
            },
            { status: 500 }
        );
    }
}

/**
 * Extract license plate from OCR text
 * Expected patterns:
 * - "CFO-682 CALI" -> "CFO-682"
 * - "ABC123" -> "ABC123"
 * - "ABC-123" -> "ABC-123"
 * 
 * Returns only the plate portion (before city name if present)
 */
function extractLicensePlate(text: string): string | null {
    if (!text || !text.trim()) return null;

    // Limpiar el texto
    const cleanText = text.trim().toUpperCase();

    // Patrón 1: AAA-999 CIUDAD (más común en Colombia)
    // Captura: CFO-682 de "CFO-682 CALI"
    const pattern1 = /([A-Z]{3}-\d{3})/;
    const match1 = cleanText.match(pattern1);
    if (match1) {
        return match1[1];
    }

    // Patrón 2: AAA999 (sin guión)
    const pattern2 = /([A-Z]{3}\d{3})/;
    const match2 = cleanText.match(pattern2);
    if (match2) {
        return match2[1];
    }

    // Patrón 3: Formato general de placa al inicio del string
    // Toma la primera palabra que parece una placa
    const words = cleanText.split(/\s+/);
    for (const word of words) {
        // Buscar palabras que tengan letras y números
        if (/^[A-Z]{2,4}[-]?\d{2,4}$/.test(word)) {
            return word;
        }
    }

    // Si no encuentra ningún patrón, retorna null
    return null;
}
