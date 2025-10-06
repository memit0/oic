// ipcHandlers.ts

import { ipcMain, shell, dialog } from "electron"
import { randomBytes } from "crypto"
import { IIpcHandlerDeps } from "./main"
import { configHelper } from "./ConfigHelper"
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Set FFmpeg path to the bundled binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

// WebM to WAV conversion function using FFmpeg
async function convertWebMToWAV(webmBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir()
    const inputPath = path.join(tempDir, `input_${Date.now()}.webm`)
    const outputPath = path.join(tempDir, `output_${Date.now()}.wav`)
    
    try {
      // Write WebM buffer to temporary file
      fs.writeFileSync(inputPath, webmBuffer)
      
      // Convert WebM to WAV using FFmpeg
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioFrequency(16000)  // 16kHz sample rate for OpenRouter
        .audioChannels(1)       // Mono audio
        .audioBitrate('16k')    // 16-bit audio
        .on('end', () => {
          try {
            // Read the converted WAV file
            const wavBuffer = fs.readFileSync(outputPath)
            
            // Cleanup temporary files
            try { fs.unlinkSync(inputPath) } catch {}
            try { fs.unlinkSync(outputPath) } catch {}
            
            resolve(wavBuffer)
          } catch (readError) {
            reject(new Error(`Failed to read converted WAV file: ${readError.message}`))
          }
        })
        .on('error', (err: any) => {
          // Cleanup temporary files on error
          try { fs.unlinkSync(inputPath) } catch {}
          try { fs.unlinkSync(outputPath) } catch {}
          
          reject(new Error(`FFmpeg conversion failed: ${err.message}`))
        })
        .save(outputPath)
        
    } catch (error) {
      // Cleanup on any error
      try { fs.unlinkSync(inputPath) } catch {}
      try { fs.unlinkSync(outputPath) } catch {}
      
      reject(new Error(`WebM to WAV conversion setup failed: ${error.message}`))
    }
  })
}


export function initializeIpcHandlers(deps: IIpcHandlerDeps): void {
  console.log("\n" + "🚀 INITIALIZING IPC HANDLERS")
  console.log("🎤 Audio processing functionality enabled")
  console.log("=".repeat(50))

  // Configuration handlers
  ipcMain.handle("get-config", () => {
    return configHelper.loadConfig();
  })

  ipcMain.handle("update-config", (_event, updates) => {
    return configHelper.updateConfig(updates);
  })

  ipcMain.handle("check-api-key", () => {
    return configHelper.hasApiKey();
  })
  
  ipcMain.handle("validate-api-key", async (_event, apiKey) => {
    // First check the format
    if (!configHelper.isValidApiKeyFormat(apiKey)) {
      return { 
        valid: false, 
        error: "Invalid API key format. OpenRouter API keys start with 'sk-or-', OpenAI keys start with 'sk-'" 
      };
    }
    
    // Then test the API key with the appropriate provider
    const result = await configHelper.testApiKey(apiKey);
    return result;
  })

  // Credits handlers
  ipcMain.handle("set-initial-credits", async (_event, credits: number) => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      // Set the credits in a way that ensures atomicity
      await mainWindow.webContents.executeJavaScript(
        `window.__CREDITS__ = ${credits}`
      )
      mainWindow.webContents.send("credits-updated", credits)
    } catch (error) {
      console.error("Error setting initial credits:", error)
      throw error
    }
  })

  ipcMain.handle("decrement-credits", async () => {
    const mainWindow = deps.getMainWindow()
    if (!mainWindow) return

    try {
      const currentCredits = await mainWindow.webContents.executeJavaScript(
        "window.__CREDITS__"
      )
      if (currentCredits > 0) {
        const newCredits = currentCredits - 1
        await mainWindow.webContents.executeJavaScript(
          `window.__CREDITS__ = ${newCredits}`
        )
        mainWindow.webContents.send("credits-updated", newCredits)
      }
    } catch (error) {
      console.error("Error decrementing credits:", error)
    }
  })

  // Screenshot queue handlers
  ipcMain.handle("get-screenshot-queue", () => {
    return deps.getScreenshotQueue()
  })

  ipcMain.handle("get-extra-screenshot-queue", () => {
    return deps.getExtraScreenshotQueue()
  })

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return deps.deleteScreenshot(path)
  })

  ipcMain.handle("get-image-preview", async (event, path: string) => {
    return deps.getImagePreview(path)
  })

  // Screenshot processing handlers
  ipcMain.handle("process-screenshots", async () => {
    // Check for API key before processing
    if (!configHelper.hasApiKey()) {
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
      }
      return;
    }
    
    await deps.processingHelper?.processScreenshots()
  })

  // Window dimension handlers
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        deps.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle(
    "set-window-dimensions",
    (event, width: number, height: number) => {
      deps.setWindowDimensions(width, height)
    }
  )

  // Screenshot management handlers
  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const currentView = deps.getView()

      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue()
        previews = await Promise.all(
          queue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      } else {
        const extraQueue = deps.getExtraScreenshotQueue()
        previews = await Promise.all(
          extraQueue.map(async (path) => ({
            path,
            preview: await deps.getImagePreview(path)
          }))
        )
      }

      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  // Screenshot trigger handlers
  ipcMain.handle("trigger-screenshot", async () => {
    const mainWindow = deps.getMainWindow()
    if (mainWindow) {
      try {
        const screenshotPath = await deps.takeScreenshot()
        const preview = await deps.getImagePreview(screenshotPath)
        mainWindow.webContents.send("screenshot-taken", {
          path: screenshotPath,
          preview
        })
        return { success: true }
      } catch (error) {
        console.error("Error triggering screenshot:", error)
        return { error: "Failed to trigger screenshot" }
      }
    }
    return { error: "No main window available" }
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await deps.takeScreenshot()
      const preview = await deps.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      return { error: "Failed to take screenshot" }
    }
  })

  // Auth-related handlers removed

  ipcMain.handle("open-external-url", (event, url: string) => {
    shell.openExternal(url)
  })
  
  // Open external URL handler
  ipcMain.handle("openLink", (event, url: string) => {
    try {
      console.log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error(`Error opening URL ${url}:`, error);
      return { success: false, error: `Failed to open URL: ${error}` };
    }
  })

  // Settings portal handler
  ipcMain.handle("open-settings-portal", () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("show-settings-dialog");
      return { success: true };
    }
    return { success: false, error: "Main window not available" };
  })

  // Window management handlers
  ipcMain.handle("toggle-window", () => {
    try {
      deps.toggleMainWindow()
      return { success: true }
    } catch (error) {
      console.error("Error toggling window:", error)
      return { error: "Failed to toggle window" }
    }
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      deps.clearQueues()
      return { success: true }
    } catch (error) {
      console.error("Error resetting queues:", error)
      return { error: "Failed to reset queues" }
    }
  })

  // Process screenshot handlers
  ipcMain.handle("trigger-process-screenshots", async () => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(deps.PROCESSING_EVENTS.API_KEY_INVALID);
        }
        return { success: false, error: "API key required" };
      }
      
      await deps.processingHelper?.processScreenshots()
      return { success: true }
    } catch (error) {
      console.error("Error processing screenshots:", error)
      return { error: "Failed to process screenshots" }
    }
  })

  // Reset handlers
  ipcMain.handle("trigger-reset", () => {
    try {
      // First cancel any ongoing requests
      deps.processingHelper?.cancelOngoingRequests()

      // Clear all queues immediately
      deps.clearQueues()

      // Reset view to queue
      deps.setView("queue")

      // Get main window and send reset events
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send reset events in sequence
        mainWindow.webContents.send("reset-view")
        mainWindow.webContents.send("reset")
      }

      return { success: true }
    } catch (error) {
      console.error("Error triggering reset:", error)
      return { error: "Failed to trigger reset" }
    }
  })

  // Window movement handlers
  ipcMain.handle("trigger-move-left", () => {
    try {
      deps.moveWindowLeft()
      return { success: true }
    } catch (error) {
      console.error("Error moving window left:", error)
      return { error: "Failed to move window left" }
    }
  })

  ipcMain.handle("trigger-move-right", () => {
    try {
      deps.moveWindowRight()
      return { success: true }
    } catch (error) {
      console.error("Error moving window right:", error)
      return { error: "Failed to move window right" }
    }
  })

  ipcMain.handle("trigger-move-up", () => {
    try {
      deps.moveWindowUp()
      return { success: true }
    } catch (error) {
      console.error("Error moving window up:", error)
      return { error: "Failed to move window up" }
    }
  })

  ipcMain.handle("trigger-move-down", () => {
    try {
      deps.moveWindowDown()
      return { success: true }
    } catch (error) {
      console.error("Error moving window down:", error)
      return { error: "Failed to move window down" }
    }
  })
  
  // Delete last screenshot handler
  ipcMain.handle("delete-last-screenshot", async () => {
    try {
      const queue = deps.getView() === "queue" 
        ? deps.getScreenshotQueue() 
        : deps.getExtraScreenshotQueue()
      
      if (queue.length === 0) {
        return { success: false, error: "No screenshots to delete" }
      }
      
      // Get the last screenshot in the queue
      const lastScreenshot = queue[queue.length - 1]
      
      // Delete it
      const result = await deps.deleteScreenshot(lastScreenshot)
      
      // Notify the renderer about the change
      const mainWindow = deps.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-deleted", { path: lastScreenshot })
      }
      
      return result
    } catch (error) {
      console.error("Error deleting last screenshot:", error)
      return { success: false, error: "Failed to delete last screenshot" }
    }
  })

  // Audio processing handlers
  ipcMain.handle("transcribe-audio", async (_event, audioBuffer: Buffer, filename: string) => {
    try {
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        throw new Error("API key is required for audio transcription")
      }

      const config = configHelper.loadConfig()
      const apiKey = config.apiKey

      if (!apiKey) {
        throw new Error("API key not found")
      }

      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const OpenAI = require('openai')
      
      // For OpenRouter, we need to convert WebM to WAV since OpenRouter only supports wav/mp3
      // Determine the actual format we'll send (always WAV for WebM input)
      const isWebM = filename.toLowerCase().includes('webm')
      const isMp3 = filename.toLowerCase().endsWith('.mp3')
      const audioFormat = isMp3 ? 'mp3' : 'wav'
      
      if (apiKey.startsWith('sk-or-')) {
        // Use OpenRouter's multimodal audio API
        const openai = new OpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://github.com/your-repo",
            "X-Title": "OIC - Online Interview Companion"
          }
        })

        let processedAudioBuffer = audioBuffer
        let finalFormat = audioFormat

        // If it's WebM, convert it to WAV using FFmpeg
        if (isWebM) {
          try {
            console.log('Converting WebM to WAV using FFmpeg...')
            processedAudioBuffer = await convertWebMToWAV(audioBuffer)
            finalFormat = 'wav'
            console.log('Successfully converted WebM to WAV')
          } catch (conversionError) {
            console.error('WebM to WAV conversion failed:', conversionError)
            throw new Error(`Failed to convert WebM audio to WAV format: ${conversionError.message}. Please ensure FFmpeg is properly installed.`)
          }
        }

        // Convert processed audio buffer to base64
        const base64Audio = processedAudioBuffer.toString('base64')

        // Use chat completions with audio input for transcription
        const completion = await openai.chat.completions.create({
          model: "openai/gpt-4o-audio-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please transcribe this audio file. Return only the transcribed text without any additional commentary."
                },
                {
                  type: "input_audio",
                  input_audio: {
                    data: base64Audio,
                    format: finalFormat
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        })

        const transcribedText = completion.choices[0]?.message?.content || ""
        return { text: transcribedText }
        
      } else {
        // Use OpenAI directly for Whisper transcription
        const openai = new OpenAI({ apiKey })

        // Create a temporary file
        const tempDir = os.tmpdir()
        const tempFilePath = path.join(tempDir, `temp_audio_${Date.now()}_${filename}`)
        
        // Write the buffer to a temporary file
        fs.writeFileSync(tempFilePath, audioBuffer)

        try {
          // Use OpenAI's Whisper for transcription
          const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "en"
          })

          return { text: transcription.text }
        } finally {
          // Clean up the temporary file
          try {
            fs.unlinkSync(tempFilePath)
          } catch (cleanupError) {
            console.warn("Failed to clean up temporary audio file:", cleanupError)
          }
        }
      }
    } catch (error) {
      console.error("Error transcribing audio:", error)
      throw error
    }
  })

  ipcMain.handle("generate-behavioral-answer", async (_event, question: string) => {
    try {
      console.log("\n" + "🎯 BEHAVIORAL ANSWER GENERATION")
      console.log("❓ Question:", question)
      
      // Check for API key before processing
      if (!configHelper.hasApiKey()) {
        throw new Error("API key is required for answer generation")
      }

      const config = configHelper.loadConfig()
      const apiKey = config.apiKey

      if (!apiKey) {
        throw new Error("API key not found")
      }

      const OpenAI = require('openai')
      
      // Use OpenRouter for answer generation if available, otherwise use OpenAI
      let openai
      let modelToUse
      
      if (apiKey.startsWith('sk-or-')) {
        // Use OpenRouter API for chat completions
        openai = new OpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://github.com/your-repo",
            "X-Title": "OIC - Online Interview Companion"
          }
        })
        modelToUse = config.solutionModel || "openai/gpt-4o"
      } else {
        // Use OpenAI directly
        openai = new OpenAI({ apiKey })
        modelToUse = config.solutionModel || "gpt-4o"
      }

      const prompt = `You are an expert interview coach helping someone prepare for behavioral interviews. 

The interviewer asked: "${question}"

Please provide a comprehensive, professional answer using the STAR method (Situation, Task, Action, Result). The answer should:
1. Be specific and detailed
2. Show leadership, problem-solving, or relevant skills
3. Include quantifiable results when possible
4. Be authentic and conversational
5. Be around 2-3 minutes when spoken (approximately 300-450 words)

Provide only the answer, without any prefacing text like "Here's a good answer:" or similar.`

      console.log("\n" + "🤖 FULL PROMPT BEING SENT TO AI")
      console.log("─".repeat(60))
      console.log(prompt)
      console.log("─".repeat(60))
      console.log("🚀 Sending to AI model:", modelToUse)
      console.log("=".repeat(50) + "\n")

      const completion = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: "You are an expert interview coach specializing in behavioral interview questions. Provide detailed, professional answers using the STAR method."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      })

      const answer = completion.choices[0]?.message?.content || "I apologize, but I couldn't generate an answer for this question."

      return { answer }
    } catch (error) {
      console.error("Error generating behavioral answer:", error)
      throw error
    }
  })
}
