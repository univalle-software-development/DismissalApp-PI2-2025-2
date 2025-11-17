import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Search students by license plate
 * Uses Convex mutation that doesn't require authentication
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licensePlate, campus } = body;

        if (!licensePlate || !campus) {
            return NextResponse.json(
                {
                    success: false,
                    error: "MISSING_PARAMETERS",
                    message: "Both 'licensePlate' and 'campus' are required"
                },
                { status: 400 }
            );
        }

        // Create Convex client
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

        // Use mutation to search (mutations can be called without auth)
        const students = await convex.mutation(api.students.searchByLicensePlate, {
            licensePlate: licensePlate.toUpperCase().trim(),
            campus: campus
        });

        return NextResponse.json({
            success: true,
            students
        });

    } catch (error: unknown) {
        console.error("Error in ocr-plate/search endpoint:", error);
        const message = error instanceof Error ? error.message : String(error);
        
        return NextResponse.json(
            {
                success: false,
                error: "INTERNAL_ERROR",
                message: `Failed to search students: ${message}`
            },
            { status: 500 }
        );
    }
}
