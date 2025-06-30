import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SECURITY_KEY = "123_RAGISACTIVATED_321"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const videoId = searchParams.get('videoId')
    const operation = searchParams.get('operation')
    const model = searchParams.get('model')
    const usageId = searchParams.get('id')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (usageId) {
      // Get specific token usage record
      const usage = await (prisma as any).tokenUsage.findUnique({
        where: { id: usageId }
      })
      
      if (!usage) {
        return NextResponse.json({ error: 'Token usage record not found' }, { status: 404 })
      }
      
      return NextResponse.json(usage)
    }

    // Build filter conditions
    const whereConditions: any = {}
    if (videoId) whereConditions.videoId = videoId
    if (operation) whereConditions.operation = operation
    if (model) whereConditions.model = model

    // Get token usage records with optional filters
    const usageRecords = await (prisma as any).tokenUsage.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(usageRecords)

  } catch (error) {
    console.error('Error fetching token usage:', error)
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
    
    // Create new token usage record
    const usage = await (prisma as any).tokenUsage.create({
      data: {
        videoId: body.videoId || null,
        operation: body.operation,
        model: body.model,
        promptTokens: body.promptTokens,
        completionTokens: body.completionTokens,
        totalTokens: body.totalTokens,
        cost: body.cost || null,
        requestData: body.requestData ? JSON.stringify(body.requestData) : null,
        responseData: body.responseData ? JSON.stringify(body.responseData) : null
      }
    })

    return NextResponse.json(usage, { status: 201 })

  } catch (error) {
    console.error('Error creating token usage record:', error)
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
      return NextResponse.json({ error: 'Token usage ID is required' }, { status: 400 })
    }

    // Handle JSON fields
    if (updateData.requestData) {
      updateData.requestData = JSON.stringify(updateData.requestData)
    }
    if (updateData.responseData) {
      updateData.responseData = JSON.stringify(updateData.responseData)
    }

    const usage = await (prisma as any).tokenUsage.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(usage)

  } catch (error) {
    console.error('Error updating token usage record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const id = searchParams.get('id')

    if (key !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ error: 'Token usage ID is required' }, { status: 400 })
    }

    await (prisma as any).tokenUsage.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Token usage record deleted successfully' })

  } catch (error) {
    console.error('Error deleting token usage record:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 