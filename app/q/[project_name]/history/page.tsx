'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, User, Image as ImageIcon, Video, Clock, FileText, MessageSquare, ArrowLeft, Play, Eye } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import Image from 'next/image'
import Link from 'next/link'

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

export default function SearchHistoryPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectName = params.project_name as string
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchType, setSearchType] = useState<string>('')
  const [query, setQuery] = useState<string>('')

  useEffect(() => {
    // Get search data from URL parameters
    const type = searchParams.get('type') || ''
    const q = searchParams.get('query') || ''
    const resultsData = searchParams.get('results')
    
    setSearchType(type)
    setQuery(q)
    
    if (resultsData) {
      try {
        const parsedResults = JSON.parse(resultsData)
        setResults(parsedResults)
      } catch (error) {
        console.error('Failed to parse search results:', error)
        setResults([])
      }
    }
  }, [searchParams])

  const formatScore = (score: number) => {
    return (score * 100).toFixed(1)
  }

  const getSearchTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <MessageSquare className="h-4 w-4" />
      case 'person':
        return <User className="h-4 w-4" />
      case 'frame':
        return <ImageIcon className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const getSearchTypeColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
      case 'person':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
      case 'frame':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="RCSquare Logo"
              width={32}
              height={32}
              className="rounded"
            />
            <h1 className="text-lg font-semibold">Search History</h1>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <Badge variant="outline">
              <Video className="mr-2 h-3 w-3" />
              {projectName}
            </Badge>
            <ModeToggle />
            <Link href={`/q/${projectName}`}>
              <Button variant="outline" size="sm">
                <Search className="mr-2 h-4 w-4" />
                New Search
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search Info Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getSearchTypeColor(searchType)}`}>
                    {getSearchTypeIcon(searchType)}
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Historical Search Results
                    </CardTitle>
                    <CardDescription>
                      {searchType === 'text' ? `Text search: "${query}"` : `${searchType} search`} • {results.length} results found
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className={getSearchTypeColor(searchType)}>
                  {searchType.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Search Results */}
          {results.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  Results as they appeared during the original search
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {results.map((result) => (
                    <Card key={result.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-video bg-muted relative group cursor-pointer">
                        {/* Video Player */}
                                                <video
                          className="w-full h-full object-cover"
                          poster={result.imageUrl}
                          preload="metadata"
                          controls
                          onError={(e) => {
                            // Fallback to image if video fails
                            const target = e.target as HTMLVideoElement;
                            target.style.display = 'none';
                            const img = target.nextElementSibling as HTMLImageElement;
                            if (img) img.style.display = 'block';
                          }}
                          onLoadedMetadata={(e) => {
                            // Auto-seek to timestamp if available
                            if (result.timestamp) {
                              const video = e.target as HTMLVideoElement;
                              const timestampStart = result.timestamp.split('-')[0];
                              const [hours, minutes, seconds] = timestampStart.split('.').map(Number);
                              const seekTime = hours * 3600 + minutes * 60 + seconds;
                              video.currentTime = seekTime;
                            }
                          }}
                        >
                          <source src={`http://localhost:3001/api/video/${result.videoId.substring(0, 8)}?project=${projectName}`} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        
                        {/* Fallback Image */}
                        {result.imageUrl && (
                          <Image
                            src={result.imageUrl}
                            alt="Result thumbnail"
                            fill
                            className="object-cover"
                            style={{ display: 'none' }}
                          />
                        )}
                        

                        
                        {/* Score Badge */}
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary">
                            {formatScore(result.score)}% match
                          </Badge>
                        </div>
                        

                      </div>
                      
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm mb-1 line-clamp-1">
                          {result.videoTitle}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {result.content}
                        </p>
                        {result.timestamp && (
                          <div className="flex items-center text-xs text-muted-foreground mb-2">
                            <Clock className="mr-1 h-3 w-3" />
                            <span>Timestamp: {result.timestamp}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {result.type}
                          </Badge>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs h-6"
                              onClick={(e) => {
                                // Find the video element in the same card
                                const card = e.currentTarget.closest('.overflow-hidden');
                                const video = card?.querySelector('video') as HTMLVideoElement;
                                if (video) {
                                  if (video.paused) {
                                    video.play();
                                  } else {
                                    video.pause();
                                  }
                                }
                              }}
                            >
                              <Play className="mr-1 h-3 w-3" />
                              Play
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-6"
                                                             onClick={() => {
                                const videoUrl = `http://localhost:3001/api/video/${result.videoId.substring(0, 8)}?project=${projectName}`;
                                if (result.timestamp) {
                                  const timestampStart = result.timestamp.split('-')[0];
                                  const [hours, minutes, seconds] = timestampStart.split('.').map(Number);
                                  const seekTime = hours * 3600 + minutes * 60 + seconds;
                                  window.open(`${videoUrl}#t=${seekTime}`, '_blank');
                                } else {
                                  window.open(videoUrl, '_blank');
                                }
                              }}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              Full View
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                <p className="text-muted-foreground mb-4">
                  There are no search results to display for this search.
                </p>
                <Link href={`/q/${projectName}`}>
                  <Button>
                    <Search className="mr-2 h-4 w-4" />
                    Start New Search
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 