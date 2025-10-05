import React, { useState, useCallback, useRef } from 'react';
import { Settings, LogOut, ChevronDown, ChevronUp, Mic, MicOff, Square, Play } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '../../contexts/toast';

interface HeaderProps {
  currentLanguage: string;
  setLanguage: (language: string) => void;
  onOpenSettings: () => void;
  onTranscriptionComplete?: (transcription: string, answer: string) => void;
}

// Available programming languages
const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'typescript', label: 'TypeScript' },
];

export function Header({ currentLanguage, setLanguage, onOpenSettings, onTranscriptionComplete }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { showToast } = useToast();

  // Handle logout - clear API key and reload app
  const handleLogout = async () => {
    try {
      // Update config with empty API key
      await window.electronAPI.updateConfig({
        apiKey: '',
      });
      
      showToast('Success', 'Logged out successfully', 'success');
      
      // Reload the app after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error logging out:', error);
      showToast('Error', 'Failed to log out', 'error');
    }
  };

  // Handle language selection
  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    setDropdownOpen(false);
    
    // Also save the language preference to config
    window.electronAPI.updateConfig({
      language: lang
    }).catch(error => {
      console.error('Failed to save language preference:', error);
    });
  };

  // Audio recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      showToast('Recording', 'Audio recording started', 'success');
    } catch (error) {
      console.error('Error starting recording:', error);
      showToast('Error', 'Failed to start recording. Please check microphone permissions.', 'error');
    }
  }, [showToast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      showToast('Recording', 'Audio recording stopped', 'neutral');
    }
  }, [isRecording, showToast]);

  const processAudio = useCallback(async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    showToast('Processing', 'Transcribing audio and generating answer...', 'neutral');

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      const transcriptionResponse = await window.electronAPI.transcribeAudio(arrayBuffer, 'recording.webm');
      const transcribedText = transcriptionResponse.text;
      
      setTranscription(transcribedText);
      
      if (transcribedText.trim()) {
        const answerResponse = await window.electronAPI.generateBehavioralAnswer(transcribedText);
        const generatedAnswer = answerResponse.answer;
        
        setAnswer(generatedAnswer);
        onTranscriptionComplete?.(transcribedText, generatedAnswer);
        showToast('Success', 'Audio processed and answer generated!', 'success');
      } else {
        showToast('Warning', 'No speech detected in the recording', 'error');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      showToast('Error', 'Failed to process audio. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [audioBlob, showToast]);

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  // Find the current language object
  const currentLangObj = LANGUAGES.find(lang => lang.value === currentLanguage) || LANGUAGES[0];

  return (
    <div className="bg-black p-2 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center space-x-1">
        <span className="text-white text-sm mr-2">Language:</span>
        <div className="relative">
          <button
            onClick={toggleDropdown}
            className="flex items-center gap-1 rounded-md bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition-colors"
          >
            {currentLangObj.label}
            {dropdownOpen ? (
              <ChevronUp className="h-4 w-4 text-white/70" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/70" />
            )}
          </button>
          
          {dropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-black border border-white/10 shadow-lg">
              <div className="py-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageSelect(lang.value)}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      currentLanguage === lang.value
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {!isRecording ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-red-400/80 hover:text-red-400 hover:bg-white/10"
            onClick={startRecording}
            disabled={isProcessing}
            title="Start Recording"
          >
            <Mic className="h-4 w-4 mr-1" />
            <span className="text-xs">Record</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-yellow-400/80 hover:text-yellow-400 hover:bg-white/10"
            onClick={stopRecording}
            title="Stop Recording"
          >
            <Square className="h-4 w-4 mr-1" />
            <span className="text-xs">Stop</span>
          </Button>
        )}
        
        {audioBlob && !isRecording && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-green-400/80 hover:text-green-400 hover:bg-white/10"
            onClick={processAudio}
            disabled={isProcessing}
            title="Generate Answer"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-1" />
                <span className="text-xs">Processing</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                <span className="text-xs">Generate</span>
              </>
            )}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-white/70 hover:text-white hover:bg-white/10"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          <span className="text-xs">Settings</span>
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-red-400/80 hover:text-red-400 hover:bg-white/10"
          onClick={handleLogout}
          title="Log Out"
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="text-xs">Log Out</span>
        </Button>
      </div>
    </div>
  );
}

// Results display component for transcription and answer
export function AudioResults({ transcription, answer }: { transcription: string; answer: string }) {
  if (!transcription && !answer) return null;

  return (
    <div className="bg-gray-900 border-b border-white/10 p-4 space-y-3">
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
  );
}
