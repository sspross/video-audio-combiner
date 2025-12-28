import { create } from 'zustand'
import type {
  AlignmentDetectionStep,
  AnalysisStep,
  AudioTrack,
  ExportMode,
  ProjectState,
  SetupWizardStep,
  WorkflowStep
} from '../types'

interface ProjectActions {
  setMainFile: (path: string, tracks: AudioTrack[]) => void
  setSecondaryFile: (path: string, tracks: AudioTrack[]) => void
  setSelectedMainTrack: (index: number) => void
  setSelectedSecondaryTrack: (index: number) => void
  setMainWavPath: (path: string | null) => void
  setSecondaryWavPath: (path: string | null) => void
  setMainPeaks: (peaks: number[]) => void
  setSecondaryPeaks: (peaks: number[]) => void
  setMainAnalysisStep: (step: AnalysisStep) => void
  setSecondaryAnalysisStep: (step: AnalysisStep) => void
  setAlignmentDetectionStep: (step: AlignmentDetectionStep) => void
  setOffset: (offsetMs: number) => void
  setConfidence: (confidence: number) => void
  setCurrentStep: (step: WorkflowStep) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
  // Alignment editor actions
  setCursorPosition: (ms: number) => void
  setMainAudioMuted: (muted: boolean) => void
  setSecondaryAudioMuted: (muted: boolean) => void
  toggleMainAudioMute: () => void
  toggleSecondaryAudioMute: () => void
  setPreviewStartTime: (ms: number) => void
  setPreviewDuration: (seconds: number) => void
  // Setup wizard actions
  setShowSetupWizard: (show: boolean) => void
  setSetupWizardStep: (step: SetupWizardStep) => void
  // Analysis version control
  incrementAnalysisVersion: () => void
  // Export modal actions
  setShowExportModal: (show: boolean) => void
  setExportMode: (mode: ExportMode) => void
  setExportLanguage: (language: string) => void
  setExportTitle: (title: string) => void
  resetExportModal: () => void
}

const initialState: ProjectState = {
  mainFilePath: null,
  secondaryFilePath: null,
  mainTracks: [],
  secondaryTracks: [],
  selectedMainTrackIndex: 0,
  selectedSecondaryTrackIndex: 0,
  mainWavPath: null,
  secondaryWavPath: null,
  mainPeaks: [],
  secondaryPeaks: [],
  mainAnalysisStep: 'idle',
  secondaryAnalysisStep: 'idle',
  alignmentDetectionStep: 'idle',
  offsetMs: 0,
  confidence: 0,
  currentStep: 'select-files',
  isLoading: false,
  error: null,
  // Alignment editor state
  cursorPositionMs: 0,
  isMainAudioMuted: true,
  isSecondaryAudioMuted: false,
  previewStartTimeMs: 0,
  previewDurationSeconds: 15,
  // Setup wizard state
  showSetupWizard: true,
  setupWizardStep: 'files-tracks',
  // Analysis version counter
  analysisVersion: 0,
  // Export modal state
  showExportModal: false,
  exportMode: 'create-new',
  exportLanguage: '',
  exportTitle: ''
}

export const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  ...initialState,

  setMainFile: (path, tracks) =>
    set({
      mainFilePath: path || null,
      mainTracks: tracks,
      selectedMainTrackIndex: 0,
      mainWavPath: null,
      mainPeaks: [],
      mainAnalysisStep: 'idle',
      alignmentDetectionStep: 'idle',
      offsetMs: 0,
      confidence: 0
    }),

  setSecondaryFile: (path, tracks) =>
    set({
      secondaryFilePath: path || null,
      secondaryTracks: tracks,
      selectedSecondaryTrackIndex: 0,
      secondaryWavPath: null,
      secondaryPeaks: [],
      secondaryAnalysisStep: 'idle',
      alignmentDetectionStep: 'idle',
      offsetMs: 0,
      confidence: 0
    }),

  setSelectedMainTrack: (index) => set({ selectedMainTrackIndex: index }),
  setSelectedSecondaryTrack: (index) => set({ selectedSecondaryTrackIndex: index }),
  setMainWavPath: (path) => set({ mainWavPath: path }),
  setSecondaryWavPath: (path) => set({ secondaryWavPath: path }),
  setMainPeaks: (peaks) => set({ mainPeaks: peaks }),
  setSecondaryPeaks: (peaks) => set({ secondaryPeaks: peaks }),
  setMainAnalysisStep: (step) => set({ mainAnalysisStep: step }),
  setSecondaryAnalysisStep: (step) => set({ secondaryAnalysisStep: step }),
  setAlignmentDetectionStep: (step) => set({ alignmentDetectionStep: step }),
  setOffset: (offsetMs) => set({ offsetMs }),
  setConfidence: (confidence) => set({ confidence }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
  // Alignment editor actions
  setCursorPosition: (ms) => set({ cursorPositionMs: ms }),
  setMainAudioMuted: (muted) => set({ isMainAudioMuted: muted }),
  setSecondaryAudioMuted: (muted) => set({ isSecondaryAudioMuted: muted }),
  toggleMainAudioMute: () => set((state) => ({ isMainAudioMuted: !state.isMainAudioMuted })),
  toggleSecondaryAudioMute: () =>
    set((state) => ({ isSecondaryAudioMuted: !state.isSecondaryAudioMuted })),
  setPreviewStartTime: (ms) => set({ previewStartTimeMs: ms }),
  setPreviewDuration: (seconds) => set({ previewDurationSeconds: seconds }),
  // Setup wizard actions
  setShowSetupWizard: (show) => set({ showSetupWizard: show }),
  setSetupWizardStep: (step) => set({ setupWizardStep: step }),
  // Analysis version control
  incrementAnalysisVersion: () => set((state) => ({ analysisVersion: state.analysisVersion + 1 })),
  // Export modal actions
  setShowExportModal: (show) => set({ showExportModal: show }),
  setExportMode: (mode) => set({ exportMode: mode }),
  setExportLanguage: (language) => set({ exportLanguage: language }),
  setExportTitle: (title) => set({ exportTitle: title }),
  resetExportModal: () =>
    set({
      showExportModal: false,
      exportLanguage: '',
      exportTitle: ''
    })
}))
