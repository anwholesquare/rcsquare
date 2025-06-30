'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Upload, User, Image as ImageIcon, Video, Clock, FileText, MessageSquare, Loader2, ArrowLeft, Play, Pause, Eye } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import Image from 'next/image'
import Link from 'next/link'
import axios from 'axios'

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

interface SearchHistory {
  id: string
  query: string
  searchType: string
  results: SearchResult[]
  tokenUsage: number
  cost: number
  createdAt: string
}

export default function ProjectSearchPage() {
  const params = useParams()
  const projectName = params.project_name as string
  
  const [isLoading, setIsLoading] = useState(true)
  const [projectExists, setProjectExists] = useState(false)
  const [activeTab, setActiveTab] = useState('text')
  const [searchLoading, setSearchLoading] = useState(false)
  
  // Search states
  const [textQuery, setTextQuery] = useState('')
  const [personImage, setPersonImage] = useState<File | null>(null)
  const [frameImage, setFrameImage] = useState<File | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  
  // Preview states
  const [personImagePreview, setPersonImagePreview] = useState<string>('')
  const [frameImagePreview, setFrameImagePreview] = useState<string>('')
  
  // Video playback states
  const [videoStates, setVideoStates] = useState<{[key: string]: boolean}>({}) // Track playing state for each video

  useEffect(() => {
    checkProjectExists()
  }, [projectName])

  const checkProjectExists = async () => {
    try {
      const response = await axios.get(`/api/projects/public?name=${projectName}`)
      setProjectExists(true)
      setIsLoading(false)
    } catch (error) {
      setProjectExists(false)
      setIsLoading(false)
    }
  }

  const handlePersonImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPersonImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setPersonImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleFrameImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFrameImage(file)
      const reader = new FileReader()
      reader.onload = (e) => setFrameImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleTextSearch = async () => {
    if (!textQuery.trim()) return
    
    setSearchLoading(true)
    try {
      const formData = new FormData()
      formData.append('projectName', projectName)
      formData.append('query', textQuery)
      formData.append('searchType', 'text')

      const response = await axios.post('/api/search', formData)
      setSearchResults(response.data.results)
    } catch (error) {
      console.error('Text search failed:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const handlePersonSearch = async () => {
    if (!personImage) return
    
    setSearchLoading(true)
    try {
      const formData = new FormData()
      formData.append('projectName', projectName)
      formData.append('personImage', personImage)
      formData.append('searchType', 'person')

      const response = await axios.post('/api/search', formData)
      setSearchResults(response.data.results)
    } catch (error) {
      console.error('Person search failed:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleFrameSearch = async () => {
    if (!frameImage) return
    
    setSearchLoading(true)
    try {
      const formData = new FormData()
      formData.append('projectName', projectName)
      formData.append('frameImage', frameImage)
      formData.append('searchType', 'frame')

      const response = await axios.post('/api/search', formData)
      setSearchResults(response.data.results)
    } catch (error) {
      console.error('Frame search failed:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const formatScore = (score: number) => {
    return (score * 100).toFixed(1)
  }

  const updateVideoState = (videoId: string, isPlaying: boolean) => {
    setVideoStates(prev => ({
      ...prev,
      [videoId]: isPlaying
    }))
  }

  const toggleVideoPlayback = (video: HTMLVideoElement, videoId: string) => {
    if (video.paused) {
      video.play().then(() => {
        updateVideoState(videoId, true)
        console.log('Video play started successfully')
      }).catch((err) => {
        console.error('Video play failed:', err)
      })
    } else {
      video.pause()
      updateVideoState(videoId, false)
      console.log('Video paused')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!projectExists) {
    return (
      <div className="flex h-screen flex-col">
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
              <h1 className="text-lg font-semibold">RCSquare Search</h1>
            </div>
            <div className="ml-auto">
              <ModeToggle />
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-8">
              <Search className="h-24 w-24 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-4xl font-bold mb-2">404</h1>
              <h2 className="text-2xl font-semibold mb-4">Project Not Found</h2>
              <p className="text-muted-foreground mb-6">
                The project "{projectName}" doesn't exist or has been removed.
              </p>
            </div>
            <Link href="/">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
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
            <h1 className="text-lg font-semibold">RCSquare Search</h1>
          </div>
          <div className="ml-auto flex items-center space-x-2">
            <Badge variant="outline">
              <Video className="mr-2 h-3 w-3" />
              {projectName}
            </Badge>
            <ModeToggle />
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
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">AI-Powered Video Search</h2>
            <p className="text-muted-foreground">
              Search through your video content using text, person recognition, or image similarity
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Search Options</CardTitle>
              <CardDescription>
                Choose your search method and find relevant content across all videos in this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Text Search
                  </TabsTrigger>
                  <TabsTrigger value="person" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Person Search
                  </TabsTrigger>
                  <TabsTrigger value="frame" className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Image Search
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Search Query
                      </label>
                      <Textarea
                        placeholder="Describe what you're looking for... (e.g., 'person explaining variables', 'code examples', 'debugging session')"
                        value={textQuery}
                        onChange={(e) => setTextQuery(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <Button 
                      onClick={handleTextSearch} 
                      disabled={!textQuery.trim() || searchLoading}
                      className="w-full"
                    >
                      {searchLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Search with AI
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="person" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Upload Person Image
                      </label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePersonImageChange}
                          className="hidden"
                          id="person-upload"
                        />
                        <label
                          htmlFor="person-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          {personImagePreview ? (
                            <div className="relative">
                              <Image
                                src={personImagePreview}
                                alt="Person preview"
                                width={200}
                                height={200}
                                className="rounded-lg object-cover"
                              />
                              <Badge className="absolute -top-2 -right-2">
                                Click to change
                              </Badge>
                            </div>
                          ) : (
                            <>
                              <User className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground text-center">
                                Click to upload a person image
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                    <Button 
                      onClick={handlePersonSearch} 
                      disabled={!personImage || searchLoading}
                      className="w-full"
                    >
                      {searchLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Find Similar Persons
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="frame" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Upload Image
                      </label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFrameImageChange}
                          className="hidden"
                          id="frame-upload"
                        />
                        <label
                          htmlFor="frame-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          {frameImagePreview ? (
                            <div className="relative">
                              <Image
                                src={frameImagePreview}
                                alt="Frame preview"
                                width={200}
                                height={200}
                                className="rounded-lg object-cover"
                              />
                              <Badge className="absolute -top-2 -right-2">
                                Click to change
                              </Badge>
                            </div>
                          ) : (
                            <>
                              <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground text-center">
                                Click to upload an image to find similar frames
                              </p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                    <Button 
                      onClick={handleFrameSearch} 
                      disabled={!frameImage || searchLoading}
                      className="w-full"
                    >
                      {searchLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Find Similar Images
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  Found {searchResults.length} relevant matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {searchResults.map((result) => (
                    <Card key={result.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-video bg-muted relative group cursor-pointer">
                        {/* Video Player */}
                        <video
                          className="w-full h-full object-cover"
                          poster={result.imageUrl}
                          preload="metadata"
                          controls
                          crossOrigin="anonymous"
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement;
                            console.error('Video failed to load:', {
                              src: target.src,
                              error: e,
                              networkState: target.networkState,
                              readyState: target.readyState
                            });
                            // Fallback to image if video fails
                            target.style.display = 'none';
                            const img = target.nextElementSibling as HTMLImageElement;
                            if (img) img.style.display = 'block';
                          }}
                          onLoadStart={(e) => {
                            console.log('Video load started:', (e.target as HTMLVideoElement).src);
                          }}
                          onLoadedData={(e) => {
                            console.log('Video data loaded:', (e.target as HTMLVideoElement).src);
                          }}
                          onLoadedMetadata={(e) => {
                            const video = e.target as HTMLVideoElement;
                            console.log('Video metadata loaded:', {
                              src: video.src,
                              duration: video.duration,
                              videoWidth: video.videoWidth,
                              videoHeight: video.videoHeight
                            });
                            
                            // Auto-seek to timestamp if available
                            if (result.timestamp) {
                              const timestampStart = result.timestamp.split('-')[0];
                              const [hours, minutes, seconds] = timestampStart.split('.').map(Number);
                              const seekTime = hours * 3600 + minutes * 60 + seconds;
                              
                              // Set current time after a small delay to ensure video is ready
                              setTimeout(() => {
                                video.currentTime = seekTime;
                                console.log(`Auto-seeked to ${seekTime}s for video ${result.videoId}`);
                              }, 100);
                            }
                          }}
                          onCanPlay={(e) => {
                            console.log('Video can play:', (e.target as HTMLVideoElement).src);
                          }}
                          onPlay={(e) => {
                            const video = e.target as HTMLVideoElement;
                            updateVideoState(result.id, true);
                            console.log('Video started playing:', result.id);
                          }}
                          onPause={(e) => {
                            const video = e.target as HTMLVideoElement;
                            updateVideoState(result.id, false);
                            console.log('Video paused:', result.id);
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
                                e.stopPropagation();
                                // Find the video element in the same card using more specific selector
                                const cardContent = e.currentTarget.closest('.p-4');
                                const card = cardContent?.parentElement;
                                const video = card?.querySelector('video') as HTMLVideoElement;
                                console.log('Play button clicked, video found:', !!video);
                                if (video) {
                                  toggleVideoPlayback(video, result.id);
                                }
                              }}
                            >
                              {videoStates[result.id] ? (
                                <>
                                  <Pause className="mr-1 h-3 w-3" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="mr-1 h-3 w-3" />
                                  Play
                                </>
                              )}
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
          )}
        </div>
      </div>
    </div>
  )
} 