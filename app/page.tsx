'use client'

import { useState, useEffect } from 'react'
import { ProjectValidation } from '@/components/project-validation'
import { VideoUpload } from '@/components/video-upload'
import { VideoList } from '@/components/video-list'
import { ModeToggle } from '@/components/mode-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogOut, Video, Upload, Youtube, Plus, FolderOpen, Camera, MessageSquare, Users, TrendingUp, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import axios from 'axios'
import Image from 'next/image'

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

interface Project {
  id: string
  name: string
  videos: Video[]
}

export default function Home() {
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [isValidated, setIsValidated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [projectData, setProjectData] = useState<Project | null>(null)
  const [dashboardStats, setDashboardStats] = useState({
    totalVideos: 0,
    storageUsed: 0,
    youtubeDownloads: 0,
    directUploads: 0,
    totalFrames: 0,
    totalCaptions: 0,
    totalPersons: 0,
    analysisCompleted: 0,
    analysisProcessing: 0,
    analysisFailed: 0,
    uniquePersons: 0
  })

  // Load project from localStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem('rcsquare-current-project')
    const savedValidation = localStorage.getItem('rcsquare-validated')
    
    if (savedProject && savedValidation === 'true') {
      setCurrentProject(savedProject)
      setIsValidated(true)
    }
    setIsLoading(false)
  }, [])

  // Fetch project data when project is validated
  useEffect(() => {
    if (currentProject && isValidated) {
      fetchProjectData()
    }
  }, [currentProject, isValidated])

  const fetchProjectData = async () => {
    try {
      const response = await axios.get(`/api/projects?name=${currentProject}`, {
        headers: {
          'x-security-key': '123_RAGISACTIVATED_321',
        },
      })
      
      const project = response.data.project
      setProjectData(project)
      
      // Calculate basic stats
      const totalVideos = project.videos.length
      const storageUsed = project.videos.reduce((acc: number, video: Video) => acc + (video.fileSize || 0), 0)
      const youtubeDownloads = project.videos.filter((video: Video) => video.originalUrl).length
      const directUploads = project.videos.filter((video: Video) => !video.originalUrl).length
      
      // Calculate frame analysis stats
      const videosWithAnalysis = project.videos.filter((video: Video) => video.frameAnalysis)
      const totalFrames = videosWithAnalysis.reduce((acc: number, video: Video) => 
        acc + (video.frameAnalysis?.frames?.length || 0), 0)
      const totalCaptions = videosWithAnalysis.reduce((acc: number, video: Video) => 
        acc + (video.frameAnalysis?.captions?.length || 0), 0)
      const totalPersons = videosWithAnalysis.reduce((acc: number, video: Video) => 
        acc + (video.frameAnalysis?.persons?.length || 0), 0)
      
      // Analysis status counts
      const analysisCompleted = project.videos.filter((video: Video) => 
        video.frameAnalysis?.status === 'completed').length
      const analysisProcessing = project.videos.filter((video: Video) => 
        video.frameAnalysis?.status === 'processing').length
      const analysisFailed = project.videos.filter((video: Video) => 
        video.frameAnalysis?.status === 'failed').length
      
      // Calculate unique persons across all videos
      const allPersonUids = new Set<string>()
      videosWithAnalysis.forEach((video: Video) => {
        video.frameAnalysis?.persons?.forEach((person: Person) => {
          allPersonUids.add(person.personUid)
        })
      })
      const uniquePersons = allPersonUids.size
      
      setDashboardStats({
        totalVideos,
        storageUsed,
        youtubeDownloads,
        directUploads,
        totalFrames,
        totalCaptions,
        totalPersons,
        analysisCompleted,
        analysisProcessing,
        analysisFailed,
        uniquePersons
      })
    } catch (error) {
      console.error('Failed to fetch project data:', error)
    }
  }

  const handleProjectValidation = (projectName: string) => {
    setCurrentProject(projectName)
    setIsValidated(true)
    
    // Save to localStorage
    localStorage.setItem('rcsquare-current-project', projectName)
    localStorage.setItem('rcsquare-validated', 'true')
  }

  const handleLogout = () => {
    setCurrentProject(null)
    setIsValidated(false)
    setProjectData(null)
    
    // Clear localStorage
    localStorage.removeItem('rcsquare-current-project')
    localStorage.removeItem('rcsquare-validated')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 GB'
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
  }

  const handleUploadButtonClick = () => {
    setActiveTab('upload')
  }

  const getRecentActivity = () => {
    if (!projectData || !projectData.videos.length) return []
    
    const activities: Array<{
      title: string
      subtitle: string
      time: string
      timestamp: string // Add actual timestamp for sorting
      type: 'youtube' | 'upload' | 'analysis_completed' | 'analysis_processing' | 'analysis_failed'
    }> = []
    
    // Add video upload/download activities
    projectData.videos.forEach(video => {
      activities.push({
        title: video.originalUrl ? 'Downloaded from YouTube' : 'Uploaded video',
        subtitle: video.title,
        time: getTimeAgo(video.createdAt),
        timestamp: video.createdAt,
        type: video.originalUrl ? 'youtube' : 'upload'
      })
      
      // Add frame analysis activities
      if (video.frameAnalysis) {
        const analysisDate = video.frameAnalysis.processedAt || video.updatedAt || video.createdAt
        activities.push({
          title: `Frame analysis ${video.frameAnalysis.status}`,
          subtitle: `${video.title} - ${video.frameAnalysis.totalFrames || 0} frames`,
          time: getTimeAgo(analysisDate),
          timestamp: analysisDate,
          type: video.frameAnalysis.status === 'completed' ? 'analysis_completed' : 
                video.frameAnalysis.status === 'processing' ? 'analysis_processing' : 'analysis_failed'
        })
      }
    })
    
    // Sort by actual timestamp and return top 8
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8)
  }

  const getTimeAgo = (dateString: string) => {
    try {
      const now = new Date()
      const date = new Date(dateString)
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Unknown time'
      }
      
      const diffInMs = now.getTime() - date.getTime()
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
      
      if (diffInMinutes < 1) return 'Just now'
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`
      if (diffInHours < 24) return `${diffInHours}h ago`
      if (diffInDays < 7) return `${diffInDays}d ago`
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`
      return date.toLocaleDateString()
    } catch (error) {
      console.error('Error calculating time ago:', error, dateString)
      return 'Unknown time'
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isValidated) {
    return <ProjectValidation onValidation={handleProjectValidation} />
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
            <h1 className="text-lg font-semibold">RCSquare</h1>
          </div>
          <div className="ml-auto flex items-center space-x-2 md:space-x-4">
            <Badge variant="outline" className="hidden sm:flex">
              <FolderOpen className="mr-2 h-3 w-3" />
              {currentProject}
            </Badge>
            <ModeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-4 md:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h2>
          <div className="flex items-center space-x-2">
            <Button onClick={handleUploadButtonClick} size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              <span className="sm:hidden">Upload</span>
              <span className="hidden sm:inline">Upload Content</span>
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value)
          if (value === 'overview') {
            fetchProjectData() // Refresh data when switching to overview
          }
        }} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Primary Stats */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
                  <Video className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.totalVideos}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalVideos > 0 ? 'Videos in library' : 'No videos yet'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatFileSize(dashboardStats.storageUsed)}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.totalVideos > 0 ? 'Total storage' : 'No storage used'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">YouTube Downloads</CardTitle>
                  <Youtube className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.youtubeDownloads}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.youtubeDownloads > 0 ? 'Downloaded videos' : 'No downloads yet'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Direct Uploads</CardTitle>
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.directUploads}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.directUploads > 0 ? 'Uploaded videos' : 'No uploads yet'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* AI Analysis Stats */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                AI Analysis Overview
              </h3>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Frames Extracted</CardTitle>
                    <Camera className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{dashboardStats.totalFrames.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.totalFrames > 0 ? 'Total video frames' : 'No frames extracted'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Captions Generated</CardTitle>
                    <MessageSquare className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400">{dashboardStats.totalCaptions.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.totalCaptions > 0 ? 'AI-generated captions' : 'No captions generated'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Persons Detected</CardTitle>
                    <Users className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{dashboardStats.totalPersons.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.uniquePersons > 0 ? `${dashboardStats.uniquePersons} unique individuals` : 'No persons detected'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Analysis Status</CardTitle>
                    <CheckCircle className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                      {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100) : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dashboardStats.analysisCompleted}/{dashboardStats.totalVideos} videos analyzed
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest uploads and AI analysis results</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  {getRecentActivity().length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {getRecentActivity().map((activity, index) => (
                        <div key={index} className="flex items-center">
                          <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full">
                            {activity.type === 'youtube' && <Youtube className="h-4 w-4 text-green-600" />}
                            {activity.type === 'upload' && <Upload className="h-4 w-4 text-blue-600" />}
                            {activity.type === 'analysis_completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                            {activity.type === 'analysis_processing' && <Clock className="h-4 w-4 text-yellow-600" />}
                            {activity.type === 'analysis_failed' && <XCircle className="h-4 w-4 text-red-600" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {activity.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {activity.subtitle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Analysis Status Breakdown</CardTitle>
                  <CardDescription>
                    AI processing status across all videos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">Completed</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold">{dashboardStats.analysisCompleted}</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100) : 0}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">Processing</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold">{dashboardStats.analysisProcessing}</span>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                          {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisProcessing / dashboardStats.totalVideos) * 100) : 0}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium">Failed</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold">{dashboardStats.analysisFailed}</span>
                        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                          {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisFailed / dashboardStats.totalVideos) * 100) : 0}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium">Not Started</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold">{dashboardStats.totalVideos - dashboardStats.analysisCompleted - dashboardStats.analysisProcessing - dashboardStats.analysisFailed}</span>
                        <Badge variant="outline">
                          {dashboardStats.totalVideos > 0 ? Math.round(((dashboardStats.totalVideos - dashboardStats.analysisCompleted - dashboardStats.analysisProcessing - dashboardStats.analysisFailed) / dashboardStats.totalVideos) * 100) : 0}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="grid gap-2">
                      <Button className="w-full justify-start" onClick={() => setActiveTab('library')} size="sm">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        View All Analysis
                      </Button>
                      <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('upload')} size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add More Content
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Videos
                  </CardTitle>
                  <CardDescription>
                    Upload video files from your device
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VideoUpload projectName={currentProject!} type="upload" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Youtube className="h-5 w-5" />
                    YouTube Download
                  </CardTitle>
                  <CardDescription>
                    Download videos from YouTube
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <VideoUpload projectName={currentProject!} type="youtube" />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="library" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Video Library</CardTitle>
                <CardDescription>
                  Manage and organize your uploaded videos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VideoList projectName={currentProject!} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
