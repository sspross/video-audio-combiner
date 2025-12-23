import { create } from 'zustand'
import type { AudioTrack, ProjectState, WorkflowStep } from '../types'

interface ProjectActions {
  setMainFile: (path: string, tracks: AudioTrack[]) => void
  setSecondaryFile: (path: string, tracks: AudioTrack[]) => void
  setSelectedMainTrack: (index: number) => void
  setSelectedSecondaryTrack: (index: number) => void
  setMainWavPath: (path: string) => void
  setSecondaryWavPath: (path: string) => void
  setMainPeaks: (peaks: number[]) => void
  setSecondaryPeaks: (peaks: number[]) => void
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
  setPreviewDuration: (seconds: number) => void
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
  offsetMs: 0,
  confidence: 0,
  currentStep: 'select-files',
  isLoading: false,
  error: null,
  // Alignment editor state
  cursorPositionMs: 0,
  isMainAudioMuted: true,
  isSecondaryAudioMuted: false,
  previewDurationSeconds: 15
}

export const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  ...initialState,

  setMainFile: (path, tracks) =>
    set({
      mainFilePath: path,
      mainTracks: tracks,
      selectedMainTrackIndex: 0
    }),

  setSecondaryFile: (path, tracks) =>
    set({
      secondaryFilePath: path,
      secondaryTracks: tracks,
      selectedSecondaryTrackIndex: 0
    }),

  setSelectedMainTrack: (index) => set({ selectedMainTrackIndex: index }),
  setSelectedSecondaryTrack: (index) => set({ selectedSecondaryTrackIndex: index }),
  setMainWavPath: (path) => set({ mainWavPath: path }),
  setSecondaryWavPath: (path) => set({ secondaryWavPath: path }),
  setMainPeaks: (peaks) => set({ mainPeaks: peaks }),
  setSecondaryPeaks: (peaks) => set({ secondaryPeaks: peaks }),
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
  setPreviewDuration: (seconds) => set({ previewDurationSeconds: seconds })
}))
