import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECURITY_KEY = process.env.SECURITY_KEY || '123_RAGISACTIVATED_321'

export async function POST(request: NextRequest) {
  try {
    const { videoId, frameSampling, status } = await request.json()

    const securityKey = request.headers.get('x-security-key')
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId }
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Create or update frame analysis
    const analysis = await prisma.videoFrameAnalysis.upsert({
      where: { videoId },
      create: {
        videoId,
        frameSampling,
        status
      },
      update: {
        frameSampling,
        status,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    console.error('Create frame analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to create frame analysis' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status, totalFrames, processedAt } = await request.json()

    const securityKey = request.headers.get('x-security-key')
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (totalFrames !== undefined) {
      updateData.totalFrames = totalFrames
    }

    if (processedAt) {
      updateData.processedAt = new Date(processedAt)
    }

    const analysis = await prisma.videoFrameAnalysis.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    console.error('Update frame analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to update frame analysis' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const analysisId = searchParams.get('id')

    const securityKey = request.headers.get('x-security-key')
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 })
    }

    const analysis = await prisma.videoFrameAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        video: true,
        frames: true,
        captions: true,
        persons: true
      }
    })

    if (!analysis) {
      return NextResponse.json({ error: 'Frame analysis not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    console.error('Get frame analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to get frame analysis' },
      { status: 500 }
    )
  }
} 