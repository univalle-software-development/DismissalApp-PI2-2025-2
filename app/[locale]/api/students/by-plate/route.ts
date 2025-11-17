import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

// Initialize Convex client for server-side queries
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Get students by license plate
 * Used by the OCR flow to find students associated with a detected plate
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plate = searchParams.get("plate");
        const campus = searchParams.get("campus");

        if (!plate || !campus) {
            return NextResponse.json(
                {
                    success: false,
                    error: "MISSING_PARAMETERS",
                    message: "Both 'plate' and 'campus' parameters are required"
                },
                { status: 400 }
            );
        }

        // Query Convex for students with this license plate
        const students = await convex.query(api.students.getByLicensePlate, {
            licensePlate: plate.toUpperCase().trim(),
            campus: campus
        });

        return NextResponse.json(students);

    } catch (error: unknown) {
        console.error("Error in students/by-plate endpoint:", error);
        const message = error instanceof Error ? error.message : String(error);
        
        return NextResponse.json(
            {
                success: false,
                error: "INTERNAL_ERROR",
                message: `Failed to query students: ${message}`
            },
            { status: 500 }
        );
    }
}
