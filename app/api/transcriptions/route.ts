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
    const transcriptionId = searchParams.get('id')
    const videoId = searchParams.get('videoId')

    if (transcriptionId) {
      // Get specific transcription with segments
      const transcription = await prisma.videoTranscription.findUnique({
        where: { id: transcriptionId },
        include: {
          segments: {
            orderBy: { segmentIndex: 'asc' }
          },
          video: {
            select: {
              id: true,
              title: true,
              filename: true
            }
          }
        }
      })

      if (!transcription) {
        return NextResponse.json({ error: 'Transcription not found' }, { status: 404 })
      }

      return NextResponse.json({ transcription })
    }

    if (videoId) {
      // Get transcription for specific video
      const transcription = await prisma.videoTranscription.findUnique({
        where: { videoId },
        include: {
          segments: {
            orderBy: { segmentIndex: 'asc' }
          }
        }
      })

      return NextResponse.json({ transcription })
    }

    // List all transcriptions
    const transcriptions = await prisma.videoTranscription.findMany({
      include: {
        video: {
          select: {
            id: true,
            title: true,
            filename: true
          }
        },
        _count: {
          select: {
            segments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ transcriptions })

  } catch (error) {
    console.error('Error fetching transcriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transcriptions' },
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
    const { videoId, model, status, language } = body

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
    }

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Delete existing transcription if it exists (for regeneration)
    await prisma.videoTranscription.deleteMany({
      where: { videoId }
    })

    // Create new transcription record
    const transcription = await prisma.videoTranscription.create({
      data: {
        videoId,
        model: model || 'whisper-base',
        status: status || 'pending',
        language
      }
    })

    return NextResponse.json({ transcription })

  } catch (error) {
    console.error('Error creating transcription:', error)
    return NextResponse.json(
      { error: 'Failed to create transcription' },
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
      status,
      language,
      totalSegments,
      totalDuration,
      processedAt,
      errorMessage
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Transcription ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    
    if (status) updateData.status = status
    if (language) updateData.language = language
    if (totalSegments !== undefined) updateData.totalSegments = totalSegments
    if (totalDuration !== undefined) updateData.totalDuration = totalDuration
    if (processedAt) updateData.processedAt = new Date(processedAt)
    if (errorMessage) updateData.errorMessage = errorMessage

    const transcription = await prisma.videoTranscription.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ transcription })

  } catch (error) {
    console.error('Error updating transcription:', error)
    return NextResponse.json(
      { error: 'Failed to update transcription' },
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
    const transcriptionId = searchParams.get('id')

    if (!transcriptionId) {
      return NextResponse.json({ error: 'Transcription ID is required' }, { status: 400 })
    }

    await prisma.videoTranscription.delete({
      where: { id: transcriptionId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting transcription:', error)
    return NextResponse.json(
      { error: 'Failed to delete transcription' },
      { status: 500 }
    )
  }
} 