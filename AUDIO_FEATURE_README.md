# Audio Recording Feature for Behavioral Questions

## Overview
The Interview Coder app now includes an audio recording feature that helps you practice behavioral interview questions. This feature records your voice, transcribes the question using OpenRouter's Whisper API, and generates professional answers using the STAR method.

## Features
- **Audio Recording**: Record questions using your computer's microphone
- **Speech-to-Text**: Automatic transcription using OpenRouter Whisper
- **Answer Generation**: AI-powered behavioral interview answers using the STAR method
- **Playback**: Review your recorded audio before processing
- **Professional Answers**: Detailed, structured responses suitable for interviews

## How to Use

### Prerequisites
1. Ensure you have a valid OpenRouter API key configured in the app settings
2. Grant microphone permissions when prompted by your browser/system

### Step-by-Step Usage
1. **Open the App**: Launch the Interview Coder application
2. **Navigate to Queue**: The audio recorder is located in the main Queue interface
3. **Start Recording**: Click the "Start Recording" button (red microphone icon)
4. **Ask Your Question**: Speak your behavioral interview question clearly
5. **Stop Recording**: Click "Stop Recording" when finished
6. **Review (Optional)**: Click "Play" to review your recorded audio
7. **Generate Answer**: Click "Generate Answer" to process the audio
8. **View Results**: The transcribed question and generated answer will appear below

### Example Questions
The feature works best with behavioral interview questions such as:
- "Tell me about a time when you had to work with a difficult team member"
- "Describe a situation where you had to meet a tight deadline"
- "Give me an example of when you had to solve a complex problem"
- "Tell me about a time when you showed leadership"

## Technical Details

### Audio Format
- Records in WebM format with Opus codec
- Optimized for speech recognition with echo cancellation and noise suppression
- Sample rate: 16kHz for optimal Whisper API performance

### Answer Generation
- Uses OpenRouter models (configurable in settings, defaults to Claude 3.5 Sonnet)
- Follows the STAR method (Situation, Task, Action, Result)
- Generates 300-450 word responses (2-3 minutes when spoken)
- Professional, conversational tone suitable for interviews

### Privacy & Security
- Audio files are temporarily stored during processing and immediately deleted
- No audio data is permanently stored on your device
- All processing uses your personal OpenRouter API key

## Troubleshooting

### Common Issues
1. **Microphone Not Working**: Check browser/system permissions for microphone access
2. **No Transcription**: Ensure you're speaking clearly and the recording has audio
3. **API Errors**: Verify your OpenRouter API key is valid and has sufficient credits
4. **Poor Audio Quality**: Try recording in a quieter environment

### Error Messages
- "Failed to start recording": Check microphone permissions
- "No speech detected": The recording may be too quiet or empty
- "OpenRouter API key required": Configure your API key in settings
- "Failed to process audio": Check your internet connection and API key

## Tips for Best Results
1. **Speak Clearly**: Enunciate words clearly for better transcription
2. **Quiet Environment**: Record in a quiet space to minimize background noise
3. **Complete Questions**: Ask full, complete behavioral interview questions
4. **Review Answers**: Use the generated answers as a starting point and personalize them
5. **Practice**: Use the feature regularly to improve your interview skills

## Integration
The audio recording feature is seamlessly integrated into the existing Interview Coder interface:
- Located below the screenshot queue in the main interface
- Uses the same toast notification system for feedback
- Shares the OpenRouter API configuration with other features
- Maintains the app's dark theme and consistent UI design
