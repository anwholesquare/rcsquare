'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import axios from 'axios'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Upload, Youtube, FileVideo, X, CheckCircle, AlertCircle, Download } from 'lucide-react'

const youtubeSchema = z.object({
  url: z.string().url('Please enter a valid URL'),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
})

const uploadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
})

type YoutubeForm = z.infer<typeof youtubeSchema>
type UploadForm = z.infer<typeof uploadSchema>

interface VideoUploadProps {
  projectName: string
  type: 'upload' | 'youtube'
}

export function VideoUpload({ projectName, type }: VideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const youtubeForm = useForm<YoutubeForm>({
    resolver: zodResolver(youtubeSchema),
  })

  const uploadForm = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
    },
    multiple: true,
    onDrop: (acceptedFiles) => {
      setSelectedFiles(acceptedFiles)
      setError(null)
      setSuccess(null)
    },
  })

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
  }

  const onYoutubeSubmit = async (data: YoutubeForm) => {
    setIsUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress(0)
    setUploadStatus('Starting download...')

    try {
      // Simulate progress for YouTube download
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + Math.random() * 10
          if (next >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return next
        })
      }, 500)

      const response = await axios.post('http://localhost:3001/api/download-youtube', {
        projectName,
        url: data.url,
        title: data.title,
        description: data.description,
        tags: data.tags,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)
      setUploadStatus('Processing video...')

      if (response.data.success) {
        setSuccess('Video downloaded successfully')
        youtubeForm.reset()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to download video')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setUploadStatus(null)
    }
  }

  const onFileUpload = async (data: UploadForm) => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one file')
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress(0)

    try {
      const totalFiles = selectedFiles.length
      let completedFiles = 0

      const uploadPromises = selectedFiles.map(async (file, index) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectName', projectName)
        formData.append('title', data.title || file.name)
        formData.append('description', data.description || '')
        formData.append('tags', data.tags || '')

        setUploadStatus(`Uploading ${file.name}...`)

        const response = await axios.post('http://localhost:3001/api/upload-video', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const fileProgress = (progressEvent.loaded / progressEvent.total) * 100
              const totalProgress = ((completedFiles * 100) + fileProgress) / totalFiles
              setUploadProgress(totalProgress)
            }
          }
        })

        completedFiles++
        return response
      })

      await Promise.all(uploadPromises)
      setUploadProgress(100)
      setSuccess(`Successfully uploaded ${selectedFiles.length} video${selectedFiles.length === 1 ? '' : 's'}`)
      setSelectedFiles([])
      uploadForm.reset()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload videos')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setUploadStatus(null)
    }
  }

  if (type === 'youtube') {
    return (
      <div className="space-y-3">
        <form onSubmit={youtubeForm.handleSubmit(onYoutubeSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="youtube-url" className="text-sm">YouTube URL</Label>
            <Input
              id="youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              {...youtubeForm.register('url')}
              disabled={isUploading}
            />
            {youtubeForm.formState.errors.url && (
              <p className="text-xs text-destructive">
                {youtubeForm.formState.errors.url.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="youtube-title" className="text-sm">Title</Label>
              <Input
                id="youtube-title"
                placeholder="Custom title"
                {...youtubeForm.register('title')}
                disabled={isUploading}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="youtube-tags" className="text-sm">Tags</Label>
              <Input
                id="youtube-tags"
                placeholder="tag1, tag2, tag3"
                {...youtubeForm.register('tags')}
                disabled={isUploading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="youtube-description" className="text-sm">Description</Label>
            <Textarea
              id="youtube-description"
              placeholder="Custom description"
              className="min-h-[60px]"
              {...youtubeForm.register('description')}
              disabled={isUploading}
            />
          </div>

          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Video
              </>
            )}
          </Button>
        </form>

        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{uploadStatus}</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* File Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm font-medium mb-1">
          {isDragActive ? 'Drop files here' : 'Drag & drop videos here, or click to select'}
        </p>
        <p className="text-xs text-muted-foreground">
          MP4, AVI, MOV, MKV, WebM up to 50MB
        </p>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Selected Files ({selectedFiles.length})</Label>
          <div className="space-y-1">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 border rounded-md text-sm"
              >
                <div className="flex items-center space-x-2">
                  <FileVideo className="h-4 w-4" />
                  <div>
                    <p className="font-medium truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Form */}
      <form onSubmit={uploadForm.handleSubmit(onFileUpload)} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="upload-title" className="text-sm">Title</Label>
            <Input
              id="upload-title"
              placeholder="Video title"
              {...uploadForm.register('title')}
              disabled={isUploading}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="upload-tags" className="text-sm">Tags</Label>
            <Input
              id="upload-tags"
              placeholder="tag1, tag2, tag3"
              {...uploadForm.register('tags')}
              disabled={isUploading}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="upload-description" className="text-sm">Description</Label>
          <Textarea
            id="upload-description"
            placeholder="Video description"
            className="min-h-[60px]"
            {...uploadForm.register('description')}
            disabled={isUploading}
          />
        </div>

        <Button
          type="submit"
          disabled={isUploading || selectedFiles.length === 0}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {selectedFiles.length} Video{selectedFiles.length === 1 ? '' : 's'}
            </>
          )}
        </Button>
      </form>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{uploadStatus}</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
    </div>
  )
} 