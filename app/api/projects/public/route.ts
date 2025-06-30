import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Check if project exists (public endpoint - no authentication required)
    const project = await prisma.project.findUnique({
      where: { name },
      select: { 
        id: true, 
        name: true, 
        createdAt: true,
        _count: {
          select: {
            videos: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      videoCount: project._count.videos,
      exists: true
    })

  } catch (error) {
    console.error('Public project check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
} 