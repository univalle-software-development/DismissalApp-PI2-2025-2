import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const { text } = await req.json()

    if (!text) {
        return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
        return NextResponse.json({ error: 'Google API key is not configured' }, { status: 500 })
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`

    const body = {
        input: { text },
        voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
        audioConfig: { audioEncoding: 'MP3' },
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const errorData = await response.json()
            return NextResponse.json({ error: 'Failed to synthesize speech', details: errorData }, { status: response.status })
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
    }
}
