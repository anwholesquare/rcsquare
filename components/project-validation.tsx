'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, FolderOpen, Key, ArrowRight, AlertCircle, CheckCircle, Search, Video, Clock, Sparkles } from 'lucide-react'
import Image from 'next/image'

const validationSchema = z.object({
  projectName: z.string().min(3, 'Project name must be at least 3 characters'),
  securityKey: z.string().min(1, 'Security key is required'),
})

type ValidationForm = z.infer<typeof validationSchema>

interface ProjectValidationProps {
  onValidation: (projectName: string) => void
}

export function ProjectValidation({ onValidation }: ProjectValidationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'success'>('form')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ValidationForm>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
  })

  const watchedValues = watch()
  const isFormValid = watchedValues.projectName?.length >= 3 && watchedValues.securityKey?.length > 0

  const onSubmit = async (data: ValidationForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/projects', {
        projectName: data.projectName,
        securityKey: data.securityKey,
      })

      if (response.data.success) {
        setStep('success')
        setTimeout(() => {
          onValidation(data.projectName)
        }, 1500)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
        <Card className="w-full max-w-md mx-auto border-green-200 bg-white/80 dark:bg-green-950/80 dark:border-green-800 backdrop-blur-sm shadow-2xl animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-700 delay-200">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">Access Granted!</h3>
                <p className="text-green-700 dark:text-green-300">Redirecting to your dashboard...</p>
              </div>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-200 border-t-green-600"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Left Side - Marketing Content */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex-col justify-center p-12 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-primary/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-primary/10 rounded-full blur-2xl animate-pulse delay-500"></div>
        </div>
        
        <div className="relative z-10 max-w-xl animate-in slide-in-from-left-10 fade-in-0 duration-1000">
          {/* Logo */}
          <div className="mb-10 group">
            <Image
              src="/logo.png"
              alt="RCSquare Logo"
              width={88}
              height={88}
              className="rounded-2xl shadow-2xl transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          {/* Main Heading */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-foreground mb-4 leading-tight">
              Unlock the Power of 
              <span className="text-primary block bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Intelligent Video Search
              </span>
            </h1>
            <p className="text-l text-muted-foreground leading-relaxed">
              Transform how you discover, manage, and interact with your video content.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 group cursor-default">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-base text-foreground">
                  Add intelligent insights for search to your videos
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Transform your video library with AI-powered search capabilities that understand content, not just metadata.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group cursor-default">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-base text-foreground">
                  Better search inside your video clip
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Find exactly what you're looking for within your videos using natural language queries and smart indexing.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group cursor-default">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-base text-foreground">
                  Search the perfect moments of the video
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Jump directly to the exact timestamp you need. No more scrubbing through hours of content.
                </p>
              </div>
            </div>
          </div>

          
        </div>
      </div>

      {/* Right Side - Access Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
        <div className="w-full max-w-md animate-in slide-in-from-right-10 fade-in-0 duration-1000 delay-300">
          <Card className="shadow-2xl border-0 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-6 pb-8 pt-8">
              {/* Mobile Logo */}
              <div className="lg:hidden mx-auto">
                <Image
                  src="/logo.png"
                  alt="RCSquare Logo"
                  width={64}
                  height={64}
                  className="rounded-xl shadow-lg"
                />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">Project Access</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Enter your credentials to access your video library
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-8 pb-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Project Name Field */}
                <div className="space-y-3">
                  <Label htmlFor="projectName" className="text-sm font-semibold flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    Project Name
                  </Label>
                  <div className="relative group">
                    <Input
                      id="projectName"
                      placeholder="Enter your project name"
                      className={`pl-12 h-12 text-base transition-all duration-300 ${
                        errors.projectName 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/50' 
                          : watchedValues.projectName?.length >= 3
                          ? 'border-green-300 focus:border-green-500 focus:ring-green-200 bg-green-50/50'
                          : 'focus:border-primary focus:ring-primary/20 hover:border-primary/50'
                      }`}
                      {...register('projectName')}
                      disabled={isLoading}
                    />
                    <FolderOpen className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    {watchedValues.projectName?.length >= 3 && !errors.projectName && (
                      <CheckCircle className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500 animate-in zoom-in-50 duration-200" />
                    )}
                  </div>
                  {errors.projectName && (
                    <div className="flex items-center gap-2 text-sm text-red-600 animate-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="h-4 w-4" />
                      {errors.projectName.message}
                    </div>
                  )}
                </div>

                {/* Security Key Field */}
                <div className="space-y-3">
                  <Label htmlFor="securityKey" className="text-sm font-semibold flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Security Key
                  </Label>
                  <div className="relative group">
                    <Input
                      id="securityKey"
                      type="password"
                      placeholder="Enter your security key"
                      className={`pl-12 h-12 text-base transition-all duration-300 ${
                        errors.securityKey 
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50/50' 
                          : watchedValues.securityKey?.length > 0
                          ? 'border-green-300 focus:border-green-500 focus:ring-green-200 bg-green-50/50'
                          : 'focus:border-primary focus:ring-primary/20 hover:border-primary/50'
                      }`}
                      {...register('securityKey')}
                      disabled={isLoading}
                    />
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    {watchedValues.securityKey?.length > 0 && !errors.securityKey && (
                      <CheckCircle className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500 animate-in zoom-in-50 duration-200" />
                    )}
                  </div>
                  {errors.securityKey && (
                    <div className="flex items-center gap-2 text-sm text-red-600 animate-in slide-in-from-top-2 duration-200">
                      <AlertCircle className="h-4 w-4" />
                      {errors.securityKey.message}
                    </div>
                  )}
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold transition-all duration-300 hover:shadow-xl hover:scale-[1.02] disabled:hover:scale-100" 
                  disabled={isLoading || !isFormValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Access Project
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>

              {/* Help Text */}
              <div className="text-center pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Need help? Contact your project administrator for access credentials.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 