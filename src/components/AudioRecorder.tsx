import React, { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Square, Play } from 'lucide-react'
import { useToast } from '../contexts/toast'

interface AudioRecorderProps {
  onTranscriptionComplete: (transcription: string, answer: string) => void
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptionComplete
}) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcription, setTranscription] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [audioFormat, setAudioFormat] = useState<string>('webm')
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { showToast } = useToast()

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      })
      
      // Try multiple audio formats in order of preference for OpenRouter compatibility
      let mimeType = 'audio/webm;codecs=opus'
      let fileExtension = 'webm'
      
      // Check for MP3 support first (best for OpenRouter)
      if (MediaRecorder.isTypeSupported('audio/mp3')) {
        mimeType = 'audio/mp3'
        fileExtension = 'mp3'
      }
      // Then check for WAV support
      else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav'
        fileExtension = 'wav'
      }
      // Check for other WAV variants
      else if (MediaRecorder.isTypeSupported('audio/wave')) {
        mimeType = 'audio/wave'
        fileExtension = 'wav'
      }
      else if (MediaRecorder.isTypeSupported('audio/x-wav')) {
        mimeType = 'audio/x-wav'
        fileExtension = 'wav'
      }
      // Fallback to WebM (will be converted to WAV in backend)
      else {
        mimeType = 'audio/webm;codecs=opus'
        fileExtension = 'webm'
        console.log('Browser using WebM audio recording. Will be converted to WAV in backend.')
        showToast('Info', 'Recording in WebM format. Will be converted to WAV for OpenRouter compatibility.', 'neutral')
      }
      
      console.log(`Using audio format: ${mimeType} (${fileExtension})`)
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        setAudioFormat(fileExtension)
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      showToast('Recording', 'Audio recording started', 'success')
    } catch (error) {
      console.error('Error starting recording:', error)
      showToast('Error', 'Failed to start recording. Please check microphone permissions.', 'error')
    }
  }, [showToast])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      showToast('Recording', 'Audio recording stopped', 'neutral')
    }
  }, [isRecording, showToast])

  const processAudio = useCallback(async () => {
    if (!audioBlob) return

    setIsProcessing(true)
    showToast('Processing', 'Transcribing audio and generating answer...', 'neutral')

    try {
      // Convert blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer()
      
      // Call the transcription API with the correct format
      const transcriptionResponse = await window.electronAPI.transcribeAudio(arrayBuffer, `recording.${audioFormat}`)
      const transcribedText = transcriptionResponse.text
      
      setTranscription(transcribedText)
      
      if (transcribedText.trim()) {
        // Generate behavioral question answer
        const answerResponse = await window.electronAPI.generateBehavioralAnswer(transcribedText)
        const generatedAnswer = answerResponse.answer
        
        setAnswer(generatedAnswer)
        onTranscriptionComplete(transcribedText, generatedAnswer)
        
        showToast('Success', 'Audio processed and answer generated!', 'success')
      } else {
        showToast('Warning', 'No speech detected in the recording', 'error')
      }
    } catch (error) {
      console.error('Error processing audio:', error)
      showToast('Error', 'Failed to process audio. Please try again.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }, [audioBlob, audioFormat, onTranscriptionComplete, showToast])

  const playRecording = useCallback(() => {
    if (audioBlob) {
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      audio.play()
    }
  }, [audioBlob])

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Behavioral Question Assistant</h3>
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
            >
              <Mic size={16} />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              <Square size={16} />
              Stop Recording
            </button>
          )}
          
          {audioBlob && !isRecording && (
            <>
              <button
                onClick={playRecording}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                <Play size={16} />
                Play
              </button>
              <button
                onClick={processAudio}
                disabled={isProcessing}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md transition-colors"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Generate Answer'
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 text-red-400">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm">Recording in progress...</span>
        </div>
      )}

      {transcription && (
        <div className="space-y-2">
          <h4 className="text-white font-medium text-sm">Question Detected:</h4>
          <div className="bg-gray-800 border border-gray-600 rounded p-3">
            <p className="text-gray-300 text-sm">{transcription}</p>
          </div>
        </div>
      )}

      {answer && (
        <div className="space-y-2">
          <h4 className="text-white font-medium text-sm">Suggested Answer:</h4>
          <div className="bg-gray-800 border border-gray-600 rounded p-3 max-h-64 overflow-y-auto">
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{answer}</p>
          </div>
        </div>
      )}
    </div>
  )
}
