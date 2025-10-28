"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Car, ChevronLeft, ChevronRight, MapPin, AlertCircle, CheckCircle2, Mic } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { FilterDropdown } from "@/components/ui/filter-dropdown"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CAMPUS_LOCATIONS, type CampusLocation, type Id } from "@/convex/types"
import { cn } from "@/lib/utils"
import { useBirthdayCars } from "@/hooks/use-birthday-cars"
import { useSpeechToText } from "@/hooks/use-speech-to-text"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { Road } from "./road"
import { CarData, ModeType } from "./types"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface DismissalViewProps {
    mode: ModeType
    className?: string
}

// Type guard: checks that an object has array-shaped left/right lanes
function hasCompleteLanes(data: unknown): data is { leftLane: unknown[]; rightLane: unknown[] } {
    if (typeof data !== 'object' || data === null) return false
    const d = data as Record<string, unknown>
    return Array.isArray(d.leftLane) && Array.isArray(d.rightLane)
}

export function DismissalView({ mode, className }: DismissalViewProps) {
    const t = useTranslations('dismissal')
    const locale = useLocale()

    const [selectedCampus, setSelectedCampus] = React.useState<string>("")
    const [isFullscreen, setIsFullscreen] = React.useState(false)
    const [carInputValue, setCarInputValue] = React.useState<string>('')
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    // Alert state
    const [alert, setAlert] = React.useState<{
        show: boolean
        type: 'success' | 'error'
        title: string
        message: string
    }>({
        show: false,
        type: 'success',
        title: '',
        message: ''
    })

    const {
        isRecording,
        isTranscribing,
        command,
        error: voiceError,
        startRecording,
        stopRecording,
        resetCommand,
    } = useSpeechToText()

    // Text-to-Speech hook (announcements)
    const { enqueue: ttsEnqueue, enabled: ttsEnabled, setEnabled: setTtsEnabled } = useTextToSpeech()

    // Track seen cars to announce only new arrivals (use stable keys)
    const seenKeysRef = React.useRef<Set<string>>(new Set())
    const initializedRef = React.useRef(false)

    // Convex hooks - para obtener datos en tiempo real
    const queueData = useQuery(api.queue.getCurrentQueue,
        selectedCampus ? { campus: selectedCampus } : "skip"
    )

    // Mutations de Convex
    const addCarToQueue = useMutation(api.queue.addCar)
    const removeCarFromQueue = useMutation(api.queue.removeCar)

    // Campus selection validation
    const isCampusSelected = selectedCampus !== "all" && selectedCampus !== ""

    // Function to show alerts
    const showAlert = React.useCallback((type: 'success' | 'error', title: string, message: string) => {
        setAlert({
            show: true,
            type,
            title,
            message
        })

        // Auto-hide after 5 seconds
        setTimeout(() => {
            setAlert(prev => ({ ...prev, show: false }))
        }, 5000)
    }, [])

    // Function to hide alert manually
    const hideAlert = React.useCallback(() => {
        setAlert(prev => ({ ...prev, show: false }))
    }, [])

    // Transform Convex queue data to CarData format
    const { leftLaneCars, rightLaneCars, isLoading, authError } = React.useMemo(() => { // add totalCars if needed
        if (!queueData) {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: true, authError: false } // add totalCars: 0, if needed
        }

        // Handle authentication states
        if (queueData.authState === "unauthenticated") {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: true, authError: false } // add totalCars: 0, if needed
        }

        if (queueData.authState === "error") {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: false, authError: true } // add totalCars: 0, if needed
        }

        if (!queueData.leftLane || !queueData.rightLane) {
            return { leftLaneCars: [], rightLaneCars: [], isLoading: false, authError: false } // add totalCars: 0, if needed
        }

        const transformQueueEntry = (entry: {
            _id: string;
            carNumber: number;
            lane: "left" | "right";
            position: number;
            assignedTime: number;
            students: Array<{ studentId: string; name: string; grade: string; avatarUrl?: string; avatarStorageId?: Id<"_storage">; birthday?: string }>;
            campusLocation: string;
            carColor: string;
        }): CarData => {
            return {
                id: entry._id,
                carNumber: entry.carNumber,
                lane: entry.lane,
                position: entry.position,
                assignedTime: new Date(entry.assignedTime),
                students: entry.students.map((s) => ({
                    id: s.studentId,
                    name: s.name,
                    grade: s.grade,
                    imageUrl: s.avatarUrl,
                    avatarStorageId: s.avatarStorageId,
                    birthday: s.birthday,
                })),
                campus: entry.campusLocation,
                imageColor: entry.carColor
            }
        }

        const leftCars = queueData.leftLane.map(transformQueueEntry)
        const rightCars = queueData.rightLane.map(transformQueueEntry)

        return {
            leftLaneCars: leftCars,
            rightLaneCars: rightCars,
            // totalCars: leftCars.length + rightCars.length,
            isLoading: false,
            authError: false
        }
    }, [queueData])

    // Hook para verificar carros con estudiantes de cumpleaños
    const allCars = [...leftLaneCars, ...rightLaneCars]
    const { birthdayCarIds } = useBirthdayCars(allCars)

    const submitCar = React.useCallback(async (carNumStr: string, lane: 'left' | 'right') => {
        if (!carNumStr.trim() || isSubmitting) return

        const carNumber = parseInt(carNumStr.trim())
        if (isNaN(carNumber) || carNumber <= 0) {
            showAlert('error', 'Invalid Car Number', 'Please enter a valid car number')
            return
        }

        if (!isCampusSelected) {
            showAlert('error', 'Campus Required', 'Please select a campus')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await addCarToQueue({
                carNumber,
                campus: selectedCampus,
                lane
            })

            if (result.success) {
                setCarInputValue('')
                showAlert('success', 'Car Added!', `Car ${carNumber} has been added to the ${lane} lane`)
            } else {
                switch (result.error) {
                    case 'NO_STUDENTS_FOUND':
                        showAlert('error', 'Car Not Found', `No students found with car number ${carNumber}`)
                        break
                    case 'CAR_ALREADY_IN_QUEUE':
                        showAlert('error', 'Car Already in Queue', `Car ${carNumber} is already in the dismissal queue`)
                        break
                    case 'INVALID_CAR_NUMBER':
                        showAlert('error', 'Invalid Car Number', 'Please enter a valid car number')
                        break
                    case 'INVALID_CAMPUS':
                        showAlert('error', 'Campus Required', 'Please select a campus')
                        break
                    default:
                        showAlert('error', 'Error', result.message || 'An unexpected error occurred')
                }
            }
        } catch {
            showAlert('error', 'Error', 'Failed to add car to queue')
        } finally {
            setIsSubmitting(false)
        }
    }, [addCarToQueue, isCampusSelected, isSubmitting, selectedCampus, showAlert])

    const handleAddCarFromInput = (lane: 'left' | 'right') => {
        submitCar(carInputValue, lane)
    }

    // Remove car function using Convex mutation
    const handleRemoveCar = React.useCallback(async (carId: string) => {
        if (isSubmitting) return

        setIsSubmitting(true)
        try {
            const result = await removeCarFromQueue({ queueId: carId as Id<"dismissalQueue"> })
            if (result && result.carNumber) {
                showAlert('success', 'Car Removed!', `Car ${result.carNumber} has been removed from the queue`)
            }
        } catch {
            showAlert('error', 'Error', 'Failed to remove car from queue')
        } finally {
            setIsSubmitting(false)
        }
    }, [removeCarFromQueue, isSubmitting, showAlert])

    // Handle keyboard shortcuts for the single input
    const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            submitCar(carInputValue, 'right')
        }
    }, [submitCar, carInputValue])

    // Toggle fullscreen for viewer mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    // Handle voice command
    const handleVoiceCommand = React.useCallback(() => {
        if (isSubmitting) return;

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, isSubmitting, startRecording, stopRecording])

    React.useEffect(() => {
        if (command?.carNumber && command.lane) {
            setCarInputValue(String(command.carNumber));
            submitCar(String(command.carNumber), command.lane);
            resetCommand();
        }
    }, [command, submitCar, resetCommand])

    React.useEffect(() => {
        if (voiceError) {
            showAlert('error', 'Voice Command Error', voiceError);
            resetCommand();
        }
    }, [voiceError, showAlert, resetCommand])

    // Reset announcement tracking when campus changes
    React.useEffect(() => {
        initializedRef.current = false
        seenKeysRef.current.clear()
    }, [selectedCampus])

    // Announce newly added cars via Text-to-Speech (viewer mode only)
    React.useEffect(() => {
        if (mode !== 'viewer') return
        if (!isCampusSelected) return

        // Skip when queue data is incomplete (prevents clearing seen set on transient states)
        if (!hasCompleteLanes(queueData)) return

        // Use a stable key per car to avoid re-announcing on reorder
        const keyFor = (c: CarData) => `${selectedCampus}|${c.carNumber}`
        const currentKeys = new Set<string>()
        for (const c of leftLaneCars) currentKeys.add(keyFor(c))
        for (const c of rightLaneCars) currentKeys.add(keyFor(c))

        if (!initializedRef.current) {
            initializedRef.current = true
            seenKeysRef.current = currentKeys
            return
        }

        const newCars: CarData[] = []
        for (const c of leftLaneCars) if (!seenKeysRef.current.has(keyFor(c))) newCars.push(c)
        for (const c of rightLaneCars) if (!seenKeysRef.current.has(keyFor(c))) newCars.push(c)

        if (newCars.length > 0 && ttsEnabled) {
            const isEs = locale.toLowerCase().startsWith('es')
            const lang = isEs ? 'es-ES' : 'en-US'
            for (const c of newCars) {
                const laneLabel = isEs ? (c.lane === 'left' ? 'izquierda' : 'derecha') : (c.lane === 'left' ? 'left' : 'right')
                const text = isEs
                    ? `El carro ${c.carNumber} llegó al carril ${laneLabel}.`
                    : `Car ${c.carNumber} has arrived to the ${laneLabel} lane.`
                ttsEnqueue(text, { languageCode: lang })
            }
        }

        // Update seen keys snapshot (forget removed cars so re-additions are announced)
        seenKeysRef.current = currentKeys
    }, [leftLaneCars, rightLaneCars, isCampusSelected, locale, ttsEnabled, ttsEnqueue, mode, selectedCampus, queueData])

    return (
        <div className={cn("w-full h-full flex flex-col", className)}>
            {/* Campus Selection and Lane Balance */}
            <div className="flex flex-col gap-4  md:flex-row md:items-center md:gap-6 flex-shrink-0">
                <div className="flex-shrink-0 relative">
                    <FilterDropdown<CampusLocation>
                        value={selectedCampus as CampusLocation}
                        onChange={(value) => setSelectedCampus(value)}
                        options={CAMPUS_LOCATIONS}
                        icon={MapPin}
                        label={t('campus.select')}
                        placeholder={t('campus.select')}
                        className="w-full md:w-64"
                        showAllOption={false}
                    />
                    {/* Auth State Indicator */}
                    {isLoading && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"
                            title="Loading authentication..." />
                    )}
                    {authError && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
                            title="Authentication error" />
                    )}
                </div>

                {/* Voice notifications toggle (viewer mode only) */}
                {mode === 'viewer' && (
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="voice-toggle"
                            checked={ttsEnabled}
                            onCheckedChange={(v) => setTtsEnabled(Boolean(v))}
                        />
                        <Label htmlFor="voice-toggle">Voice notifications</Label>
                    </div>
                )}

                {/* Lane Balance Bar
                <Card className={cn("flex-1 border-2 rounded-md border-yankees-blue flex items-center p-3", !isCampusSelected && "opacity-50")}>
                    <div className="relative h-1.5 rounded-full bg-gray-200 overflow-hidden w-full">
                        {totalCars > 0 ? (
                            <>
                                <div
                                    className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${(leftLaneCars.length / totalCars) * 100}%` }}
                                />
                                <div
                                    className="absolute right-0 top-0 h-full bg-green-500 transition-all duration-300"
                                    style={{ width: `${(rightLaneCars.length / totalCars) * 100}%` }}
                                />
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gray-300" />
                        )}
                    </div>
                </Card> */}
            </div>

            {/* Main Content Area - Takes remaining space */}
            <div className="flex-1 flex flex-col mt-4 min-h-0 relative">
                <div className={`relative  ${!isCampusSelected ? 'pointer-events-none' : ''}`}>
                    <Road
                        leftLaneCars={leftLaneCars}
                        rightLaneCars={rightLaneCars}
                        mode={mode}
                        onRemoveCar={handleRemoveCar}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={toggleFullscreen}
                        birthdayCarIds={birthdayCarIds}
                    />

                    {/* Overlay cuando no hay campus */}
                    {!isCampusSelected && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
                            <Card className="bg-white shadow-xl border-2 border-yankees-blue">
                                <CardContent className="flex items-center justify-center p-6">
                                    <div className="text-center space-y-2">
                                        <Car className="h-12 w-12 text-muted-foreground mx-auto" />
                                        <CardTitle className="text-lg text-muted-foreground">{t('campus.required')}</CardTitle>
                                        <CardDescription>
                                            {t('campus.placeholder')}
                                        </CardDescription>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                {/* Allocator Control with Finish Line - Responsive */}
                {mode === 'allocator' && isCampusSelected && (
                    <div className="absolute bottom-8 left-0 right-0 z-20 px-2">
                        <div className="flex justify-center">
                            <div className="bg-white/90 w-full max-w-xs sm:max-w-sm backdrop-blur-md rounded-xl sm:rounded-2xl border-white/30 relative overflow-hidden">
                                <div className="flex items-center gap-2 sm:gap-3 relative z-10 justify-center">
                                    {/* Left Arrow Button */}
                                    <Button
                                        onClick={() => handleAddCarFromInput('left')}
                                        disabled={!carInputValue.trim() || isSubmitting}
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:p-3 h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl shrink-0 shadow-md transition-colors duration-200 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </Button>

                                    {/* Car Input with Voice Button */}
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder={t('allocator.addCarPlaceholder')}
                                            value={carInputValue}
                                            onChange={(e) => {
                                                // Solo permitir números
                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                setCarInputValue(value)
                                            }}
                                            onKeyDown={handleKeyPress}
                                            disabled={isSubmitting || isRecording || isTranscribing}
                                            className="text-center text-base sm:text-lg font-bold border-2 border-gray-300 focus:border-yankees-blue focus:ring-2 focus:ring-yankees-blue/20 h-10 sm:h-12 rounded-lg sm:rounded-xl shadow-sm bg-white disabled:opacity-50 pr-12 sm:pr-14"
                                            autoFocus
                                        />

                                        {/* Voice Command Button - Inside Input */}
                                        <Button
                                            onClick={handleVoiceCommand}
                                            disabled={isSubmitting || isTranscribing}
                                            size="sm"
                                            type="button"
                                            className={cn(
                                                "group absolute right-1 top-1/2 -translate-y-1/2 rounded-lg h-8 w-8 sm:h-10 sm:w-10 p-0 shadow-md transition-all duration-300 overflow-hidden",
                                                isRecording
                                                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                                                    : "bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 hover:scale-105",
                                                "disabled:opacity-50 disabled:scale-100"
                                            )}
                                        >
                                            {/* Animated ring effect when listening */}
                                            {isRecording && (
                                                <span className="absolute inset-0 rounded-lg bg-red-400 animate-ping opacity-75" />
                                            )}

                                            {/* Icon */}
                                            <Mic className={cn(
                                                "h-4 w-4 sm:h-5 sm:w-5 relative z-10 transition-transform duration-300",
                                                isRecording ? "scale-110" : "group-hover:scale-110"
                                            )} />

                                            {/* Tooltip hint */}
                                            <span className="absolute -top-9 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                {isTranscribing ? 'Procesando...' : (isRecording ? 'Escuchando...' : 'Comando de voz')}
                                            </span>
                                        </Button>
                                    </div>

                                    {/* Right Arrow Button */}
                                    <Button
                                        onClick={() => handleAddCarFromInput('right')}
                                        disabled={!carInputValue.trim() || isSubmitting}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white p-2 sm:p-3 h-10 w-10 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl shrink-0 shadow-md transition-colors duration-200 disabled:opacity-50"
                                    >
                                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Alert Component - Fixed at bottom right */}
            {alert.show && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
                    <Alert
                        variant={alert.type === 'error' ? 'destructive' : 'default'}
                        className="max-w-sm w-auto bg-white shadow-lg cursor-pointer border-2 transition-all hover:shadow-xl"
                        onClick={hideAlert}
                    >
                        {alert.type === 'error' ? (
                            <AlertCircle className="h-4 w-4" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                        <AlertDescription className="text-sm mt-1">
                            {alert.message}
                            <div className="text-xs text-muted-foreground mt-1">Tap to dismiss</div>
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    )
}

// Announce newly added cars using Text-to-Speech
// Placed after component to avoid cluttering the main JSX; effect is inside component scope.
