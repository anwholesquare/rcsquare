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
  const [activeTab, setActiveTab] = useState<'frames' | 'captions' | 'persons'>('frames')

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

  const fetchVideos = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.get(`/api/projects?name=${projectName}`, {
        headers: {
          'x-security-key': '123_RAGISACTIVATED_321',
        },
      })

      setProject(response.data.project)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load videos')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (projectName) {
      fetchVideos()
    }
  }, [projectName])

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
        <Button onClick={fetchVideos} variant="outline" size="sm">
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
        <Button onClick={fetchVideos} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                        <Button
                          size="sm"
                          onClick={() => handleExtractFrames(video.id)}
                          disabled={extractingFrames.has(video.id)}
                          className="text-xs h-6"
                        >
                          {extractingFrames.has(video.id) ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Camera className="h-3 w-3 mr-1" />
                              Extract Frames
                            </>
                          )}
                        </Button>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
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
    </div>
  )
} 