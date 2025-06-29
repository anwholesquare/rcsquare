import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECURITY_KEY = process.env.SECURITY_KEY || '123_RAGISACTIVATED_321'

export async function POST(request: NextRequest) {
  try {
    const { projectName, securityKey } = await request.json()

    // Validate security key
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    // Validate project name
    if (!projectName || projectName.length < 3) {
      return NextResponse.json(
        { error: 'Project name must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Check if project exists, create if not
    let project = await prisma.project.findUnique({
      where: { name: projectName }
    })

    if (!project) {
      project = await prisma.project.create({
        data: { name: projectName }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Project validated successfully',
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt
      }
    })
  } catch (error) {
    console.error('Project validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate project' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectName = searchParams.get('name')
    const securityKey = request.headers.get('x-security-key')

    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (!projectName) {
      return NextResponse.json({ error: 'Project name required' }, { status: 400 })
    }

    const project = await prisma.project.findUnique({
      where: { name: projectName },
      include: {
        videos: {
          orderBy: { createdAt: 'desc' },
          include: {
            frameAnalysis: {
              include: {
                frames: true,
                captions: true,
                persons: true
              }
            },
            transcription: {
              include: {
                segments: {
                  orderBy: { segmentIndex: 'asc' }
                }
              }
            }
          } as any
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    )
  }
} 