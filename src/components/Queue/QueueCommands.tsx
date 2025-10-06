import React, { useState, useEffect, useRef, useCallback } from "react"
import { createRoot } from "react-dom/client"

import { useToast } from "../../contexts/toast"
import { LanguageSelector } from "../shared/LanguageSelector"
import { COMMAND_KEY } from "../../utils/platform"

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  screenshotCount?: number
  credits: number
  currentLanguage: string
  setLanguage: (language: string) => void
  onTranscriptionComplete?: (transcription: string, answer: string) => void
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshotCount = 0,
  credits,
  currentLanguage,
  setLanguage,
  onTranscriptionComplete
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { showToast } = useToast()

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

      if (transcribedText.trim()) {
        const answerResponse = await window.electronAPI.generateBehavioralAnswer(transcribedText);
        const generatedAnswer = answerResponse.answer;

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
  }, [audioBlob, onTranscriptionComplete, showToast]);

  // Extract the repeated language selection logic into a separate function
  const extractLanguagesAndUpdate = (direction?: 'next' | 'prev') => {
    // Create a hidden instance of LanguageSelector to extract languages
    const hiddenRenderContainer = document.createElement('div');
    hiddenRenderContainer.style.position = 'absolute';
    hiddenRenderContainer.style.left = '-9999px';
    document.body.appendChild(hiddenRenderContainer);

    // Create a root and render the LanguageSelector temporarily
    const root = createRoot(hiddenRenderContainer);
    root.render(
      <LanguageSelector
        currentLanguage={currentLanguage}
        setLanguage={() => { }}
      />
    );

    // Use a small delay to ensure the component has rendered
    // 50ms is generally enough for React to complete a render cycle
    setTimeout(() => {
      // Extract options from the rendered select element
      const selectElement = hiddenRenderContainer.querySelector('select');
      if (selectElement) {
        const options = Array.from(selectElement.options);
        const values = options.map(opt => opt.value);

        // Find current language index
        const currentIndex = values.indexOf(currentLanguage);
        let newIndex = currentIndex;

        if (direction === 'prev') {
          // Go to previous language
          newIndex = (currentIndex - 1 + values.length) % values.length;
        } else {
          // Default to next language
          newIndex = (currentIndex + 1) % values.length;
        }

        if (newIndex !== currentIndex) {
          setLanguage(values[newIndex]);
          window.electronAPI.updateConfig({ language: values[newIndex] });
        }
      }

      // Clean up
      root.unmount();
      document.body.removeChild(hiddenRenderContainer);
    }, 50);
  };

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  const handleSignOut = async () => {
    try {
      // Clear any local storage or electron-specific data
      localStorage.clear();
      sessionStorage.clear();

      // Clear the API key in the configuration
      await window.electronAPI.updateConfig({
        apiKey: '',
      });

      showToast('Success', 'Logged out successfully', 'success');

      // Reload the app after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Error logging out:", err);
      showToast('Error', 'Failed to log out', 'error');
    }
  }

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  return (
    <div>
      <div className="pt-2 w-fit">
        <div className="text-xs text-white/90 backdrop-blur-md bg-black/60 rounded-lg py-2 px-4 flex items-center justify-center gap-4">
          {/* Screenshot */}
          <div
            className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
            onClick={async () => {
              try {
                const result = await window.electronAPI.triggerScreenshot()
                if (!result.success) {
                  console.error("Failed to take screenshot:", result.error)
                  showToast("Error", "Failed to take screenshot", "error")
                }
              } catch (error) {
                console.error("Error taking screenshot:", error)
                showToast("Error", "Failed to take screenshot", "error")
              }
            }}
          >
            <span className="text-[11px] leading-none truncate">
              {screenshotCount === 0
                ? "Take first screenshot"
                : screenshotCount === 1
                  ? "Take second screenshot"
                  : screenshotCount === 2
                    ? "Take third screenshot"
                    : screenshotCount === 3
                      ? "Take fourth screenshot"
                      : screenshotCount === 4
                        ? "Take fifth screenshot"
                        : "Next will replace first screenshot"}
            </span>
            <div className="flex gap-1">
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                {COMMAND_KEY}
              </button>
              <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                H
              </button>
            </div>
          </div>

          {/* Solve Command */}
          {screenshotCount > 0 && (
            <div
              className={`flex flex-col cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${credits <= 0 ? "opacity-50 cursor-not-allowed" : ""
                }`}
              onClick={async () => {

                try {
                  const result =
                    await window.electronAPI.triggerProcessScreenshots()
                  if (!result.success) {
                    console.error(
                      "Failed to process screenshots:",
                      result.error
                    )
                    showToast("Error", "Failed to process screenshots", "error")
                  }
                } catch (error) {
                  console.error("Error processing screenshots:", error)
                  showToast("Error", "Failed to process screenshots", "error")
                }
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] leading-none">Solve </span>
                <div className="flex gap-1 ml-2">
                  <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                    {COMMAND_KEY}
                  </button>
                  <button className="bg-white/10 rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                    ↵
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Separator */}
          <div className="mx-2 h-4 w-px bg-white/20" />

          {/* Settings with Tooltip */}
          <div
            className="relative inline-block"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Gear icon */}
            <div className="w-4 h-4 flex items-center justify-center cursor-pointer text-white/70 hover:text-white/90 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>

            {/* Tooltip Content */}
            {isTooltipVisible && (
              <div
                ref={tooltipRef}
                className="absolute top-full left-0 mt-2 w-80 transform -translate-x-[calc(50%-12px)]"
                style={{ zIndex: 100 }}
              >
                {/* Add transparent bridge */}
                <div className="absolute -top-2 right-0 w-full h-2" />
                <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90 shadow-lg">
                  <div className="space-y-4">
                    <h3 className="font-medium truncate">Keyboard Shortcuts</h3>
                    <div className="space-y-3">
                      {/* Toggle Command */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.toggleMainWindow()
                            if (!result.success) {
                              console.error(
                                "Failed to toggle window:",
                                result.error
                              )
                              showToast(
                                "Error",
                                "Failed to toggle window",
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("Error toggling window:", error)
                            showToast(
                              "Error",
                              "Failed to toggle window",
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Toggle Window</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              B
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          Show or hide this window.
                        </p>
                      </div>

                      {/* Screenshot Command */}
                      <div
                        className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                        onClick={async () => {
                          try {
                            const result =
                              await window.electronAPI.triggerScreenshot()
                            if (!result.success) {
                              console.error(
                                "Failed to take screenshot:",
                                result.error
                              )
                              showToast(
                                "Error",
                                "Failed to take screenshot",
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("Error taking screenshot:", error)
                            showToast(
                              "Error",
                              "Failed to take screenshot",
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Take Screenshot</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              H
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          Take a screenshot of the problem description.
                        </p>
                      </div>

                      {/* Record Audio Command */}
                      {!isRecording ? (
                        <div
                          className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors"
                          onClick={startRecording}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">Record Question</span>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                {COMMAND_KEY}
                              </span>
                              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                R
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                            Record a behavioral interview question.
                          </p>
                        </div>
                      ) : (
                        <div
                          className="cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors bg-red-500/20"
                          onClick={stopRecording}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate text-red-400">Stop Recording</span>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className="bg-red-500/30 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                Recording...
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] leading-relaxed text-red-300/70 truncate mt-1">
                            Click to stop recording.
                          </p>
                        </div>
                      )}

                      {/* Generate Answer Command */}
                      {audioBlob && !isRecording && (
                        <div
                          className={`cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${isProcessing ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          onClick={processAudio}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">
                              {isProcessing ? "Processing..." : "Generate Answer"}
                            </span>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                {COMMAND_KEY}
                              </span>
                              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                                G
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                            {isProcessing
                              ? "Transcribing and generating answer..."
                              : "Generate behavioral interview answer."
                            }
                          </p>
                        </div>
                      )}

                      {/* Solve Command */}
                      <div
                        className={`cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${screenshotCount > 0
                          ? ""
                          : "opacity-50 cursor-not-allowed"
                          }`}
                        onClick={async () => {
                          if (screenshotCount === 0) return

                          try {
                            const result =
                              await window.electronAPI.triggerProcessScreenshots()
                            if (!result.success) {
                              console.error(
                                "Failed to process screenshots:",
                                result.error
                              )
                              showToast(
                                "Error",
                                "Failed to process screenshots",
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error(
                              "Error processing screenshots:",
                              error
                            )
                            showToast(
                              "Error",
                              "Failed to process screenshots",
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Solve</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              ↵
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          {screenshotCount > 0
                            ? "Generate a solution based on the current problem."
                            : "Take a screenshot first to generate a solution."}
                        </p>
                      </div>

                      {/* Delete Last Screenshot Command */}
                      <div
                        className={`cursor-pointer rounded px-2 py-1.5 hover:bg-white/10 transition-colors ${screenshotCount > 0
                          ? ""
                          : "opacity-50 cursor-not-allowed"
                          }`}
                        onClick={async () => {
                          if (screenshotCount === 0) return

                          try {
                            const result = await window.electronAPI.deleteLastScreenshot()
                            if (!result.success) {
                              console.error(
                                "Failed to delete last screenshot:",
                                result.error
                              )
                              showToast(
                                "Error",
                                result.error || "Failed to delete screenshot",
                                "error"
                              )
                            }
                          } catch (error) {
                            console.error("Error deleting screenshot:", error)
                            showToast(
                              "Error",
                              "Failed to delete screenshot",
                              "error"
                            )
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">Delete Last Screenshot</span>
                          <div className="flex gap-1 flex-shrink-0">
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              {COMMAND_KEY}
                            </span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] leading-none">
                              L
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] leading-relaxed text-white/70 truncate mt-1">
                          {screenshotCount > 0
                            ? "Remove the most recently taken screenshot."
                            : "No screenshots to delete."}
                        </p>
                      </div>
                    </div>

                    {/* Separator and Log Out */}
                    <div className="pt-3 mt-3 border-t border-white/10">
                      {/* Simplified Language Selector */}
                      <div className="mb-3 px-2">
                        <div
                          className="flex items-center justify-between cursor-pointer hover:bg-white/10 rounded px-2 py-1 transition-colors"
                          onClick={() => extractLanguagesAndUpdate('next')}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                              extractLanguagesAndUpdate('prev');
                            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                              extractLanguagesAndUpdate('next');
                            }
                          }}
                        >
                          <span className="text-[11px] text-white/70">Language</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white/90">{currentLanguage}</span>
                            <div className="text-white/40 text-[8px]">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* API Key Settings */}
                      <div className="mb-3 px-2 space-y-1">
                        <div className="flex items-center justify-between text-[13px] font-medium text-white/90">
                          <span>OpenAI API Settings</span>
                          <button
                            className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[11px]"
                            onClick={() => window.electronAPI.openSettingsPortal()}
                          >
                            Settings
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 text-[11px] text-red-400 hover:text-red-300 transition-colors w-full"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-3 h-3"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                        </div>
                        Log Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default QueueCommands
