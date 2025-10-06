import { ipcMain } from "electron"
import { configHelper } from "./ConfigHelper"

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
      
      // Determine audio format from filename
      const audioFormat = filename.toLowerCase().endsWith('.mp3') ? 'mp3' : 'wav'
      
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

        // Convert audio buffer to base64
        const base64Audio = audioBuffer.toString('base64')

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
                    format: audioFormat
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
