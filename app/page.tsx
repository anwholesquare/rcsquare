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
import { LogOut, Video, Upload, Youtube, Plus, FolderOpen, Camera, MessageSquare, Users, TrendingUp, Clock, CheckCircle, AlertCircle, XCircle, ChevronRight, Activity, RefreshCw, Filter, Play, Pause, Eye, Download, Zap, FileText, Scissors, Hash, Mic, Globe } from 'lucide-react'
import axios from 'axios'
import Image from 'next/image'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'

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

interface Project {
  id: string
  name: string
  videos: Video[]
}

interface DashboardStats {
  totalVideos: number
  storageUsed: number
  youtubeDownloads: number
  directUploads: number
  totalFrames: number
  totalCaptions: number
  totalPersons: number
  analysisCompleted: number
  analysisProcessing: number
  analysisFailed: number
  uniquePersons: number
  totalTranscriptions: number
  totalSegments: number
  totalTranscriptionDuration: number
  transcriptionCompleted: number
  transcriptionProcessing: number
  transcriptionFailed: number
  languagesDetected: number
  // Video Summarization Stats
  totalSummarizations: number
  totalVideoSegments: number
  totalVideoTopics: number
  summarizationCompleted: number
  summarizationProcessing: number
  summarizationFailed: number
  modelsUsed: number
  avgSegmentsPerVideo: number
  avgTopicsPerVideo: number
}

interface StatCardData {
  id: string
  title: string
  value: string | number
  subtitle: string
  icon: any
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'indigo' | 'cyan' | 'pink'
  trend?: string
  description?: string
  progress?: number
  action?: () => void
}

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
  projectName: string
  query: string
  searchType: string
  results: SearchResult[]
  tokenUsage?: number
  cost?: number
  model?: string
  metadata?: any
  createdAt: string
}

export default function Home() {
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [isValidated, setIsValidated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [projectData, setProjectData] = useState<Project | null>(null)
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [searchHistoryLoading, setSearchHistoryLoading] = useState(false)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
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
    uniquePersons: 0,
    totalTranscriptions: 0,
    totalSegments: 0,
    totalTranscriptionDuration: 0,
    transcriptionCompleted: 0,
    transcriptionProcessing: 0,
    transcriptionFailed: 0,
    languagesDetected: 0,
    // Video Summarization Stats
    totalSummarizations: 0,
    totalVideoSegments: 0,
    totalVideoTopics: 0,
    summarizationCompleted: 0,
    summarizationProcessing: 0,
    summarizationFailed: 0,
    modelsUsed: 0,
    avgSegmentsPerVideo: 0,
    avgTopicsPerVideo: 0
  })
  
  // Interactive dashboard state
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [selectedStatCard, setSelectedStatCard] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')
  const [activityFilter, setActivityFilter] = useState<'all' | 'uploads' | 'analysis' | 'transcription' | 'summarization'>('all')

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
      
      // Calculate transcription stats
      const videosWithTranscription = project.videos.filter((video: Video) => video.transcription)
      const totalTranscriptions = videosWithTranscription.length
      const totalSegments = videosWithTranscription.reduce((acc: number, video: Video) => 
        acc + (video.transcription?.totalSegments || 0), 0)
      const totalTranscriptionDuration = videosWithTranscription.reduce((acc: number, video: Video) => 
        acc + (video.transcription?.totalDuration || 0), 0)
      
      // Transcription status counts
      const transcriptionCompleted = project.videos.filter((video: Video) => 
        video.transcription?.status === 'completed').length
      const transcriptionProcessing = project.videos.filter((video: Video) => 
        video.transcription?.status === 'processing').length
      const transcriptionFailed = project.videos.filter((video: Video) => 
        video.transcription?.status === 'failed').length
      
      // Calculate unique languages detected
      const allLanguages = new Set<string>()
      videosWithTranscription.forEach((video: Video) => {
        if (video.transcription?.language) {
          allLanguages.add(video.transcription.language)
        }
      })
      const languagesDetected = allLanguages.size

      // Calculate video summarization stats
      const videosWithSummarization = project.videos.filter((video: Video) => video.segments && video.segments.length > 0)
      const totalSummarizations = videosWithSummarization.length
      const totalVideoSegments = videosWithSummarization.reduce((acc: number, video: Video) => 
        acc + (video.segments?.length || 0), 0)
      const totalVideoTopics = videosWithSummarization.reduce((acc: number, video: Video) => 
        acc + (video.topics?.length || 0), 0)
      
      // Summarization status counts
      const summarizationCompleted = project.videos.filter((video: Video) => 
        video.segments && video.segments.length > 0 && video.segments[0].status === 'completed').length
      const summarizationProcessing = project.videos.filter((video: Video) => 
        video.segments && video.segments.length > 0 && video.segments[0].status === 'processing').length
      const summarizationFailed = project.videos.filter((video: Video) => 
        video.segments && video.segments.length > 0 && video.segments[0].status === 'failed').length
      
      // Calculate unique models used for summarization
      const allModels = new Set<string>()
      videosWithSummarization.forEach((video: Video) => {
        video.segments?.forEach((segment: VideoSegment) => {
          if (segment.model) {
            allModels.add(segment.model)
          }
        })
      })
      const modelsUsed = allModels.size
      
      // Calculate averages
      const avgSegmentsPerVideo = totalSummarizations > 0 ? Math.round(totalVideoSegments / totalSummarizations) : 0
      const avgTopicsPerVideo = totalSummarizations > 0 ? Math.round(totalVideoTopics / totalSummarizations) : 0
      
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
        uniquePersons,
        totalTranscriptions,
        totalSegments,
        totalTranscriptionDuration,
        transcriptionCompleted,
        transcriptionProcessing,
        transcriptionFailed,
        languagesDetected,
        // Video Summarization Stats
        totalSummarizations,
        totalVideoSegments,
        totalVideoTopics,
        summarizationCompleted,
        summarizationProcessing,
        summarizationFailed,
        modelsUsed,
        avgSegmentsPerVideo,
        avgTopicsPerVideo
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
    setSearchHistory([])
    
    // Clear localStorage
    localStorage.removeItem('rcsquare-current-project')
    localStorage.removeItem('rcsquare-validated')
  }

  const fetchSearchHistory = async () => {
    if (!currentProject) return
    
    setSearchHistoryLoading(true)
    try {
      const response = await axios.get(`/api/search-history?project=${currentProject}`)
      setSearchHistory(response.data.searches || [])
    } catch (error) {
      console.error('Failed to fetch search history:', error)
      setSearchHistory([])
    } finally {
      setSearchHistoryLoading(false)
    }
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

  // Interactive dashboard functions
  const handleRefreshData = async () => {
    setLastRefresh(new Date())
    await fetchProjectData()
  }

  const toggleAutoRefresh = () => {
    setIsAutoRefreshing(!isAutoRefreshing)
  }

  const getStatCardData = (): StatCardData[] => {
    return [
      {
        id: 'videos',
        title: 'Total Videos',
        value: dashboardStats.totalVideos,
        subtitle: dashboardStats.totalVideos > 0 ? 'Videos in library' : 'No videos yet',
        icon: Video,
        color: 'blue' as const,
        trend: '+12%',
        description: 'Total number of videos in your library',
        action: () => setActiveTab('library')
      },
      {
        id: 'storage',
        title: 'Storage Used',
        value: formatFileSize(dashboardStats.storageUsed),
        subtitle: dashboardStats.totalVideos > 0 ? 'Total storage' : 'No storage used',
        icon: FolderOpen,
        color: 'green' as const,
        trend: '+8%',
        description: 'Total storage space used by all videos',
        action: () => setActiveTab('library')
      },
      {
        id: 'youtube',
        title: 'YouTube Downloads',
        value: dashboardStats.youtubeDownloads,
        subtitle: dashboardStats.youtubeDownloads > 0 ? 'Downloaded videos' : 'No downloads yet',
        icon: Youtube,
        color: 'red' as const,
        trend: '+25%',
        description: 'Videos downloaded from YouTube',
        action: () => setActiveTab('upload')
      },
      {
        id: 'uploads',
        title: 'Direct Uploads',
        value: dashboardStats.directUploads,
        subtitle: dashboardStats.directUploads > 0 ? 'Uploaded videos' : 'No uploads yet',
        icon: Upload,
        color: 'purple' as const,
        trend: '+15%',
        description: 'Videos uploaded directly from your device',
        action: () => setActiveTab('upload')
      },
      {
        id: 'summarizations',
        title: 'Video Summarizations',
        value: dashboardStats.totalSummarizations,
        subtitle: dashboardStats.totalSummarizations > 0 ? `${dashboardStats.totalVideoSegments} segments, ${dashboardStats.totalVideoTopics} topics` : 'No summarizations yet',
        icon: FileText,
        color: 'indigo' as const,
        trend: '+25%',
        description: 'AI-generated video summaries with segments and topics',
        action: () => setActiveTab('library')
      }
    ]
  }

  const getAnalysisStats = (): StatCardData[] => {
    return [
      {
        id: 'frames',
        title: 'Frames Extracted',
        value: dashboardStats.totalFrames.toLocaleString(),
        subtitle: dashboardStats.totalFrames > 0 ? 'Total video frames' : 'No frames extracted',
        icon: Camera,
        color: 'blue' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'captions',
        title: 'Captions Generated',
        value: dashboardStats.totalCaptions.toLocaleString(),
        subtitle: dashboardStats.totalCaptions > 0 ? 'AI-generated captions' : 'No captions generated',
        icon: MessageSquare,
        color: 'green' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'persons',
        title: 'Persons Detected',
        value: dashboardStats.totalPersons.toLocaleString(),
        subtitle: dashboardStats.uniquePersons > 0 ? `${dashboardStats.uniquePersons} unique individuals` : 'No persons detected',
        icon: Users,
        color: 'purple' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'analysis',
        title: 'Analysis Status',
        value: `${dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100) : 0}%`,
        subtitle: `${dashboardStats.analysisCompleted}/${dashboardStats.totalVideos} videos analyzed`,
        icon: CheckCircle,
        color: 'orange' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100 : 0
      }
    ]
  }

  const getTranscriptionStats = (): StatCardData[] => {
    return [
      {
        id: 'transcriptions',
        title: 'Transcriptions',
        value: dashboardStats.totalTranscriptions,
        subtitle: dashboardStats.totalTranscriptions > 0 ? 'Videos transcribed' : 'No transcriptions yet',
        icon: MessageSquare,
        color: 'purple' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.transcriptionCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'segments',
        title: 'Segments',
        value: dashboardStats.totalSegments.toLocaleString(),
        subtitle: dashboardStats.totalSegments > 0 ? 'Text segments' : 'No segments created',
        icon: MessageSquare,
        color: 'indigo' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.transcriptionCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'duration',
        title: 'Duration',
        value: dashboardStats.totalTranscriptionDuration > 0 ? `${Math.round(dashboardStats.totalTranscriptionDuration / 60)}m` : '0m',
        subtitle: dashboardStats.totalTranscriptionDuration > 0 ? 'Audio transcribed' : 'No audio processed',
        icon: Clock,
        color: 'cyan' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.transcriptionCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'languages',
        title: 'Languages',
        value: dashboardStats.languagesDetected,
        subtitle: dashboardStats.languagesDetected > 0 ? 'Languages detected' : 'No languages detected',
        icon: MessageSquare,
        color: 'pink' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.transcriptionCompleted / dashboardStats.totalVideos) * 100 : 0
      }
    ]
  }

  const getSummarizationStats = (): StatCardData[] => {
    return [
      {
        id: 'video-summarizations',
        title: 'Video Summarizations',
        value: dashboardStats.totalSummarizations,
        subtitle: dashboardStats.totalSummarizations > 0 ? 'Videos summarized' : 'No summarizations yet',
        icon: FileText,
        color: 'purple' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.summarizationCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'video-segments',
        title: 'Video Segments',
        value: dashboardStats.totalVideoSegments.toLocaleString(),
        subtitle: dashboardStats.totalVideoSegments > 0 ? `Avg ${dashboardStats.avgSegmentsPerVideo} per video` : 'No segments yet',
        icon: Scissors,
        color: 'indigo' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.summarizationCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'video-topics',
        title: 'Video Topics',
        value: dashboardStats.totalVideoTopics.toLocaleString(),
        subtitle: dashboardStats.totalVideoTopics > 0 ? `Avg ${dashboardStats.avgTopicsPerVideo} per video` : 'No topics yet',
        icon: Hash,
        color: 'pink' as const,
        progress: dashboardStats.totalVideos > 0 ? (dashboardStats.summarizationCompleted / dashboardStats.totalVideos) * 100 : 0
      },
      {
        id: 'ai-models',
        title: 'AI Models Used',
        value: dashboardStats.modelsUsed,
        subtitle: dashboardStats.modelsUsed > 0 ? 'Different models' : 'No models used',
        icon: Zap,
        color: 'cyan' as const,
        progress: dashboardStats.modelsUsed > 0 ? 100 : 0
      }
    ]
  }

  const StatCard = ({ stat, onClick }: { stat: StatCardData, onClick?: () => void }) => {
    const colorClasses = {
      blue: 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 hover:bg-blue-100/50 dark:hover:bg-blue-950/30',
      green: 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 hover:bg-green-100/50 dark:hover:bg-green-950/30',
      purple: 'border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20 hover:bg-purple-100/50 dark:hover:bg-purple-950/30',
      red: 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30',
      orange: 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20 hover:bg-orange-100/50 dark:hover:bg-orange-950/30',
      indigo: 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/30',
      cyan: 'border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/20 hover:bg-cyan-100/50 dark:hover:bg-cyan-950/30',
      pink: 'border-pink-200 bg-pink-50/50 dark:border-pink-800 dark:bg-pink-950/20 hover:bg-pink-100/50 dark:hover:bg-pink-950/30'
    }

    const iconColorClasses = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      red: 'text-red-600',
      orange: 'text-orange-600',
      indigo: 'text-indigo-600',
      cyan: 'text-cyan-600',
      pink: 'text-pink-600'
    }

    const valueColorClasses = {
      blue: 'text-blue-700 dark:text-blue-400',
      green: 'text-green-700 dark:text-green-400',
      purple: 'text-purple-700 dark:text-purple-400',
      red: 'text-red-700 dark:text-red-400',
      orange: 'text-orange-700 dark:text-orange-400',
      indigo: 'text-indigo-700 dark:text-indigo-400',
      cyan: 'text-cyan-700 dark:text-cyan-400',
      pink: 'text-pink-700 dark:text-pink-400'
    }

    return (
      <Card 
        className={`${colorClasses[stat.color]} transition-all duration-300 ease-in-out transform hover:scale-105 cursor-pointer group`}
        onClick={onClick}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {stat.title}
            {onClick && <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
          </CardTitle>
          <stat.icon className={`h-4 w-4 ${iconColorClasses[stat.color]}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${valueColorClasses[stat.color]} flex items-center gap-2`}>
            {stat.value}
            {/* {stat.trend && (
              <Badge variant="secondary" className="text-xs">
                {stat.trend}
              </Badge>
            )} */}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stat.subtitle}
          </p>
          {/* {stat.progress !== undefined && (
            <div className="mt-2">
              <Progress value={stat.progress} className="h-1" />
            </div>
          )} */}
        </CardContent>
      </Card>
    )
  }

  const getRecentActivity = () => {
    if (!projectData || !projectData.videos.length) return []
    
    const activities: Array<{
      id: string
      title: string
      subtitle: string
      description: string
      time: string
      timestamp: string
      type: 'youtube' | 'upload' | 'analysis_completed' | 'analysis_processing' | 'analysis_failed' | 'transcription_completed' | 'transcription_processing' | 'transcription_failed' | 'summarization_completed' | 'summarization_processing' | 'summarization_failed'
      category: 'uploads' | 'analysis' | 'transcription' | 'summarization'
      status: 'completed' | 'processing' | 'failed' | 'success'
      metadata?: {
        fileSize?: number
        duration?: string
        frames?: number
        segments?: number
        language?: string
        progress?: number
      }
      videoId?: string
    }> = []
    
    // Add video upload/download activities
    projectData.videos.forEach(video => {
      const fileSize = video.fileSize ? formatFileSize(video.fileSize) : 'Unknown size'
      const duration = video.duration ? `${Math.round(video.duration / 60)}m ${Math.round(video.duration % 60)}s` : 'Unknown duration'
      
      activities.push({
        id: `video-${video.id}`,
        title: video.originalUrl ? 'Downloaded from YouTube' : 'Uploaded video file',
        subtitle: video.title,
        description: `${fileSize} • ${duration}`,
        time: getTimeAgo(video.createdAt),
        timestamp: video.createdAt,
        type: video.originalUrl ? 'youtube' : 'upload',
        category: 'uploads',
        status: 'success',
        metadata: {
          fileSize: video.fileSize,
          duration: duration
        },
        videoId: video.id
      })
      
      // Add frame analysis activities
      if (video.frameAnalysis) {
        const analysisDate = video.frameAnalysis.processedAt || video.updatedAt || video.createdAt
        const frames = video.frameAnalysis.totalFrames || 0
        const captions = video.frameAnalysis.captions?.length || 0
        const persons = video.frameAnalysis.persons?.length || 0
        
        activities.push({
          id: `analysis-${video.frameAnalysis.id}`,
          title: `Frame analysis ${video.frameAnalysis.status}`,
          subtitle: video.title,
          description: `${frames} frames • ${captions} captions • ${persons} persons detected`,
          time: getTimeAgo(analysisDate),
          timestamp: analysisDate,
          type: video.frameAnalysis.status === 'completed' ? 'analysis_completed' : 
                video.frameAnalysis.status === 'processing' ? 'analysis_processing' : 'analysis_failed',
          category: 'analysis',
          status: video.frameAnalysis.status === 'completed' ? 'completed' : 
                  video.frameAnalysis.status === 'processing' ? 'processing' : 'failed',
          metadata: {
            frames,
            progress: video.frameAnalysis.status === 'processing' ? 
              Math.round((frames / (video.duration || 300)) * 100) : undefined
          },
          videoId: video.id
        })
      }
      
      // Add transcription activities
      if (video.transcription) {
        const transcriptionDate = video.transcription.processedAt || video.updatedAt || video.createdAt
        const segments = video.transcription.totalSegments || 0
        const duration = video.transcription.totalDuration ? 
          `${Math.round(video.transcription.totalDuration / 60)}m` : 'Unknown duration'
        const language = video.transcription.language || 'Unknown'
        
        activities.push({
          id: `transcription-${video.transcription.id}`,
          title: `Audio transcription ${video.transcription.status}`,
          subtitle: video.title,
          description: `${segments} segments • ${duration} • ${language.toUpperCase()}`,
          time: getTimeAgo(transcriptionDate),
          timestamp: transcriptionDate,
          type: video.transcription.status === 'completed' ? 'transcription_completed' : 
                video.transcription.status === 'processing' ? 'transcription_processing' : 'transcription_failed',
          category: 'transcription',
          status: video.transcription.status === 'completed' ? 'completed' : 
                  video.transcription.status === 'processing' ? 'processing' : 'failed',
          metadata: {
            segments,
            language,
            progress: video.transcription.status === 'processing' ? 
              Math.round((segments / 100) * 100) : undefined
          },
          videoId: video.id
        })
      }

      // Add summarization activities
      if (video.segments && video.segments.length > 0) {
        const summarizationDate = video.segments[0].createdAt || video.updatedAt || video.createdAt
        const videoSegments = video.segments.length
        const videoTopics = video.topics?.length || 0
        const model = video.segments[0].model || 'Unknown model'
        const status = video.segments[0].status || 'pending'
        
        activities.push({
          id: `summarization-${video.id}`,
          title: `Video summarization ${status}`,
          subtitle: video.title,
          description: `${videoSegments} segments • ${videoTopics} topics • ${model}`,
          time: getTimeAgo(summarizationDate),
          timestamp: summarizationDate,
          type: status === 'completed' ? 'summarization_completed' : 
                status === 'processing' ? 'summarization_processing' : 'summarization_failed',
          category: 'summarization',
          status: status === 'completed' ? 'completed' : 
                  status === 'processing' ? 'processing' : 'failed',
          metadata: {
            segments: videoSegments,
            progress: status === 'processing' ? 
              Math.round((videoSegments / 20) * 100) : undefined
          },
          videoId: video.id
        })
      }
    })
    
    // Sort by actual timestamp and return top 12
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12)
  }

  const getFilteredActivities = () => {
    let activities = getRecentActivity()
    
    // Apply search filter
    if (searchQuery) {
      activities = activities.filter(activity => 
        activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply category filter
    if (activityFilter !== 'all') {
      activities = activities.filter(activity => activity.category === activityFilter)
    }
    
    // Apply status filter
    if (filterType !== 'all') {
      activities = activities.filter(activity => activity.status === filterType)
    }
    
    return activities
  }

  const getActivityIcon = (type: string) => {
    const iconProps = "h-4 w-4"
    switch (type) {
      case 'youtube': return <Youtube className={`${iconProps} text-red-500`} />
      case 'upload': return <Upload className={`${iconProps} text-blue-500`} />
      case 'analysis_completed': return <CheckCircle className={`${iconProps} text-green-500`} />
      case 'analysis_processing': return <Clock className={`${iconProps} text-yellow-500 animate-pulse`} />
      case 'analysis_failed': return <XCircle className={`${iconProps} text-red-500`} />
      case 'transcription_completed': return <MessageSquare className={`${iconProps} text-purple-500`} />
      case 'transcription_processing': return <MessageSquare className={`${iconProps} text-yellow-500 animate-pulse`} />
      case 'transcription_failed': return <MessageSquare className={`${iconProps} text-red-500`} />
      case 'summarization_completed': return <FileText className={`${iconProps} text-indigo-500`} />
      case 'summarization_processing': return <FileText className={`${iconProps} text-yellow-500 animate-pulse`} />
      case 'summarization_failed': return <FileText className={`${iconProps} text-red-500`} />
      default: return <Activity className={`${iconProps} text-gray-500`} />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">Completed</Badge>
      case 'processing':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs">Processing</Badge>
      case 'failed':
        return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-xs">Failed</Badge>
      default:
        return null
    }
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant={isAutoRefreshing ? "default" : "outline"}
              size="sm"
              onClick={toggleAutoRefresh}
            >
              {isAutoRefreshing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              <span className="hidden sm:inline">{isAutoRefreshing ? 'Auto' : 'Manual'}</span>
            </Button>
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
          } else if (value === 'searches') {
            fetchSearchHistory() // Fetch search history when switching to searches
          }
        }} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="searches">Searches</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Last Updated Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isAutoRefreshing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {isAutoRefreshing ? 'Auto-refreshing' : 'Manual refresh'}
              </div>
            </div>

            {/* Primary Stats */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {getStatCardData().map((stat) => (
                <StatCard key={stat.id} stat={stat} onClick={stat.action} />
              ))}
            </div>

            {/* AI Analysis Overview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  AI Analysis Overview
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('library')}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </div>
              
              {/* Frame Analysis Stats */}
              <div>
                <h4 className="text-md font-medium mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600" />
                  Frame Analysis
                </h4>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {getAnalysisStats().map((stat) => (
                    <StatCard key={stat.id} stat={stat} />
                  ))}
                </div>
              </div>
              
              {/* Audio Transcription Stats */}
              <div>
                <h4 className="text-md font-medium mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-600" />
                  Audio Transcription
                </h4>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {getTranscriptionStats().map((stat) => (
                    <StatCard key={stat.id} stat={stat} />
                  ))}
                </div>
              </div>

              {/* Video Summarization Stats */}
              <div>
                <h4 className="text-md font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Video Summarization
                </h4>
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {getSummarizationStats().map((stat) => (
                    <StatCard key={stat.id} stat={stat} />
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Content Grid */}
            <div className="grid gap-4 lg:grid-cols-7">
              <Card className="lg:col-span-4 flex flex-col h-[600px]">
                <CardHeader className="flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                  <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest uploads and AI analysis results</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Search activity..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-32 sm:w-40"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActivityFilter(activityFilter === 'all' ? 'uploads' : 
                          activityFilter === 'uploads' ? 'analysis' : 
                          activityFilter === 'analysis' ? 'transcription' : 'all')}
                      >
                        <Filter className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Button
                      variant={activityFilter === 'all' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActivityFilter('all')}
                      className="h-7 text-xs"
                    >
                      All
                    </Button>
                    <Button
                      variant={activityFilter === 'uploads' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActivityFilter('uploads')}
                      className="h-7 text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Uploads
                    </Button>
                    <Button
                      variant={activityFilter === 'analysis' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActivityFilter('analysis')}
                      className="h-7 text-xs"
                    >
                      <Camera className="h-3 w-3 mr-1" />
                      Analysis
                    </Button>
                    <Button
                      variant={activityFilter === 'transcription' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActivityFilter('transcription')}
                      className="h-7 text-xs"
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Transcription
                    </Button>
                    <Button
                      variant={activityFilter === 'summarization' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActivityFilter('summarization')}
                      className="h-7 text-xs"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Summarization
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  {getFilteredActivities().length > 0 ? (
                    <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                      {getFilteredActivities().map((activity) => (
                        <div key={activity.id} className="group relative border rounded-lg p-2.5 hover:shadow-sm transition-all duration-200 bg-card hover:bg-accent/50">
                          <div className="flex items-start gap-2.5">
                            {/* Icon */}
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                                {getActivityIcon(activity.type)}
                              </div>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium truncate pr-2">{activity.title}</h4>
                                {getStatusBadge(activity.status)}
                              </div>
                              
                              <p className="text-sm text-muted-foreground truncate">{activity.subtitle}</p>
                              <p className="text-xs text-muted-foreground">{activity.description}</p>
                              
                              {/* Progress bar for processing items */}
                              {activity.status === 'processing' && activity.metadata?.progress && (
                                <div className="mt-1.5">
                                  <Progress value={activity.metadata.progress} className="h-1" />
                                  <p className="text-xs text-muted-foreground mt-1">{activity.metadata.progress}% complete</p>
                                </div>
                              )}
                              
                              {/* Time and Actions */}
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-muted-foreground" title={new Date(activity.timestamp).toLocaleString()}>
                              {activity.time}
                                </span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setActiveTab('library')}>
                                    View
                                  </Button>
                                  {activity.category === 'uploads' && (
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                      Details
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery || activityFilter !== 'all' ? 'No activities match your filters' : 'No recent activity'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {searchQuery || activityFilter !== 'all' ? 'Try adjusting your search or filters' : 'Upload videos to see activity here'}
                        </p>
                        <div className="flex gap-2 mt-3 justify-center">
                          {(searchQuery || activityFilter !== 'all') && (
                            <Button variant="outline" size="sm" onClick={() => {setSearchQuery(''); setActivityFilter('all')}}>
                              Clear Filters
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('upload')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Content
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 flex flex-col h-[600px]">
                <CardHeader className="flex-shrink-0">
                  <CardTitle>AI Processing Status</CardTitle>
                  <CardDescription>
                    Frame analysis and transcription status across all videos
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {/* Frame Analysis Status */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Camera className="h-4 w-4 text-blue-600" />
                        Frame Analysis
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Completed</span>
                              <p className="text-xs text-muted-foreground">Analysis finished</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.analysisCompleted}</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisCompleted / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Processing</span>
                              <p className="text-xs text-muted-foreground">In progress</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.analysisProcessing}</span>
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisProcessing / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Failed</span>
                              <p className="text-xs text-muted-foreground">Requires attention</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.analysisFailed}</span>
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.analysisFailed / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transcription Status */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                        Audio Transcription
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Completed</span>
                              <p className="text-xs text-muted-foreground">Transcription finished</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.transcriptionCompleted}</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.transcriptionCompleted / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Processing</span>
                              <p className="text-xs text-muted-foreground">In progress</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.transcriptionProcessing}</span>
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.transcriptionProcessing / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Failed</span>
                              <p className="text-xs text-muted-foreground">Requires attention</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.transcriptionFailed}</span>
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.transcriptionFailed / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Video Summarization Status */}
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        Video Summarization
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Completed</span>
                              <p className="text-xs text-muted-foreground">Summarization finished</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.summarizationCompleted}</span>
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.summarizationCompleted / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                              <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Processing</span>
                              <p className="text-xs text-muted-foreground">In progress</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.summarizationProcessing}</span>
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.summarizationProcessing / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                              <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium">Failed</span>
                              <p className="text-xs text-muted-foreground">Requires attention</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold">{dashboardStats.summarizationFailed}</span>
                            <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-xs ml-2">
                              {dashboardStats.totalVideos > 0 ? Math.round((dashboardStats.summarizationFailed / dashboardStats.totalVideos) * 100) : 0}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                                  
                  <div className="flex-shrink-0 pt-4 border-t">
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

          <TabsContent value="searches" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Search History
                    </CardTitle>
                    <CardDescription>
                      View your AI-powered search results and history
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchSearchHistory}
                      disabled={searchHistoryLoading}
                    >
                      {searchHistoryLoading ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => window.open(`/q/${currentProject}`, '_blank')}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Search
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {searchHistoryLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : searchHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No searches yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start searching through your video content using AI-powered tools
                    </p>
                    <Button onClick={() => window.open(`/q/${currentProject}`, '_blank')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Start Searching
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchHistory.map((search) => (
                      <div key={search.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                {search.searchType === 'text' && <MessageSquare className="h-4 w-4" />}
                                {search.searchType === 'person' && <Users className="h-4 w-4" />}
                                {search.searchType === 'frame' && <Camera className="h-4 w-4" />}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium mb-1">{search.searchType === 'text' ? search.query : `${search.searchType} search`}</h4>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {search.searchType}
                                </Badge>
                                <span>•</span>
                                <span>{search.results.length} results</span>
                                {search.tokenUsage && (
                                  <>
                                    <span>•</span>
                                    <span>{search.tokenUsage} tokens</span>
                                  </>
                                )}
                                {search.cost && (
                                  <>
                                    <span>•</span>
                                    <span>${search.cost.toFixed(4)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {getTimeAgo(search.createdAt)}
                          </div>
                        </div>
                        
                        {search.results.length > 0 && (
                          <div className="border-t pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                Search Results Preview
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-6"
                                onClick={() => {
                                  // Create a new search page with the historical results
                                  const searchParams = new URLSearchParams({
                                    type: search.searchType,
                                    query: search.query,
                                    results: JSON.stringify(search.results)
                                  });
                                  window.open(`/q/${search.projectName}/history?${searchParams.toString()}`, '_blank');
                                }}
                              >
                                <Eye className="mr-1 h-3 w-3" />
                                View Full Results
                              </Button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {search.results.slice(0, 6).map((result) => (
                                <div key={result.id} className="flex items-center gap-2 p-2 rounded border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                                                      onClick={() => {
                                        const videoUrl = `http://localhost:3001/api/video/${result.videoId.substring(0, 8)}?project=${search.projectName}`;
                                        if (result.timestamp) {
                                          const timestampStart = result.timestamp.split('-')[0];
                                          const [hours, minutes, seconds] = timestampStart.split('.').map(Number);
                                          const seekTime = hours * 3600 + minutes * 60 + seconds;
                                          window.open(`${videoUrl}#t=${seekTime}`, '_blank');
                                        } else {
                                          window.open(videoUrl, '_blank');
                                        }
                                      }}>
                                  <div className="flex-shrink-0">
                                    <Badge variant="secondary" className="text-xs">
                                      {(result.score * 100).toFixed(0)}%
                                    </Badge>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{result.videoTitle}</p>
                                    {result.timestamp && (
                                      <p className="text-xs text-muted-foreground">{result.timestamp}</p>
                                    )}
                                  </div>
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                </div>
                              ))}
                            </div>
                            {search.results.length > 6 && (
                              <div className="text-center mt-2">
                                <Badge variant="outline" className="text-xs">
                                  +{search.results.length - 6} more results
                                </Badge>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
