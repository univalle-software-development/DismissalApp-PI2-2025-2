// convex/queue.ts

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { laneValidator } from "./types";

/**
 * Helper functions
 */
async function getStudentsByCarNumber(db: any, carNumber: number, campus: string) {
    if (carNumber === 0) return [];

    return await db
        .query("students")
        .withIndex("by_car_campus", (q: any) =>
            q.eq("carNumber", carNumber)
                .eq("campusLocation", campus)
                .eq("isActive", true)
        )
        .collect();
}

async function isCarInQueue(db: any, carNumber: number, campus: string): Promise<boolean> {
    const existing = await db
        .query("dismissalQueue")
        .withIndex("by_car_campus", (q: any) =>
            q.eq("carNumber", carNumber).eq("campusLocation", campus)
        )
        .filter((q: any) => q.eq(q.field("status"), "waiting"))
        .first();

    return existing !== null;
}

async function getNextPosition(db: any, campus: string, lane: string): Promise<number> {
    const entries = await db
        .query("dismissalQueue")
        .withIndex("by_campus_lane_position", (q: any) =>
            q.eq("campusLocation", campus).eq("lane", lane)
        )
        .collect();

    if (entries.length === 0) return 1;

    const maxPosition = Math.max(...entries.map((e: any) => e.position));
    return maxPosition + 1;
}

function generateCarColor(carNumber: number): string {
    const colors = [
        '#3b82f6', '#10b981', '#ef4444', '#8b5cf6',
        '#f97316', '#06b6d4', '#84cc16', '#f59e0b'
    ];
    return colors[carNumber % colors.length];
}

function studentToSummary(student: any) {
    return {
        studentId: student._id,
        name: student.fullName,
        grade: student.grade,
        avatarUrl: student.avatarUrl,
        avatarStorageId: student.avatarStorageId
    };
}

async function repositionLaneCars(db: any, campus: string, lane: string, removedPosition: number): Promise<void> {
    const entries = await db
        .query("dismissalQueue")
        .withIndex("by_campus_lane_position", (q: any) =>
            q.eq("campusLocation", campus).eq("lane", lane)
        )
        .filter((q: any) => q.gt(q.field("position"), removedPosition))
        .collect();

    // Instead of patch, we'll delete and recreate with new positions
    for (const entry of entries) {
        const { _id, _creationTime, ...entryData } = entry;
        const newEntry = { ...entryData, position: entry.position - 1 };

        await db.delete(entry._id);
        await db.insert("dismissalQueue", newEntry);
    }
}

/**
 * Get current queue state for a campus (reactive)
 */
export const getCurrentQueue = query({
    args: {
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty state instead of throwing error
            // This allows the UI to handle auth transitions gracefully
            return {
                campus: args.campus,
                leftLane: [],
                rightLane: [],
                totalCars: 0,
                lastUpdated: Date.now(),
                authState: "unauthenticated"
            };
        }

        try {
            const entries = await ctx.db
                .query("dismissalQueue")
                .withIndex("by_campus_status", q =>
                    q.eq("campusLocation", args.campus).eq("status", "waiting")
                )
                .collect();

            const leftLane = entries
                .filter(e => e.lane === "left")
                .sort((a, b) => a.position - b.position);

            const rightLane = entries
                .filter(e => e.lane === "right")
                .sort((a, b) => a.position - b.position);

            return {
                campus: args.campus,
                leftLane,
                rightLane,
                totalCars: entries.length,
                lastUpdated: Date.now(),
                authState: "authenticated"
            };
        } catch {
            // Return empty state on database errors too
            return {
                campus: args.campus,
                leftLane: [],
                rightLane: [],
                totalCars: 0,
                lastUpdated: Date.now(),
                authState: "error"
            };
        }
    }
});

/**
 * Add car to queue (allocator action)
 */
export const addCar = mutation({
    args: {
        carNumber: v.number(),
        campus: v.string(),
        lane: laneValidator
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get or create user record
        let user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            // Create user record if it doesn't exist
            const userId = await ctx.db.insert("users", {
                clerkId: identity.subject,
                username: (identity.username as string) || (identity.email as string) || "unknown",
                email: (identity.email as string) || (identity.emailAddress as string),
                firstName: (identity.firstName as string) || (identity.givenName as string),
                lastName: (identity.lastName as string) || (identity.familyName as string),
                imageUrl: (identity.imageUrl as string) || (identity.pictureUrl as string),
                assignedCampuses: [args.campus],
                isActive: true,
                createdAt: Date.now(),
                lastLoginAt: Date.now()
            });
            user = await ctx.db.get(userId);
        }

        if (!user) throw new Error("Failed to create user record");

        // Validate inputs
        if (!args.campus.trim()) {
            return {
                success: false,
                error: "INVALID_CAMPUS",
                message: "Campus is required"
            };
        }
        if (args.carNumber <= 0) {
            return {
                success: false,
                error: "INVALID_CAR_NUMBER",
                message: "Invalid car number"
            };
        }

        // Check if car is already in queue
        if (await isCarInQueue(ctx.db, args.carNumber, args.campus)) {
            return {
                success: false,
                error: "CAR_ALREADY_IN_QUEUE",
                message: `Car ${args.carNumber} is already in the queue`
            };
        }

        // Get students for this car
        const students = await getStudentsByCarNumber(ctx.db, args.carNumber, args.campus);
        if (students.length === 0) {
            return {
                success: false,
                error: "NO_STUDENTS_FOUND",
                message: `No students found with car number ${args.carNumber} in ${args.campus}`
            };
        }

        // Get next position in lane
        const position = await getNextPosition(ctx.db, args.campus, args.lane);

        // Add to queue
        const queueId = await ctx.db.insert("dismissalQueue", {
            carNumber: args.carNumber,
            campusLocation: args.campus,
            lane: args.lane,
            position,
            students: students.map(studentToSummary),
            carColor: generateCarColor(args.carNumber),
            assignedTime: Date.now(),
            addedBy: user._id,
            status: "waiting"
        });

        return {
            success: true,
            queueId
        };
    }
});

/**
 * Remove car from queue (dispatcher action)
 */
export const removeCar = mutation({
    args: {
        queueId: v.id("dismissalQueue")
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        // Get or create user record
        let user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject))
            .first();

        if (!user) {
            // Create user record if it doesn't exist
            const userId = await ctx.db.insert("users", {
                clerkId: identity.subject,
                username: (identity.username as string) || (identity.email as string) || "unknown",
                email: (identity.email as string) || (identity.emailAddress as string),
                firstName: (identity.firstName as string) || (identity.givenName as string),
                lastName: (identity.lastName as string) || (identity.familyName as string),
                imageUrl: (identity.imageUrl as string) || (identity.pictureUrl as string),
                assignedCampuses: [],
                isActive: true,
                createdAt: Date.now(),
                lastLoginAt: Date.now()
            });
            user = await ctx.db.get(userId);
        }

        if (!user) throw new Error("Failed to create user record");

        const entry = await ctx.db.get(args.queueId);
        if (!entry) throw new Error("Queue entry not found");

        if (entry.status !== "waiting") {
            throw new Error("Car is not in waiting status");
        }

        // Calculate wait time
        const waitTimeSeconds = Math.floor((Date.now() - entry.assignedTime) / 1000);

        // Create history entry
        await ctx.db.insert("dismissalHistory", {
            carNumber: entry.carNumber,
            campusLocation: entry.campusLocation,
            lane: entry.lane,
            studentIds: entry.students.map((s: any) => s.studentId),
            studentNames: entry.students.map((s: any) => s.name),
            queuedAt: entry.assignedTime,
            completedAt: Date.now(),
            waitTimeSeconds,
            addedBy: entry.addedBy,
            removedBy: user._id,
            date: new Date().toISOString().split('T')[0]
        });

        // Reposition remaining cars in lane
        await repositionLaneCars(ctx.db, entry.campusLocation, entry.lane, entry.position);

        // Remove from queue
        await ctx.db.delete(args.queueId);

        return {
            success: true,
            waitTime: waitTimeSeconds,
            carNumber: entry.carNumber
        };
    }
});

/**
 * Check if car is currently in queue
 */
export const checkCarInQueue = query({
    args: {
        carNumber: v.number(),
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return default state when not authenticated
            return { inQueue: false, entry: null, authState: "unauthenticated" };
        }

        try {
            const inQueue = await isCarInQueue(ctx.db, args.carNumber, args.campus);

            if (inQueue) {
                const entry = await ctx.db
                    .query("dismissalQueue")
                    .withIndex("by_car_campus", q =>
                        q.eq("carNumber", args.carNumber).eq("campusLocation", args.campus)
                    )
                    .filter(q => q.eq(q.field("status"), "waiting"))
                    .first();

                return {
                    inQueue: true,
                    entry: entry ? {
                        id: entry._id,
                        lane: entry.lane,
                        position: entry.position,
                        assignedTime: entry.assignedTime,
                        students: entry.students
                    } : null,
                    authState: "authenticated"
                };
            }

            return { inQueue: false, entry: null, authState: "authenticated" };
        } catch {
            return { inQueue: false, entry: null, authState: "error" };
        }
    }
});

/**
 * Move car to different lane
 */
export const moveCar = mutation({
    args: {
        queueId: v.id("dismissalQueue"),
        newLane: laneValidator
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");

        const entry = await ctx.db.get(args.queueId);
        if (!entry) throw new Error("Queue entry not found");

        if (entry.status !== "waiting") {
            throw new Error("Car is not in waiting status");
        }

        if (entry.lane === args.newLane) {
            throw new Error("Car is already in that lane");
        }

        const oldLane = entry.lane;
        const oldPosition = entry.position;

        // Get next position in new lane
        const newPosition = await getNextPosition(ctx.db, entry.campusLocation, args.newLane);

        // Instead of patch, delete and recreate with new lane/position
        const { _id, _creationTime, ...entryData } = entry;
        const newEntry = {
            ...entryData,
            lane: args.newLane,
            position: newPosition
        };

        await ctx.db.delete(args.queueId);
        const newQueueId = await ctx.db.insert("dismissalQueue", newEntry);

        // Reposition cars in old lane
        await repositionLaneCars(ctx.db, entry.campusLocation, oldLane, oldPosition);

        return newQueueId;
    }
});

/**
 * Get queue metrics for dashboard
 */
export const getQueueMetrics = query({
    args: {
        campus: v.string()
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty metrics when not authenticated
            return {
                campus: args.campus,
                currentCars: 0,
                leftLaneCars: 0,
                rightLaneCars: 0,
                averageWaitTime: 0,
                todayTotal: 0,
                todayStudents: 0,
                authState: "unauthenticated"
            };
        }

        try {
            // Current queue
            const currentQueue = await ctx.db
                .query("dismissalQueue")
                .withIndex("by_campus_status", q =>
                    q.eq("campusLocation", args.campus).eq("status", "waiting")
                )
                .collect();

            const leftLaneCars = currentQueue.filter(e => e.lane === "left").length;
            const rightLaneCars = currentQueue.filter(e => e.lane === "right").length;

            // Today's completed pickups
            const today = new Date().toISOString().split('T')[0];
            const todayHistory = await ctx.db
                .query("dismissalHistory")
                .withIndex("by_campus_date", q =>
                    q.eq("campusLocation", args.campus).eq("date", today)
                )
                .collect();

            const averageWaitTime = todayHistory.length > 0
                ? todayHistory.reduce((sum, h) => sum + h.waitTimeSeconds, 0) / todayHistory.length
                : 0;

            return {
                campus: args.campus,
                currentCars: currentQueue.length,
                leftLaneCars,
                rightLaneCars,
                averageWaitTime: Math.round(averageWaitTime),
                todayTotal: todayHistory.length,
                todayStudents: todayHistory.reduce((sum, h) => sum + h.studentIds.length, 0),
                authState: "authenticated"
            };
        } catch {
            return {
                campus: args.campus,
                currentCars: 0,
                leftLaneCars: 0,
                rightLaneCars: 0,
                averageWaitTime: 0,
                todayTotal: 0,
                todayStudents: 0,
                authState: "error"
            };
        }
    }
});

/**
 * Get recent queue activity for a campus
 */
export const getRecentActivity = query({
    args: {
        campus: v.string(),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            // Return empty array when not authenticated
            return [];
        }

        try {
            const limit = args.limit || 10;

            // Get recent completed pickups
            const recentHistory = await ctx.db
                .query("dismissalHistory")
                .withIndex("by_campus_completed", q => q.eq("campusLocation", args.campus))
                .order("desc")
                .take(limit);

            return recentHistory.map(h => ({
                id: h._id,
                carNumber: h.carNumber,
                studentNames: h.studentNames,
                completedAt: h.completedAt,
                waitTimeSeconds: h.waitTimeSeconds,
                lane: h.lane
            }));
        } catch {
            return [];
        }
    }
});
