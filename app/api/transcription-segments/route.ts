import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECURITY_KEY = "123_RAGISACTIVATED_321"

function validateSecurityKey(request: NextRequest) {
  const securityKey = request.headers.get('x-security-key')
  return securityKey === SECURITY_KEY
}

export async function GET(request: NextRequest) {
  if (!validateSecurityKey(request)) {
    return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const transcriptionId = searchParams.get('transcriptionId')
    const segmentId = searchParams.get('id')

    if (segmentId) {
      // Get specific segment
      const segment = await (prisma as any).videoTranscriptionSegment.findUnique({
        where: { id: segmentId },
        include: {
          videoTranscription: {
            include: {
              video: {
                select: {
                  id: true,
                  title: true,
                  filename: true
                }
              }
            }
          }
        }
      })

      if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
      }

      return NextResponse.json({ segment })
    }

    if (transcriptionId) {
      // Get all segments for a transcription
      const segments = await (prisma as any).videoTranscriptionSegment.findMany({
        where: { transcriptionId },
        orderBy: { segmentIndex: 'asc' }
      })

      return NextResponse.json({ segments })
    }

    // Get all segments
    const segments = await (prisma as any).videoTranscriptionSegment.findMany({
      include: {
        videoTranscription: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
                filename: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ segments })

  } catch (error) {
    console.error('Error fetching transcription segments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcription segments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!validateSecurityKey(request)) {
    return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { segments } = body

    if (!segments || !Array.isArray(segments)) {
      return NextResponse.json({ error: 'Segments array is required' }, { status: 400 })
    }

    // Create all segments in a transaction
    const createdSegments = await prisma.$transaction(
      segments.map((segment: any) => {
        return (prisma as any).videoTranscriptionSegment.create({
          data: {
            transcriptionId: segment.transcriptionId,
            segmentIndex: segment.segmentIndex,
            startingTimestamp: segment.startingTimestamp,
            endingTimestamp: segment.endingTimestamp,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
            transcription: segment.transcription,
            refinedTranscription: segment.refinedTranscription,
            confidence: segment.confidence || 0.0,
            isEdited: segment.isEdited || false
          }
        })
      })
    )

    return NextResponse.json({ segments: createdSegments })

  } catch (error) {
    console.error('Error creating transcription segments:', error)
    return NextResponse.json(
      { error: 'Failed to create transcription segments' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!validateSecurityKey(request)) {
    return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      id,
      transcription,
      refinedTranscription,
      isEdited
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    
    if (transcription !== undefined) updateData.transcription = transcription
    if (refinedTranscription !== undefined) updateData.refinedTranscription = refinedTranscription
    if (isEdited !== undefined) updateData.isEdited = isEdited

    const segment = await (prisma as any).videoTranscriptionSegment.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ segment })

  } catch (error) {
    console.error('Error updating transcription segment:', error)
    return NextResponse.json(
      { error: 'Failed to update transcription segment' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!validateSecurityKey(request)) {
    return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get('id')
    const transcriptionId = searchParams.get('transcriptionId')

    if (segmentId) {
      // Delete specific segment
      await (prisma as any).videoTranscriptionSegment.delete({
        where: { id: segmentId }
      })
    } else if (transcriptionId) {
      // Delete all segments for a transcription
      await (prisma as any).videoTranscriptionSegment.deleteMany({
        where: { transcriptionId }
      })
    } else {
      return NextResponse.json({ error: 'Segment ID or Transcription ID is required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting transcription segment(s):', error)
    return NextResponse.json(
      { error: 'Failed to delete transcription segment(s)' },
      { status: 500 }
    )
  }
} 