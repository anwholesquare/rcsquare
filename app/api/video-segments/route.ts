import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SECURITY_KEY = "123_RAGISACTIVATED_321"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const videoId = searchParams.get('videoId')
    const segmentId = searchParams.get('id')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (segmentId) {
      // Get specific segment
      const segment = await (prisma as any).videoSegment.findUnique({
        where: { id: segmentId }
      })
      
      if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
      }
      
      return NextResponse.json(segment)
    }

    if (videoId) {
      // Get segments for specific video
      const segments = await (prisma as any).videoSegment.findMany({
        where: { videoId },
        orderBy: { segmentIndex: 'asc' }
      })
      
      return NextResponse.json(segments)
    }

    // Get all segments
    const segments = await (prisma as any).videoSegment.findMany({
      orderBy: [
        { videoId: 'asc' },
        { segmentIndex: 'asc' }
      ]
    })

    return NextResponse.json(segments)

  } catch (error) {
    console.error('Error fetching video segments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    const body = await request.json()
    
    // Create new segment
    const segment = await (prisma as any).videoSegment.create({
      data: {
        videoId: body.videoId,
        segmentIndex: body.segmentIndex,
        startingTimestamp: body.startingTimestamp,
        endingTimestamp: body.endingTimestamp,
        startSeconds: body.startSeconds,
        endSeconds: body.endSeconds,
        description: body.description,
        status: body.status || 'pending',
        model: body.model
      }
    })

    return NextResponse.json(segment, { status: 201 })

  } catch (error) {
    console.error('Error creating video segment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Segment ID is required' }, { status: 400 })
    }

    const segment = await (prisma as any).videoSegment.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(segment)

  } catch (error) {
    console.error('Error updating video segment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const id = searchParams.get('id')
    const videoId = searchParams.get('videoId')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (videoId) {
      // Delete all segments for a specific video
      const result = await (prisma as any).videoSegment.deleteMany({
        where: { videoId }
      })

      return NextResponse.json({ 
        message: `${result.count} video segments deleted successfully`,
        count: result.count 
      })
    }

    if (id) {
      // Delete specific segment by ID
      await (prisma as any).videoSegment.delete({
        where: { id }
      })

      return NextResponse.json({ message: 'Segment deleted successfully' })
    }

    return NextResponse.json({ error: 'Segment ID or Video ID is required' }, { status: 400 })

  } catch (error) {
    console.error('Error deleting video segment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 