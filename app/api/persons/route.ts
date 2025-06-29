import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SECURITY_KEY = process.env.SECURITY_KEY || '123_RAGISACTIVATED_321'

export async function POST(request: NextRequest) {
  try {
    const { persons } = await request.json()

    const securityKey = request.headers.get('x-security-key')
    if (securityKey !== SECURITY_KEY) {
      return NextResponse.json({ error: 'Invalid security key' }, { status: 401 })
    }

    if (!persons || !Array.isArray(persons)) {
      return NextResponse.json({ error: 'Invalid persons data' }, { status: 400 })
    }

    // Create persons in batch
    const createdPersons = await prisma.videoPerson.createMany({
      data: persons.map(person => ({
        analysisId: person.analysisId,
        timestamp: person.timestamp,
        imageLink: person.imageLink,
        personUid: person.personUid,
        clipEmbedding: person.clipEmbedding
      }))
    })

    return NextResponse.json({ success: true, count: createdPersons.count })
  } catch (error) {
    console.error('Create persons error:', error)
    return NextResponse.json(
      { error: 'Failed to create persons' },
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

    const persons = await prisma.videoPerson.findMany({
      where: { analysisId },
      orderBy: { timestamp: 'asc' }
    })

    return NextResponse.json({ success: true, persons })
  } catch (error) {
    console.error('Get persons error:', error)
    return NextResponse.json(
      { error: 'Failed to get persons' },
      { status: 500 }
    )
  }
} 