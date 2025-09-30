"use client"

import * as React from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"
import { ModeType } from "./types"

interface DismissalViewProps {
    mode: ModeType
    className?: string
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    
    // Hook definitions ...

    // Convex hooks
    const queueData = useQuery(api.queue.getCurrentQueue,
        selectedCampus ? { campus: selectedCampus } : "skip"
    )

    // Mutations de Convex
    const addCarToQueue = useMutation(api.queue.addCar)
    const removeCarFromQueue = useMutation(api.queue.removeCar)

    // Component implementaion ...

    return (
        <div className={cn("w-full h-full flex flex-col", className)}>
            {/* Component Rendering */}
        </div>
    )
}
