'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileVideo, Calendar, Tag, FileText, Edit3, Trash2, Eye, RefreshCw, Play, Pause, Camera, MessageSquare, Users, Settings, Clock, X, Plus } from 'lucide-react'

interface Video {
  id: string
  title: string
  description?: string
  tags?: string
  filename: string
  originalUrl?: string
  fileSize?: number
  duration?: number
  createdAt: string
  updatedAt: string
  frameAnalysis?: FrameAnalysis
  transcription?: Transcription
  segments?: VideoSegment[]
  topics?: VideoTopic[]
}

interface FrameAnalysis {
  id: string
  videoId: string
  frameSampling: number
  status: string
  totalFrames?: number
  processedAt?: string
  frames: Frame[]
  captions: Caption[]
  persons: Person[]
}

interface Frame {
  id: string
  timestamp: string
  imageLink: string
  clipEmbedding?: string
}

interface Caption {
  id: string
  timestamp: string
  imageLink: string
  caption: string
  captionEmbedding?: string
}

interface Person {
  id: string
  timestamp: string
  imageLink: string
  personUid: string
  clipEmbedding?: string
}

interface Transcription {
  id: string
  videoId: string
  status: string
  model: string
  language?: string
  totalSegments?: number
  totalDuration?: number
  processedAt?: string
  errorMessage?: string
  segments: TranscriptionSegment[]
}

interface TranscriptionSegment {
  id: string
  transcriptionId: string
  segmentIndex: number
  startingTimestamp: string
  endingTimestamp: string
  startSeconds: number
  endSeconds: number
  transcription: string
  refinedTranscription?: string
  confidence?: number
  isEdited: boolean
}

interface VideoSegment {
  id: string
  videoId: string
  segmentIndex: number
  startingTimestamp: string
  endingTimestamp: string
  startSeconds: number
  endSeconds: number
  description: string
  status: string
  model?: string
  createdAt: string
  updatedAt: string
}

interface VideoTopic {
  id: string
  videoId: string
  topicIndex: number
  startingTimestamp: string
  endingTimestamp: string
  startSeconds: number
  endSeconds: number
  topic: string
  status: string
  model?: string
  createdAt: string
  updatedAt: string
}

interface Project {
  id: string
  name: string
  videos: Video[]
}

interface VideoListProps {
  projectName: string
}

export function VideoList({ projectName }: VideoListProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', tags: '' })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [playingVideos, setPlayingVideos] = useState<Set<string>>(new Set())
  const [extractingFrames, setExtractingFrames] = useState<Set<string>>(new Set())
  const [frameExtractionSettings, setFrameExtractionSettings] = useState<{ [key: string]: number }>({})
  const [showAnalysisDetails, setShowAnalysisDetails] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<FrameAnalysis | null>(null)
  const [visibleFrames, setVisibleFrames] = useState(12)
  const [visibleCaptions, setVisibleCaptions] = useState(8)
  const [visiblePersons, setVisiblePersons] = useState(16)
  const [activeTab, setActiveTab] = useState<'frames' | 'captions' | 'persons' | 'transcription'>('frames')
  
  // Transcription state
  const [transcribingVideos, setTranscribingVideos] = useState<Set<string>>(new Set())
  const [showTranscriptionDetails, setShowTranscriptionDetails] = useState<string | null>(null)
  const [transcriptionData, setTranscriptionData] = useState<Transcription | null>(null)
  const [editingSegment, setEditingSegment] = useState<TranscriptionSegment | null>(null)
  const [editingSegmentText, setEditingSegmentText] = useState('')
  const [transcriptionSettings, setTranscriptionSettings] = useState<{ [key: string]: { refineWithLlm: boolean, model: string } }>({})
  const [visibleSegments, setVisibleSegments] = useState(20)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)

  // Summarization state
  const [summarizingVideos, setSummarizingVideos] = useState<Set<string>>(new Set())
  const [showSummarizationDetails, setShowSummarizationDetails] = useState<string | null>(null)
  const [summarizationData, setSummarizationData] = useState<{ segments: VideoSegment[], topics: VideoTopic[] } | null>(null)
  const [summarizationSettings, setSummarizationSettings] = useState<{ [key: string]: { model: string, segmentDuration: number } }>({})
  const [visibleSummarySegments, setVisibleSummarySegments] = useState(10)
  const [visibleTopics, setVisibleTopics] = useState(5)

  // Placeholder images as data URIs
  const placeholderImage = "data:image/svg+xml;base64," + btoa(`
    <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
      <rect width="300" height="200" fill="#f1f5f9"/>
      <g fill="#64748b">
        <rect x="125" y="80" width="50" height="30" rx="3"/>
        <circle cx="135" cy="85" r="3"/>
        <polygon points="140,95 150,85 160,95"/>
      </g>
      <text x="150" y="130" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="12">
        Image not available
      </text>
    </svg>
  `)

  const placeholderPerson = "data:image/svg+xml;base64," + btoa(`
    <svg width="150" height="150" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150">
      <rect width="150" height="150" fill="#f1f5f9"/>
      <g fill="#64748b">
        <circle cx="75" cy="55" r="20"/>
        <path d="M75 85 C95 85, 105 95, 105 115 L105 130 L45 130 L45 115 C45 95, 55 85, 75 85 Z"/>
      </g>
      <text x="75" y="140" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="10">
        Person
      </text>
    </svg>
  `)

  const fetchVideos = async (isAutoRefresh = false) => {
    if (!isAutoRefresh) {
      setIsLoading(true)
    } else {
      setIsAutoRefreshing(true)
    }
    setError(null)

    try {
      const response = await axios.get(`/api/projects?name=${projectName}`, {
        headers: {
          'x-security-key': '123_RAGISACTIVATED_321',
        },
      })

      setProject(response.data.project)
    } catch (err: any) {
      if (!isAutoRefresh) {
        setError(err.response?.data?.error || 'Failed to load videos')
      }
    } finally {
      if (!isAutoRefresh) {
        setIsLoading(false)
      } else {
        setIsAutoRefreshing(false)
      }
    }
  }

  useEffect(() => {
    if (projectName) {
      fetchVideos()
    }
  }, [projectName])

  // Auto-refresh for processing states (less frequent to reduce flickering)
  useEffect(() => {
    const hasProcessingAnalysis = project?.videos.some(video => 
      video.frameAnalysis?.status === 'processing' || extractingFrames.has(video.id)
    )
    const hasProcessingTranscription = project?.videos.some(video => 
      video.transcription?.status === 'processing' || transcribingVideos.has(video.id)
    )
    const hasProcessingSummarization = project?.videos.some(video => 
      video.segments?.some(segment => segment.status === 'processing') || 
      video.topics?.some(topic => topic.status === 'processing') ||
      summarizingVideos.has(video.id)
    )

    if (hasProcessingAnalysis || hasProcessingTranscription || hasProcessingSummarization) {
      const interval = setInterval(async () => {
        // Silent refresh - don't show loading state to avoid flickering
        try {
          await fetchVideos(true) // Pass true to indicate auto-refresh
        } catch (error) {
          // Silently handle errors during auto-refresh
          console.log('Auto-refresh error:', error)
        }
      }, 10000) // Refresh every 10 seconds (reduced frequency)

      return () => clearInterval(interval)
    }
  }, [project, extractingFrames, transcribingVideos])

  const handleEdit = (video: Video) => {
    setEditingVideo(video)
    setEditForm({
      title: video.title,
      description: video.description || '',
      tags: video.tags || ''
    })
  }

  const handleUpdate = async () => {
    if (!editingVideo) return

    setIsUpdating(true)
    try {
      await axios.put('/api/videos', {
        id: editingVideo.id,
        title: editForm.title,
        description: editForm.description,
        tags: editForm.tags
      }, {
        headers: {
          'x-security-key': '123_RAGISACTIVATED_321',
        },
      })

      setEditingVideo(null)
      fetchVideos()
    } catch (err: any) {
      setError('Failed to update video')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (videoId: string) => {
    setIsDeleting(videoId)
    try {
      await axios.delete(`/api/videos?id=${videoId}`, {
        headers: {
          'x-security-key': '123_RAGISACTIVATED_321',
        },
      })

      fetchVideos()
    } catch (err: any) {
      setError('Failed to delete video')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleVideoPlay = (videoId: string) => {
    setPlayingVideos(prev => new Set([...prev, videoId]))
  }

  const handleVideoPause = (videoId: string) => {
    setPlayingVideos(prev => {
      const newSet = new Set(prev)
      newSet.delete(videoId)
      return newSet
    })
  }

  const handleVideoEnded = (videoId: string) => {
    setPlayingVideos(prev => {
      const newSet = new Set(prev)
      newSet.delete(videoId)
      return newSet
    })
  }

  const handleExtractFrames = async (videoId: string) => {
    const frameSampling = frameExtractionSettings[videoId] || 5
    setExtractingFrames(prev => new Set([...prev, videoId]))
    
    try {
      const response = await axios.post('http://localhost:3001/api/extract-frames', {
        videoId,
        projectName,
        frameSampling
      }, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      if (response.data.success) {
        // Refresh video list to get updated frame analysis
        setTimeout(() => {
          fetchVideos()
        }, 2000) // Give some time for processing to start
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start frame extraction')
    } finally {
      setExtractingFrames(prev => {
        const newSet = new Set(prev)
        newSet.delete(videoId)
        return newSet
      })
    }
  }

  const handleShowAnalysisDetails = async (analysisId: string) => {
    setShowAnalysisDetails(analysisId)
    
    try {
      const response = await axios.get(`http://localhost:3001/api/frame-analysis/${analysisId}`, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      if (response.data.success) {
        setAnalysisData(response.data.analysis)
      }
    } catch (err: any) {
      setError('Failed to load analysis details')
    }
  }

  const updateFrameSampling = (videoId: string, value: number) => {
    setFrameExtractionSettings(prev => ({
      ...prev,
      [videoId]: value
    }))
  }

  // Transcription handlers
  const handleTranscribeVideo = async (videoId: string) => {
    const settings = transcriptionSettings[videoId] || { refineWithLlm: true, model: 'whisper-base' }
    setTranscribingVideos(prev => new Set([...prev, videoId]))
    
    try {
      const response = await axios.post('http://localhost:3001/api/transcribe-video', {
        videoId,
        projectName,
        model: settings.model,
        refineWithLlm: settings.refineWithLlm
      }, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      if (response.data.success) {
        // Refresh video list to get updated transcription
        setTimeout(() => {
          fetchVideos()
        }, 2000) // Give some time for processing to start
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start transcription')
    } finally {
      setTranscribingVideos(prev => {
        const newSet = new Set(prev)
        newSet.delete(videoId)
        return newSet
      })
    }
  }

  const handleShowTranscriptionDetails = async (transcriptionId: string) => {
    setShowTranscriptionDetails(transcriptionId)
    
    try {
      const response = await axios.get(`http://localhost:3001/api/transcription/${transcriptionId}`, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      if (response.data.transcription) {
        setTranscriptionData(response.data.transcription)
      }
    } catch (err: any) {
      setError('Failed to load transcription details')
    }
  }

  const handleEditSegment = (segment: TranscriptionSegment) => {
    setEditingSegment(segment)
    setEditingSegmentText(segment.refinedTranscription || segment.transcription)
  }

  const handleSaveSegmentEdit = async () => {
    if (!editingSegment) return

    try {
      await axios.put('http://localhost:3001/api/transcription-segments', {
        id: editingSegment.id,
        refinedTranscription: editingSegmentText,
        isEdited: true
      }, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })

      // Update local transcription data
      if (transcriptionData) {
        const updatedSegments = transcriptionData.segments.map(seg => 
          seg.id === editingSegment.id 
            ? { ...seg, refinedTranscription: editingSegmentText, isEdited: true }
            : seg
        )
        setTranscriptionData({ ...transcriptionData, segments: updatedSegments })
      }

      setEditingSegment(null)
      setEditingSegmentText('')
    } catch (err: any) {
      setError('Failed to save segment edit')
    }
  }

  const updateTranscriptionSettings = (videoId: string, settings: { refineWithLlm: boolean, model: string }) => {
    setTranscriptionSettings(prev => ({
      ...prev,
      [videoId]: settings
    }))
  }

  // Video Summarization handlers
  const handleSummarizeVideo = async (videoId: string) => {
    try {
      const settings = summarizationSettings[videoId] || { model: 'gpt-4o-mini', segmentDuration: 60 }
      
      setSummarizingVideos(prev => new Set(prev).add(videoId))
      
      await axios.post('http://localhost:3001/api/summarize-video', {
        video_id: videoId,
        model: settings.model,
        segment_duration: settings.segmentDuration
      }, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      // Remove from processing set after a short delay to allow for UI feedback
      setTimeout(() => {
        setSummarizingVideos(prev => {
          const newSet = new Set(prev)
          newSet.delete(videoId)
          return newSet
        })
      }, 2000)
      
    } catch (err: any) {
      setError('Failed to start video summarization')
      setSummarizingVideos(prev => {
        const newSet = new Set(prev)
        newSet.delete(videoId)
        return newSet
      })
    }
  }

  const handleShowSummarizationDetails = async (videoId: string) => {
    try {
      setShowSummarizationDetails(videoId)
      
      // Fetch segments
      const segmentsResponse = await axios.get(`http://localhost:3001/api/video-segments/${videoId}`, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      // Fetch topics
      const topicsResponse = await axios.get(`http://localhost:3001/api/video-topics/${videoId}`, {
        headers: {
          'X-Security-Key': '123_RAGISACTIVATED_321',
        },
      })
      
      setSummarizationData({
        segments: segmentsResponse.data || [],
        topics: topicsResponse.data || []
      })
    } catch (err: any) {
      setError('Failed to load summarization details')
    }
  }

  const updateSummarizationSettings = (videoId: string, settings: { model: string, segmentDuration: number }) => {
    setSummarizationSettings(prev => ({
      ...prev,
      [videoId]: settings
    }))
  }

  const exportSummarizationAsJson = (videoId: string, segments: VideoSegment[], topics: VideoTopic[]) => {
    const exportData = {
      video_id: videoId,
      segments: segments.map(segment => ({
        starting_timestamp: segment.startingTimestamp,
        ending_timestamp: segment.endingTimestamp,
        description: segment.description,
        created_at: segment.createdAt,
        updated_at: segment.updatedAt
      })),
      topics: topics.map(topic => ({
        starting_timestamp: topic.startingTimestamp,
        ending_timestamp: topic.endingTimestamp,
        topic: topic.topic,
        created_at: topic.createdAt,
        updated_at: topic.updatedAt
      }))
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `summarization_${videoId}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const exportTranscriptionAsJson = (transcription: Transcription) => {
    const exportData = {
      video_id: transcription.videoId,
      language: transcription.language,
      model: transcription.model,
      total_duration: transcription.totalDuration,
      captions: transcription.segments.map(segment => ({
        starting_timestamp: segment.startingTimestamp,
        ending_timestamp: segment.endingTimestamp,
        transcription: segment.refinedTranscription || segment.transcription
      }))
    }
    
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `transcription_${transcription.videoId}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="text-xs">Completed</Badge>
      case 'processing':
        return <Badge variant="secondary" className="text-xs">Processing</Badge>
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Pending</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const formatTags = (tags?: string) => {
    if (!tags) return []
    return tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
  }

  const getVideoUrl = (filename: string) => {
    return `http://localhost:3001/api/video/${filename.replace(/\.[^/.]+$/, "")}?project=${projectName}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!project || project.videos.length === 0) {
    return (
      <div className="text-center py-8">
        <FileVideo className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No videos found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload your first video to get started
        </p>
        <Button onClick={() => fetchVideos()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {project.videos.length} video{project.videos.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => fetchVideos()} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 transition-all duration-300 ease-in-out">
        {project.videos.map((video) => {
          const isPlaying = playingVideos.has(video.id)
          
          return (
            <Card key={video.id} className="overflow-hidden">
              <div className="aspect-video bg-muted relative group">
                <video
                  className="w-full h-full object-cover"
                  preload="metadata"
                  controls
                  src={getVideoUrl(video.filename)}
                  onPlay={() => handleVideoPlay(video.id)}
                  onPause={() => handleVideoPause(video.id)}
                  onEnded={() => handleVideoEnded(video.id)}
                >
                  Your browser does not support the video tag.
                </video>
                {!isPlaying && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                )}
              </div>
              
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base line-clamp-2">{video.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(video.fileSize)}
                      </Badge>
                      {video.originalUrl && (
                        <Badge variant="outline" className="text-xs">
                          YouTube
                        </Badge>
                      )}
                      {isPlaying && (
                        <Badge variant="outline" className="text-xs">
                          Playing
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(video)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(video.id)}
                      disabled={isDeleting === video.id}
                    >
                      {isDeleting === video.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {video.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{video.description}</p>
                )}
                
                {video.tags && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {formatTags(video.tags).slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {formatTags(video.tags).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{formatTags(video.tags).length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Frame Analysis Section */}
                <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Frame Analysis
                  </h4>
                  
                  {video.frameAnalysis ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(video.frameAnalysis.status)}
                        {video.frameAnalysis.totalFrames && (
                          <span className="text-xs text-muted-foreground">
                            {video.frameAnalysis.totalFrames} frames
                          </span>
                        )}
                      </div>
                      
                      {video.frameAnalysis.status === 'completed' && (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowAnalysisDetails(video.frameAnalysis!.id)}
                            className="text-xs h-6"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Frames ({video.frameAnalysis.frames.length})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowAnalysisDetails(video.frameAnalysis!.id)}
                            className="text-xs h-6"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Captions ({video.frameAnalysis.captions.length})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowAnalysisDetails(video.frameAnalysis!.id)}
                            className="text-xs h-6"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Persons ({video.frameAnalysis.persons.length})
                          </Button>
                        </div>
                      )}
                      
                      {video.frameAnalysis.status !== 'processing' && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`sampling-${video.id}`} className="text-xs">
                            Frame Sampling (sec):
                          </Label>
                          <Input
                            id={`sampling-${video.id}`}
                            type="number"
                            min="1"
                            max="60"
                            value={frameExtractionSettings[video.id] || video.frameAnalysis.frameSampling}
                            onChange={(e) => updateFrameSampling(video.id, parseInt(e.target.value))}
                            className="w-16 h-6 text-xs"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleExtractFrames(video.id)}
                            disabled={extractingFrames.has(video.id)}
                            className="text-xs h-6"
                          >
                            {extractingFrames.has(video.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Regenerate
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Extract frames for image captioning and person detection
                      </p>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`sampling-${video.id}`} className="text-xs">
                          Frame Sampling (sec):
                        </Label>
                        <Input
                          id={`sampling-${video.id}`}
                          type="number"
                          min="1"
                          max="60"
                          value={frameExtractionSettings[video.id] || 5}
                          onChange={(e) => updateFrameSampling(video.id, parseInt(e.target.value))}
                          className="w-16 h-6 text-xs"
                        />
                        {extractingFrames.has(video.id) ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                                                             <span>Extracting frames (1 every {frameExtractionSettings[video.id] || 5}s)...</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                              <div className="bg-green-600 h-1.5 rounded-full animate-pulse" style={{ width: '45%' }}></div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Analyzing video content • Please wait
                            </p>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleExtractFrames(video.id)}
                            disabled={extractingFrames.has(video.id)}
                            className="text-xs h-6"
                          >
                            <Camera className="h-3 w-3 mr-1" />
                            Extract Frames
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Audio Transcription Section */}
                <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Audio Transcription
                  </h4>
                  
                  {video.transcription ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(video.transcription.status)}
                        {video.transcription.totalSegments && (
                          <span className="text-xs text-muted-foreground">
                            {video.transcription.totalSegments} segments
                          </span>
                        )}
                        {video.transcription.language && (
                          <span className="text-xs text-muted-foreground">
                            • {video.transcription.language}
                          </span>
                        )}
                        {/* {video.transcription.totalDuration && (
                          <span className="text-xs text-muted-foreground">
                            • {Math.round(video.transcription.totalDuration)}s
                          </span>
                        )} */}
                      </div>
                      
                      {video.transcription.status === 'completed' && (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowTranscriptionDetails(video.transcription!.id)}
                            className="text-xs h-6"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Segments ({video.transcription.totalSegments})
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportTranscriptionAsJson(video.transcription!)}
                            className="text-xs h-6"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Export JSON
                          </Button>
                        </div>
                      )}
                      
                      {video.transcription.status !== 'processing' && (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`llm-refine-${video.id}`} className="text-xs whitespace-nowrap">
                                Refine with LLM:
                              </Label>
                              <input
                                id={`llm-refine-${video.id}`}
                                type="checkbox"
                                checked={transcriptionSettings[video.id]?.refineWithLlm ?? true}
                                onChange={(e) => updateTranscriptionSettings(video.id, {
                                  ...transcriptionSettings[video.id],
                                  refineWithLlm: e.target.checked,
                                  model: transcriptionSettings[video.id]?.model || 'whisper-base'
                                })}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`model-${video.id}`} className="text-xs whitespace-nowrap">
                                Model:
                              </Label>
                              <select
                                id={`model-${video.id}`}
                                value={transcriptionSettings[video.id]?.model || 'whisper-base'}
                                onChange={(e) => updateTranscriptionSettings(video.id, {
                                  ...transcriptionSettings[video.id],
                                  refineWithLlm: transcriptionSettings[video.id]?.refineWithLlm ?? true,
                                  model: e.target.value
                                })}
                                className="text-xs border rounded px-1 h-6 bg-background"
                              >
                                <option value="whisper-base">Base</option>
                                <option value="whisper-small">Small</option>
                                <option value="whisper-medium">Medium</option>
                              </select>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleTranscribeVideo(video.id)}
                            disabled={transcribingVideos.has(video.id)}
                            className="text-xs h-6 w-full sm:w-auto"
                          >
                            {transcribingVideos.has(video.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            {video.transcription.status === 'completed' ? 'Regenerate' : 'Retry'}
                          </Button>
                        </div>
                      )}
                      
                      {video.transcription.status === 'processing' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Transcribing audio with {video.transcription.model}...</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                            <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Processing audio • This may take a few minutes
                          </p>
                        </div>
                      )}
                      
                      {video.transcription.status === 'failed' && (
                        <div className="space-y-2">
                          <p className="text-xs text-red-500">
                            Transcription failed: {video.transcription.errorMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Transcribe audio using Whisper AI with optional LLM refinement
                      </p>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`llm-refine-${video.id}`} className="text-xs whitespace-nowrap">
                              Refine with LLM:
                            </Label>
                            <input
                              id={`llm-refine-${video.id}`}
                              type="checkbox"
                              checked={transcriptionSettings[video.id]?.refineWithLlm ?? true}
                              onChange={(e) => updateTranscriptionSettings(video.id, {
                                ...transcriptionSettings[video.id],
                                refineWithLlm: e.target.checked,
                                model: transcriptionSettings[video.id]?.model || 'whisper-base'
                              })}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`model-${video.id}`} className="text-xs whitespace-nowrap">
                              Model:
                            </Label>
                            <select
                              id={`model-${video.id}`}
                              value={transcriptionSettings[video.id]?.model || 'whisper-base'}
                              onChange={(e) => updateTranscriptionSettings(video.id, {
                                ...transcriptionSettings[video.id],
                                refineWithLlm: transcriptionSettings[video.id]?.refineWithLlm ?? true,
                                model: e.target.value
                              })}
                              className="text-xs border rounded px-1 h-6 bg-background"
                            >
                              <option value="whisper-base">Base</option>
                              <option value="whisper-small">Small</option>
                              <option value="whisper-medium">Medium</option>
                            </select>
                          </div>
                        </div>
                        {transcribingVideos.has(video.id) ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Transcribing audio...</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                              <div className="bg-blue-600 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Processing audio • This may take a few minutes
                            </p>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleTranscribeVideo(video.id)}
                            disabled={transcribingVideos.has(video.id)}
                            className="text-xs h-6 w-full sm:w-auto"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Transcribe Audio
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Video Summarization Section */}
                <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Video Summarization
                  </h4>
                  
                  {video.segments && video.segments.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(video.segments[0]?.status || 'pending')}
                        <span className="text-xs text-muted-foreground">
                          {video.segments.length} segments
                        </span>
                        {video.topics && video.topics.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            • {video.topics.length} topics
                          </span>
                        )}
                        {video.segments[0]?.model && (
                          <span className="text-xs text-muted-foreground">
                            • {video.segments[0].model}
                          </span>
                        )}
                      </div>
                      
                      {video.segments[0]?.status === 'completed' && (
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleShowSummarizationDetails(video.id)}
                            className="text-xs h-6"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Summary ({video.segments.length + (video.topics?.length || 0)})
                          </Button>
                                                     <Button
                             size="sm"
                             variant="outline"
                             onClick={() => exportSummarizationAsJson(video.id, video.segments || [], video.topics || [])}
                             className="text-xs h-6"
                           >
                            <FileText className="h-3 w-3 mr-1" />
                            Export JSON
                          </Button>
                        </div>
                      )}
                      
                      {video.segments[0]?.status !== 'processing' && (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`gpt-model-${video.id}`} className="text-xs whitespace-nowrap">
                                GPT Model:
                              </Label>
                              <select
                                id={`gpt-model-${video.id}`}
                                value={summarizationSettings[video.id]?.model || 'gpt-4o-mini-2024-07-18'}
                                onChange={(e) => updateSummarizationSettings(video.id, {
                                  ...summarizationSettings[video.id],
                                  model: e.target.value,
                                  segmentDuration: summarizationSettings[video.id]?.segmentDuration || 60
                                })}
                                className="text-xs border rounded px-1 h-6 bg-background"
                              >
                                <option value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano</option>
                                <option value="gpt-4o-mini-2024-07-18">GPT-4o Mini</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`segment-duration-${video.id}`} className="text-xs whitespace-nowrap">
                                Segment (sec):
                              </Label>
                              <Input
                                id={`segment-duration-${video.id}`}
                                type="number"
                                min="30"
                                max="300"
                                value={summarizationSettings[video.id]?.segmentDuration || 60}
                                onChange={(e) => updateSummarizationSettings(video.id, {
                                  ...summarizationSettings[video.id],
                                  model: summarizationSettings[video.id]?.model || 'gpt-4o-mini-2024-07-18',
                                  segmentDuration: parseInt(e.target.value) || 60
                                })}
                                className="text-xs h-6 w-16"
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSummarizeVideo(video.id)}
                            disabled={summarizingVideos.has(video.id)}
                            className="text-xs h-6 w-full sm:w-auto"
                          >
                            {summarizingVideos.has(video.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            {video.segments[0]?.status === 'completed' ? 'Regenerate' : 'Retry'}
                          </Button>
                        </div>
                      )}
                      
                      {video.segments[0]?.status === 'processing' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Generating summaries with {video.segments[0]?.model}...</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                            <div className="bg-purple-600 h-1.5 rounded-full animate-pulse" style={{ width: '40%' }}></div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Processing segments and topics • This may take several minutes
                          </p>
                        </div>
                      )}
                      
                      {video.segments[0]?.status === 'failed' && (
                        <div className="space-y-2">
                          <p className="text-xs text-red-500">
                            Summarization failed. Please try again.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Generate AI-powered video summaries and contextual topics using GPT models
                      </p>
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`gpt-model-${video.id}`} className="text-xs whitespace-nowrap">
                              GPT Model:
                            </Label>
                            <select
                              id={`gpt-model-${video.id}`}
                              value={summarizationSettings[video.id]?.model || 'gpt-4o-mini-2024-07-18'}
                              onChange={(e) => updateSummarizationSettings(video.id, {
                                ...summarizationSettings[video.id],
                                model: e.target.value,
                                segmentDuration: summarizationSettings[video.id]?.segmentDuration || 60
                              })}
                              className="text-xs border rounded px-1 h-6 bg-background"
                            >
                              <option value="gpt-4.1-nano-2025-04-14">GPT-4.1 Nano</option>
                              <option value="gpt-4o-mini-2024-07-18">GPT-4o Mini</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`segment-duration-${video.id}`} className="text-xs whitespace-nowrap">
                              Segment (sec):
                            </Label>
                            <Input
                              id={`segment-duration-${video.id}`}
                              type="number"
                              min="30"
                              max="300"
                              value={summarizationSettings[video.id]?.segmentDuration || 60}
                              onChange={(e) => updateSummarizationSettings(video.id, {
                                ...summarizationSettings[video.id],
                                model: summarizationSettings[video.id]?.model || 'gpt-4o-mini-2024-07-18',
                                segmentDuration: parseInt(e.target.value) || 60
                              })}
                              className="text-xs h-6 w-16"
                            />
                          </div>
                        </div>
                        {summarizingVideos.has(video.id) ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Generating summaries...</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                              <div className="bg-purple-600 h-1.5 rounded-full animate-pulse" style={{ width: '40%' }}></div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Processing segments and topics • This may take several minutes
                            </p>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSummarizeVideo(video.id)}
                            disabled={summarizingVideos.has(video.id)}
                            className="text-xs h-6 w-full sm:w-auto"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Generate Summary
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(video.createdAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      {editingVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
            <CardHeader>
              <CardTitle>Edit Video</CardTitle>
              <CardDescription>
                Update video information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Enter video description..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags</Label>
                <Input
                  id="edit-tags"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingVideo(null)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isUpdating} className="w-full sm:w-auto">
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Details Dialog */}
      {showAnalysisDetails && analysisData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-7xl max-h-[95vh] overflow-hidden shadow-2xl">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Camera className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    Frame Analysis Results
                  </CardTitle>
                  <CardDescription className="mt-2 flex flex-wrap gap-4">
                    <Badge variant="outline" className="bg-white/50">
                      <Clock className="h-3 w-3 mr-1" />
                      Sampling: {analysisData.frameSampling}s
                    </Badge>
                    <Badge variant="outline" className={analysisData.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>
                      Status: {analysisData.status}
                    </Badge>
                    <Badge variant="outline" className="bg-white/50">
                      Total Frames: {analysisData.totalFrames || 0}
                    </Badge>
                  </CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    setShowAnalysisDetails(null)
                    setAnalysisData(null)
                    setVisibleFrames(12)
                    setVisibleCaptions(8)
                    setVisiblePersons(16)
                    setActiveTab('frames')
                  }}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-1 mt-4 bg-white/50 dark:bg-black/20 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('frames')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'frames' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  Frames ({analysisData.frames?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('captions')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'captions' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  Captions ({analysisData.captions?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('persons')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'persons' 
                      ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Persons ({analysisData.persons?.length || 0})
                </button>
              </div>
            </CardHeader>
            
            <CardContent className="overflow-y-auto max-h-[calc(95vh-12rem)] p-6">
              {/* Frames Tab */}
              {activeTab === 'frames' && (
                <div className="space-y-6">
                  {analysisData.frames && analysisData.frames.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {analysisData.frames.slice(0, visibleFrames).map((frame, index) => (
                          <div key={frame.id} className="group relative bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 border border-slate-200 dark:border-slate-700">
                            <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                              <img
                                src={`http://localhost:3001${frame.imageLink}`}
                                alt={`Frame at ${frame.timestamp}`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.src = placeholderImage
                                }}
                              />
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-800">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                  #{index + 1}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {frame.timestamp}
                                </Badge>
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-200 pointer-events-none" />
                          </div>
                        ))}
                      </div>
                      
                      {analysisData.frames.length > visibleFrames && (
                        <div className="text-center">
                          <Button 
                            variant="outline" 
                            onClick={() => setVisibleFrames(prev => prev + 12)}
                            className="bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Load More ({analysisData.frames.length - visibleFrames} remaining)
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Camera className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No frames extracted yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Frame extraction is still processing or has not been started for this video.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Captions Tab */}
              {activeTab === 'captions' && (
                <div className="space-y-6">
                  {analysisData.captions && analysisData.captions.length > 0 ? (
                    <>
                      <div className="grid gap-6 md:grid-cols-2">
                        {analysisData.captions.slice(0, visibleCaptions).map((caption, index) => (
                          <Card key={caption.id} className="overflow-hidden hover:shadow-lg transition-all duration-200 border-slate-200 dark:border-slate-700">
                            <div className="flex">
                              <div className="w-36 aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                                <img
                                  src={`http://localhost:3001${caption.imageLink}`}
                                  alt={`Caption at ${caption.timestamp}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = placeholderImage
                                  }}
                                />
                              </div>
                              <div className="flex-1 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                    #{index + 1}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {caption.timestamp}
                                  </Badge>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                  "{caption.caption}"
                                </p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                      
                      {analysisData.captions.length > visibleCaptions && (
                        <div className="text-center">
                          <Button 
                            variant="outline" 
                            onClick={() => setVisibleCaptions(prev => prev + 8)}
                            className="bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100 dark:from-green-950 dark:to-blue-950 border-green-200 dark:border-green-800"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Load More ({analysisData.captions.length - visibleCaptions} remaining)
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <MessageSquare className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No captions generated yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Image captioning is still processing or has not been started for this video.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Persons Tab */}
              {activeTab === 'persons' && (
                <div className="space-y-6">
                  {analysisData.persons && analysisData.persons.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {analysisData.persons.slice(0, visiblePersons).map((person, index) => (
                          <div key={person.id} className="group bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 border border-slate-200 dark:border-slate-700">
                            <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                              <img
                                src={`http://localhost:3001${person.imageLink}`}
                                alt={`Person ${person.personUid} at ${person.timestamp}`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.src = placeholderPerson
                                }}
                              />
                            </div>
                            <div className="p-3">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-1">
                                  <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                    #{index + 1}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {person.timestamp}
                                  </Badge>
                                </div>
                                <Badge variant="outline" className="text-xs font-mono bg-slate-50 dark:bg-slate-900 truncate">
                                  ID: {person.personUid.slice(7, 15)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {analysisData.persons.length > visiblePersons && (
                        <div className="text-center">
                          <Button 
                            variant="outline" 
                            onClick={() => setVisiblePersons(prev => prev + 16)}
                            className="bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Load More ({analysisData.persons.length - visiblePersons} remaining)
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Users className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No persons detected yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Person detection is still processing or has not been started for this video.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transcription Details Dialog */}
      {showTranscriptionDetails && transcriptionData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl mx-2 sm:mx-0">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <MessageSquare className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="truncate">Audio Transcription</span>
                  </CardTitle>
                  <CardDescription className="mt-2 flex flex-wrap gap-1 sm:gap-2">
                    <Badge variant="outline" className="bg-white/50 text-xs">
                      <MessageSquare className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                      {transcriptionData.model}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${transcriptionData.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                      {transcriptionData.status}
                    </Badge>
                    <Badge variant="outline" className="bg-white/50 text-xs">
                      {transcriptionData.language || 'Unknown'}
                    </Badge>
                    <Badge variant="outline" className="bg-white/50 text-xs">
                      {transcriptionData.totalSegments || 0} segments
                    </Badge>
                    {/* {transcriptionData.totalDuration && (
                      <Badge variant="outline" className="bg-white/50 text-xs">
                        {Math.round(transcriptionData.totalDuration)}s
                      </Badge>
                    )} */}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportTranscriptionAsJson(transcriptionData)}
                    className="text-xs"
                  >
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Export JSON</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setShowTranscriptionDetails(null)
                      setTranscriptionData(null)
                      setVisibleSegments(20)
                      setEditingSegment(null)
                    }}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="overflow-y-auto max-h-[calc(95vh-12rem)] p-3 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {transcriptionData.segments && transcriptionData.segments.length > 0 ? (
                  <>
                    <div className="space-y-2 sm:space-y-3">
                      {transcriptionData.segments.slice(0, visibleSegments).map((segment, index) => (
                        <Card key={segment.id} className="overflow-hidden hover:shadow-md transition-all duration-200 border-slate-200 dark:border-slate-700">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0">
                                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                                  #{index + 1}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono truncate max-w-[160px] sm:max-w-none">
                                  {segment.startingTimestamp} - {segment.endingTimestamp}
                                </Badge>
                                {segment.isEdited && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">
                                    Edited
                                  </Badge>
                                )}
                                {segment.confidence && (
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(segment.confidence * 100)}%
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSegment(segment)}
                                className="text-xs h-6 w-full sm:w-auto shrink-0"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                            
                            {editingSegment?.id === segment.id ? (
                              <div className="space-y-3">
                                <Textarea
                                  value={editingSegmentText}
                                  onChange={(e) => setEditingSegmentText(e.target.value)}
                                  className="min-h-[80px] text-sm"
                                  placeholder="Edit transcription text..."
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingSegment(null)
                                      setEditingSegmentText('')
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={handleSaveSegmentEdit}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                  <strong>Refined:</strong> {segment.refinedTranscription || segment.transcription}
                                </div>
                                {segment.refinedTranscription && segment.refinedTranscription !== segment.transcription && (
                                  <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 p-2 rounded border">
                                    <strong>Original:</strong> {segment.transcription}
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {transcriptionData.segments.length > visibleSegments && (
                      <div className="text-center">
                        <Button 
                          variant="outline" 
                          onClick={() => setVisibleSegments(prev => prev + 20)}
                          className="bg-gradient-to-r from-blue-50 to-green-50 hover:from-blue-100 hover:to-green-100 dark:from-blue-950 dark:to-green-950 border-blue-200 dark:border-blue-800"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Load More ({transcriptionData.segments.length - visibleSegments} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <MessageSquare className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No transcription segments found</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      The transcription is still processing or encountered an error.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summarization Details Dialog */}
      {showSummarizationDetails && summarizationData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <Card className="w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl mx-2 sm:mx-0">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg sm:text-2xl flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <FileText className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="truncate">Video Summarization</span>
                  </CardTitle>
                  <CardDescription className="mt-2 flex flex-wrap gap-1 sm:gap-2">
                    <Badge variant="outline" className="bg-white/50 text-xs">
                      <FileText className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                      {summarizationData.segments.length} segments
                    </Badge>
                    <Badge variant="outline" className="bg-white/50 text-xs">
                      <MessageSquare className="h-2 w-2 sm:h-3 sm:w-3 mr-1" />
                      {summarizationData.topics.length} topics
                    </Badge>
                    {summarizationData.segments[0]?.model && (
                      <Badge variant="outline" className="bg-white/50 text-xs">
                        {summarizationData.segments[0].model}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-xs ${summarizationData.segments[0]?.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                      {summarizationData.segments[0]?.status || 'pending'}
                    </Badge>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportSummarizationAsJson(showSummarizationDetails!, summarizationData.segments, summarizationData.topics)}
                    className="text-xs"
                  >
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Export JSON</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setShowSummarizationDetails(null)
                      setSummarizationData(null)
                      setVisibleSummarySegments(10)
                      setVisibleTopics(5)
                    }}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="overflow-y-auto max-h-[calc(95vh-12rem)] p-3 sm:p-6">
              <div className="space-y-6">
                {/* Topics Section */}
                {summarizationData.topics.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-purple-600" />
                      Contextual Topics
                    </h3>
                    <div className="space-y-2">
                      {summarizationData.topics.slice(0, visibleTopics).map((topic, index) => (
                        <Card key={topic.id} className="overflow-hidden hover:shadow-md transition-all duration-200 border-purple-200 dark:border-purple-700">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0">
                                <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                                  Topic #{index + 1}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono truncate max-w-[160px] sm:max-w-none">
                                  {topic.startingTimestamp} - {topic.endingTimestamp}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                              {topic.topic}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {summarizationData.topics.length > visibleTopics && (
                      <div className="text-center">
                        <Button 
                          variant="outline" 
                          onClick={() => setVisibleTopics(prev => prev + 5)}
                          className="bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Load More Topics ({summarizationData.topics.length - visibleTopics} remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Segments Section */}
                {summarizationData.segments.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-600" />
                      Video Segments
                    </h3>
                    <div className="space-y-2">
                      {summarizationData.segments.slice(0, visibleSummarySegments).map((segment, index) => (
                        <Card key={segment.id} className="overflow-hidden hover:shadow-md transition-all duration-200 border-purple-200 dark:border-purple-700">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                              <div className="flex flex-wrap items-center gap-1 sm:gap-2 min-w-0">
                                <Badge variant="secondary" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 shrink-0">
                                  Segment #{index + 1}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono truncate max-w-[160px] sm:max-w-none">
                                  {segment.startingTimestamp} - {segment.endingTimestamp}
                                </Badge>
                                {segment.model && (
                                  <Badge variant="outline" className="text-xs">
                                    {segment.model}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                              {segment.description}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    {summarizationData.segments.length > visibleSummarySegments && (
                      <div className="text-center">
                        <Button 
                          variant="outline" 
                          onClick={() => setVisibleSummarySegments(prev => prev + 10)}
                          className="bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Load More Segments ({summarizationData.segments.length - visibleSummarySegments} remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {summarizationData.segments.length === 0 && summarizationData.topics.length === 0 && (
                  <div className="text-center py-12">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No summarization data found</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      The summarization is still processing or has not been started yet.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 