import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECURITY_KEY = process.env.SECURITY_KEY || '123_RAGISACTIVATED_321'

export async function POST(request: NextRequest) {
  try {
    const { captions } = await request.json()

    const securityKey = request.headers.get('x-security-key')
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (!captions || !Array.isArray(captions)) {
      return NextResponse.json({ error: 'Invalid captions data' }, { status: 400 })
    }

    // Create captions in batch
    const createdCaptions = await prisma.videoCaption.createMany({
      data: captions.map(caption => ({
        analysisId: caption.analysisId,
        timestamp: caption.timestamp,
        imageLink: caption.imageLink,
        caption: caption.caption,
        captionEmbedding: caption.captionEmbedding
      }))
    })

    return NextResponse.json({ success: true, count: createdCaptions.count })
  } catch (error) {
    console.error('Create captions error:', error)
    return NextResponse.json(
      { error: 'Failed to create captions' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const analysisId = searchParams.get('analysisId')

    const securityKey = request.headers.get('x-security-key')
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 })
    }

    const captions = await prisma.videoCaption.findMany({
      where: { analysisId },
      orderBy: { timestamp: 'asc' }
    })

    return NextResponse.json({ success: true, captions })
  } catch (error) {
    console.error('Get captions error:', error)
    return NextResponse.json(
      { error: 'Failed to get captions' },
      { status: 500 }
    )
  }
} 