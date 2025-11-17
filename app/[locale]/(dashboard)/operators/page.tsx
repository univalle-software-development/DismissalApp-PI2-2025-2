'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, CheckCircle2, XCircle } from 'lucide-react'

export default function OperatorsPage() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const handleTestOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const formData = new FormData()
            formData.append('image', file)

            const response = await fetch('/api/test-ocr', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()
            
            if (data.success) {
                setResult(data)
            } else {
                setError(data.error + (data.message ? `: ${data.message}` : ''))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <Card>
                <CardHeader>
                    <CardTitle>🧪 Prueba de Azure Computer Vision OCR</CardTitle>
                    <CardDescription>
                        Sube una imagen con texto para probar la conexión con Azure
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Button
                            asChild
                            disabled={loading}
                            className="relative"
                        >
                            <label className="cursor-pointer">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Subir Imagen
                                    </>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleTestOCR}
                                    disabled={loading}
                                    className="sr-only"
                                />
                            </label>
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Formatos aceptados: JPG, PNG, BMP, etc.
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Error:</strong> {error}
                            </AlertDescription>
                        </Alert>
                    )}

                    {result && (
                        <Alert>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription>
                                <strong>✅ {result.message}</strong>
                                <div className="mt-3 space-y-2">
                                    <div className="font-semibold text-sm">Texto detectado:</div>
                                    <div className="bg-muted p-3 rounded-md whitespace-pre-wrap font-mono text-sm">
                                        {result.text || '(No se detectó texto)'}
                                    </div>
                                    <details className="text-xs">
                                        <summary className="cursor-pointer hover:underline">
                                            Ver respuesta completa de Azure
                                        </summary>
                                        <pre className="mt-2 bg-muted p-3 rounded-md overflow-auto max-h-60">
                                            {JSON.stringify(result.fullResult, null, 2)}
                                        </pre>
                                    </details>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
