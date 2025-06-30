import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SECURITY_KEY = "123_RAGISACTIVATED_321"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const videoId = searchParams.get('videoId')
    const topicId = searchParams.get('id')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (topicId) {
      // Get specific topic
      const topic = await (prisma as any).videoTopic.findUnique({
        where: { id: topicId }
      })
      
      if (!topic) {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
      }
      
      return NextResponse.json(topic)
    }

    if (videoId) {
      // Get topics for specific video
      const topics = await (prisma as any).videoTopic.findMany({
        where: { videoId },
        orderBy: { topicIndex: 'asc' }
      })
      
      return NextResponse.json(topics)
    }

    // Get all topics
    const topics = await (prisma as any).videoTopic.findMany({
      orderBy: [
        { videoId: 'asc' },
        { topicIndex: 'asc' }
      ]
    })

    return NextResponse.json(topics)

  } catch (error) {
    console.error('Error fetching video topics:', error)
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
    
    // Create new topic
    const topic = await (prisma as any).videoTopic.create({
      data: {
        videoId: body.videoId,
        topicIndex: body.topicIndex,
        startingTimestamp: body.startingTimestamp,
        endingTimestamp: body.endingTimestamp,
        startSeconds: body.startSeconds,
        endSeconds: body.endSeconds,
        topic: body.topic,
        status: body.status || 'pending',
        model: body.model
      }
    })

    return NextResponse.json(topic, { status: 201 })

  } catch (error) {
    console.error('Error creating video topic:', error)
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
      return NextResponse.json({ error: 'Topic ID is required' }, { status: 400 })
    }

    const topic = await (prisma as any).videoTopic.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(topic)

  } catch (error) {
    console.error('Error updating video topic:', error)
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
      // Delete all topics for a specific video
      const result = await (prisma as any).videoTopic.deleteMany({
        where: { videoId }
      })

      return NextResponse.json({ 
        message: `${result.count} video topics deleted successfully`,
        count: result.count 
      })
    }

    if (id) {
      // Delete specific topic by ID
      await (prisma as any).videoTopic.delete({
        where: { id }
      })

      return NextResponse.json({ message: 'Topic deleted successfully' })
    }

    return NextResponse.json({ error: 'Topic ID or Video ID is required' }, { status: 400 })

  } catch (error) {
    console.error('Error deleting video topic:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 