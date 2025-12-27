export interface AudioTrack {
  index: number
  codec: string
  language: string | null
  title: string | null
  channels: number
  sample_rate: number
  duration_seconds: number
}

export interface TracksResponse {
  file_path: string
  duration_seconds: number
  tracks: AudioTrack[]
}

export interface ExtractResponse {
  wav_path: string
  duration_seconds: number
}

export interface WaveformResponse {
  peaks: number[]
  duration_seconds: number
  sample_rate: number
}

export interface AlignResponse {
  offset_ms: number
  confidence: number
}

export interface MergeResponse {
  output_path: string
  success: boolean
}

export interface PreviewResponse {
  preview_path: string
  duration_seconds: number
}

export interface FrameResponse {
  frame_path: string
  time_seconds: number
}

export type WorkflowStep =
  | 'select-files'
  | 'select-tracks'
  | 'analyzing'
  | 'align'
  | 'preview'
  | 'export'

export type AnalysisStep = 'idle' | 'pending' | 'extracting' | 'waveform'

export type AlignmentDetectionStep = 'idle' | 'detecting' | 'done' | 'error'

export type SetupWizardStep = 'files-tracks' | 'analyzing'

export interface ProjectState {
  mainFilePath: string | null
  secondaryFilePath: string | null
  mainTracks: AudioTrack[]
  secondaryTracks: AudioTrack[]
  selectedMainTrackIndex: number
  selectedSecondaryTrackIndex: number
  mainWavPath: string | null
  secondaryWavPath: string | null
  mainPeaks: number[]
  secondaryPeaks: number[]
  mainAnalysisStep: AnalysisStep
  secondaryAnalysisStep: AnalysisStep
  alignmentDetectionStep: AlignmentDetectionStep
  offsetMs: number
  confidence: number
  currentStep: WorkflowStep
  isLoading: boolean
  error: string | null
  // Alignment editor state
  cursorPositionMs: number
  isMainAudioMuted: boolean
  isSecondaryAudioMuted: boolean
  previewStartTimeMs: number
  previewDurationSeconds: number
  // Setup wizard state
  showSetupWizard: boolean
  setupWizardStep: SetupWizardStep
}
