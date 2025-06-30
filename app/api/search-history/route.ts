import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectName = searchParams.get('project')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let searchHistory

    if (projectName) {
      // Get search history for specific project
      const project = await prisma.project.findUnique({
        where: { name: projectName }
      })

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      searchHistory = await prisma.searchHistory.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          project: {
            select: {
              name: true
            }
          }
        }
      })
    } else {
      // Get all search history across all projects
      searchHistory = await prisma.searchHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          project: {
            select: {
              name: true
            }
          }
        }
      })
    }

    // Parse results and metadata
    const formattedHistory = searchHistory.map(search => ({
      id: search.id,
      projectName: search.project.name,
      query: search.query,
      searchType: search.searchType,
      results: JSON.parse(search.results),
      tokenUsage: search.tokenUsage,
      cost: search.cost,
      model: search.model,
      metadata: search.metadata ? JSON.parse(search.metadata) : null,
      createdAt: search.createdAt
    }))

    return NextResponse.json({
      searches: formattedHistory,
      totalCount: formattedHistory.length
    })

  } catch (error) {
    console.error('Search history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchId = searchParams.get('id')

    if (!searchId) {
      return NextResponse.json({ error: 'Search ID is required' }, { status: 400 })
    }

    await prisma.searchHistory.delete({
      where: { id: searchId }
    })

    return NextResponse.json({ message: 'Search history deleted successfully' })

  } catch (error) {
    console.error('Delete search history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
} 