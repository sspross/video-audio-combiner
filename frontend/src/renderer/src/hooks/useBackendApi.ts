import { useState, useEffect, useCallback } from 'react'
import axios, { AxiosInstance } from 'axios'
import type {
  TracksResponse,
  ExtractResponse,
  WaveformResponse,
  AlignResponse,
  MergeResponse,
  PreviewResponse,
  FrameResponse
} from '../types'

let apiClient: AxiosInstance | null = null

export function useBackendApi() {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initBackend = async () => {
      try {
        const port = await window.electron.getBackendPort()
        if (port) {
          apiClient = axios.create({
            baseURL: `http://127.0.0.1:${port}/api`,
            timeout: 300000 // 5 minutes for long operations
          })

          // Wait for backend to be ready
          let attempts = 0
          while (attempts < 30) {
            try {
              const response = await apiClient.get('/health')
              if (response.data.status === 'healthy') {
                setIsReady(true)
                return
              }
            } catch {
              // Backend not ready yet
            }
            await new Promise((resolve) => setTimeout(resolve, 1000))
            attempts++
          }
          setError('Backend startup timeout')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend')
      }
    }

    initBackend()
  }, [])

  const getAudioTracks = useCallback(async (filePath: string): Promise<TracksResponse> => {
    if (!apiClient) throw new Error('Backend not ready')
    const response = await apiClient.post('/analyze/tracks', null, {
      params: { file_path: filePath }
    })
    return response.data
  }, [])

  const extractAudio = useCallback(
    async (
      filePath: string,
      trackIndex: number,
      targetFramerate?: number
    ): Promise<ExtractResponse> => {
      if (!apiClient) throw new Error('Backend not ready')
      const response = await apiClient.post('/analyze/extract', {
        file_path: filePath,
        track_index: trackIndex,
        target_framerate: targetFramerate
      })
      return response.data
    },
    []
  )

  const generateWaveform = useCallback(
    async (wavPath: string, samplesPerSecond: number = 100): Promise<WaveformResponse> => {
      if (!apiClient) throw new Error('Backend not ready')
      const response = await apiClient.post('/analyze/waveform', {
        wav_path: wavPath,
        samples_per_second: samplesPerSecond
      })
      return response.data
    },
    []
  )

  const detectAlignment = useCallback(
    async (mainWavPath: string, secondaryWavPath: string): Promise<AlignResponse> => {
      if (!apiClient) throw new Error('Backend not ready')
      const response = await apiClient.post('/align/detect', {
        main_wav_path: mainWavPath,
        secondary_wav_path: secondaryWavPath
      })
      return response.data
    },
    []
  )

  const mergeAudio = useCallback(
    async (
      videoPath: string,
      audioPath: string,
      offsetMs: number,
      outputPath: string,
      language: string = 'und',
      title?: string,
      modifyOriginal: boolean = false
    ): Promise<MergeResponse> => {
      if (!apiClient) throw new Error('Backend not ready')
      const response = await apiClient.post('/merge', {
        video_path: videoPath,
        audio_path: audioPath,
        offset_ms: offsetMs,
        output_path: outputPath,
        language,
        title,
        modify_original: modifyOriginal
      })
      return response.data
    },
    []
  )

  const generatePreview = useCallback(
    async (
      videoPath: string,
      audioPath: string,
      startTimeSeconds: number,
      durationSeconds: number,
      offsetMs: number,
      muteMainAudio: boolean = true,
      muteSecondaryAudio: boolean = false,
      secondaryVideoPath?: string,
      signal?: AbortSignal
    ): Promise<PreviewResponse> => {
      if (!apiClient) throw new Error('Backend not ready')
      const response = await apiClient.post(
        '/preview',
        {
          video_path: videoPath,
          audio_path: audioPath,
          start_time_seconds: startTimeSeconds,
          duration_seconds: durationSeconds,
          offset_ms: offsetMs,
          mute_main_audio: muteMainAudio,
          mute_secondary_audio: muteSecondaryAudio,
          secondary_video_path: secondaryVideoPath
        },
        { signal }
      )
      return response.data
    },
    []
  )

  const extractFrame = useCallback(
    async (
      videoPath: string,
      timeSeconds: number,
      secondaryVideoPath?: string,
      offsetMs?: number
    ): Promise<FrameResponse> => {
      if (!apiClient) throw new Error('Backend not ready')
      const response = await apiClient.post('/extract/frame', {
        video_path: videoPath,
        time_seconds: timeSeconds,
        secondary_video_path: secondaryVideoPath,
        offset_ms: offsetMs
      })
      return response.data
    },
    []
  )

  return {
    isReady,
    error,
    getAudioTracks,
    extractAudio,
    generateWaveform,
    detectAlignment,
    mergeAudio,
    generatePreview,
    extractFrame
  }
}
