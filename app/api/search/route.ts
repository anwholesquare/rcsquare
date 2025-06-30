import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import axios from 'axios'

const prisma = new PrismaClient()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const QDRANT_BASE_URL = process.env.QDRANT_BASE_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY

interface SearchResult {
  id: string
  type: 'text' | 'person' | 'frame'
  videoId: string
  videoTitle: string
  timestamp?: string
  score: number
  content: string
  imageUrl?: string
  metadata?: any
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const projectName = formData.get('projectName') as string
    const searchType = formData.get('searchType') as string
    const query = formData.get('query') as string
    const personImage = formData.get('personImage') as File
    const frameImage = formData.get('frameImage') as File

    if (!projectName || !searchType) {
      return NextResponse.json({ error: 'Project name and search type are required' }, { status: 400 })
    }

    // Verify project exists (public access - no authentication required)
    const project = await prisma.project.findUnique({
      where: { name: projectName },
      include: {
        videos: {
          include: {
            transcription: {
              include: {
                segments: true
              }
            },
            segments: true,
            topics: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    let results: SearchResult[] = []
    let tokenUsage = 0
    let cost = 0
    let model = ''

    switch (searchType) {
      case 'text':
        if (!query) {
          return NextResponse.json({ error: 'Query is required for text search' }, { status: 400 })
        }
        const textResults = await performTextSearch(project, query)
        results = textResults.results
        tokenUsage = textResults.tokenUsage
        cost = textResults.cost
        model = textResults.model
        break

      case 'person':
        if (!personImage) {
          return NextResponse.json({ error: 'Person image is required for person search' }, { status: 400 })
        }
        results = await performPersonSearch(project, personImage)
        break

      case 'frame':
        if (!frameImage) {
          return NextResponse.json({ error: 'Frame image is required for frame search' }, { status: 400 })
        }
        results = await performFrameSearch(project, frameImage)
        break

      default:
        return NextResponse.json({ error: 'Invalid search type' }, { status: 400 })
    }

    // Save search history
    await prisma.searchHistory.create({
      data: {
        projectId: project.id,
        query: query || `${searchType}_image_search`,
        searchType,
        results: JSON.stringify(results),
        tokenUsage: tokenUsage || null,
        cost: cost || null,
        model: model || null,
        metadata: JSON.stringify({
          resultsCount: results.length,
          searchedAt: new Date().toISOString()
        })
      }
    })

    return NextResponse.json({
      results,
      tokenUsage,
      cost,
      model
    })

  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

async function performTextSearch(project: any, query: string) {
  try {
    // Collect all transcription and summarization content
    const videoContent = project.videos.map((video: any) => {
      const transcriptionSegments = video.transcription?.segments || []
      const videoSegments = video.segments || []
      const videoTopics = video.topics || []

      return {
        videoId: video.id,
        videoTitle: video.title,
        transcriptionText: transcriptionSegments.map((seg: any) => 
          `[${seg.startingTimestamp}-${seg.endingTimestamp}] ${seg.transcription}`
        ).join('\n'),
        segmentSummaries: videoSegments.map((seg: any) => 
          `[${seg.startingTimestamp}-${seg.endingTimestamp}] ${seg.description}`
        ).join('\n'),
        topics: videoTopics.map((topic: any) => 
          `[${topic.startingTimestamp}-${topic.endingTimestamp}] Topic: ${topic.topic}`
        ).join('\n')
      }
    }).filter((content: any) => 
      content.transcriptionText || content.segmentSummaries || content.topics
    )

    if (videoContent.length === 0) {
      return { results: [], tokenUsage: 0, cost: 0, model: '' }
    }

    // Create a comprehensive prompt for OpenAI
    const contentForAnalysis = videoContent.map((content: any) => `
Video: ${content.videoTitle} (ID: ${content.videoId})

Transcription:
${content.transcriptionText}

Segment Summaries:
${content.segmentSummaries}

Topics:
${content.topics}
---
`).join('\n')

    const prompt = `
You are a video content search assistant. Given the following video content from a project, find the most relevant segments that match the user's search query.

Search Query: "${query}"

Video Content:
${contentForAnalysis}

Instructions:
1. Analyze the transcription, segment summaries, and topics to find content relevant to the search query
2. Return the most relevant matches with their exact timestamps
3. Provide a relevance score (0-1) for each match
4. Include a brief explanation of why each segment is relevant

Please respond with a JSON array of matches in this format:
[
  {
    "videoId": "video_id",
    "videoTitle": "video_title", 
    "timestamp": "HH.MM.SS-HH.MM.SS",
    "score": 0.95,
    "content": "relevant_text_excerpt",
    "explanation": "why_this_is_relevant"
  }
]

Only return matches with score >= 0.3. Return minimum 3 matches, maximum 5 matches.
`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano-2025-04-14',
      messages: [
        {
          role: 'system',
          content: 'You are a precise video content search assistant. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    })

    const aiResponse = response.choices[0]?.message?.content
    const tokenUsage = response.usage?.total_tokens || 0
    const cost = (tokenUsage * 0.00015) / 1000 // Estimated cost for gpt-4.1-nano

    let matches: any[] = []
    try {
      matches = JSON.parse(aiResponse || '[]')
    } catch (e) {
      console.error('Failed to parse AI response:', aiResponse)
      matches = []
    }

    // Convert AI matches to SearchResult format and limit to 3-5 results
    const limitedMatches = matches.slice(0, 5); // Max 5 results
    const finalMatches = limitedMatches.length < 3 && matches.length >= 3 ? matches.slice(0, 3) : limitedMatches; // Min 3 if available
    
    const results: SearchResult[] = finalMatches.map((match: any, index: number) => {
      // Generate a thumbnail URL based on timestamp if available
      let imageUrl = undefined;
      if (match.timestamp && match.videoId) {
        const timestampPart = match.timestamp.split('-')[0].replace(/\./g, '_');
        imageUrl = `/frames/${match.videoId}/frame_${timestampPart}.jpg`;
      }

      return {
        id: `text_${Date.now()}_${index}`,
        type: 'text' as const,
        videoId: match.videoId,
        videoTitle: match.videoTitle,
        timestamp: match.timestamp,
        score: match.score,
        content: match.content,
        imageUrl,
        metadata: {
          explanation: match.explanation,
          aiGenerated: true
        }
      }
    })

    return {
      results,
      tokenUsage,
      cost,
      model: 'gpt-4.1-nano-2025-04-14'
    }

  } catch (error) {
    console.error('Text search error:', error)
    return { results: [], tokenUsage: 0, cost: 0, model: '' }
  }
}

async function performPersonSearch(project: any, personImage: File): Promise<SearchResult[]> {
  try {
    // Convert image to embedding using OpenAI CLIP or similar
    // For now, we'll use Qdrant's vector search directly
    
    const collectionName = `${project.name}_person`
    
    // Convert image to base64
    const imageBuffer = await personImage.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    
    // Search in Qdrant person collection
    const searchResponse = await axios.post(`${QDRANT_BASE_URL}/collections/${collectionName}/points/search`, {
      vector: imageBase64, // This would need proper embedding conversion
      limit: 20,
      with_payload: true
    }, {
      headers: QDRANT_API_KEY ? {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    })

    const matches = searchResponse.data.result || []
    
    // Limit results to 3-5 results
    const limitedMatches = matches.slice(0, 5); // Max 5 results
    const finalMatches = limitedMatches.length < 3 && matches.length >= 3 ? matches.slice(0, 3) : limitedMatches; // Min 3 if available
    
    const results: SearchResult[] = finalMatches.map((match: any, index: number) => ({
      id: `person_${Date.now()}_${index}`,
      type: 'person' as const,
      videoId: match.payload?.videoId || '',
      videoTitle: match.payload?.videoTitle || 'Unknown Video',
      timestamp: match.payload?.timestamp || '',
      score: match.score || 0,
      content: `Person detected at ${match.payload?.timestamp}`,
      imageUrl: match.payload?.imageUrl || '',
      metadata: {
        personUid: match.payload?.personUid,
        qdrantId: match.id
      }
    }))

    return results

  } catch (error) {
    console.error('Person search error:', error)
    return []
  }
}

async function performFrameSearch(project: any, frameImage: File): Promise<SearchResult[]> {
  try {
    const collectionName = `${project.name}_frames`
    
    // Convert image to base64
    const imageBuffer = await frameImage.arrayBuffer()
    const imageBase64 = Buffer.from(imageBuffer).toString('base64')
    
    // Search in Qdrant frames collection
    const searchResponse = await axios.post(`${QDRANT_BASE_URL}/collections/${collectionName}/points/search`, {
      vector: imageBase64, // This would need proper embedding conversion
      limit: 20,
      with_payload: true
    }, {
      headers: QDRANT_API_KEY ? {
        'api-key': QDRANT_API_KEY,
        'Content-Type': 'application/json'
      } : {
        'Content-Type': 'application/json'
      }
    })

    const matches = searchResponse.data.result || []
    
    // Limit results to 3-5 results
    const limitedMatches = matches.slice(0, 5); // Max 5 results
    const finalMatches = limitedMatches.length < 3 && matches.length >= 3 ? matches.slice(0, 3) : limitedMatches; // Min 3 if available
    
    const results: SearchResult[] = finalMatches.map((match: any, index: number) => ({
      id: `frame_${Date.now()}_${index}`,
      type: 'frame' as const,
      videoId: match.payload?.videoId || '',
      videoTitle: match.payload?.videoTitle || 'Unknown Video',
      timestamp: match.payload?.timestamp || '',
      score: match.score || 0,
      content: `Similar frame found at ${match.payload?.timestamp}`,
      imageUrl: match.payload?.imageUrl || '',
      metadata: {
        qdrantId: match.id,
        frameIndex: match.payload?.frameIndex
      }
    }))

    return results

  } catch (error) {
    console.error('Frame search error:', error)
    return []
  }
} 