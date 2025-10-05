# Audio Recording Feature for Behavioral Questions

## Overview
The Interview Coder app now includes an audio recording feature that helps you practice behavioral interview questions. This feature records your voice, transcribes the question using OpenRouter's GPT-4o audio capabilities, and generates professional answers using the STAR method.

## Features
- **Audio Recording**: Record questions using your computer's microphone
- **Speech-to-Text**: Automatic transcription using OpenRouter GPT-4o audio or OpenAI Whisper
- **Answer Generation**: AI-powered behavioral interview answers using GPT-4o
- **Playback**: Review your recorded audio before processing
- **Professional Answers**: Detailed, structured responses suitable for interviews

## How to Use

### Prerequisites
1. **OpenRouter API Key** (Recommended): For both audio transcription and answer generation using GPT-4o audio
2. **OpenAI API Key** (Alternative): If you prefer to use OpenAI's Whisper for transcription
3. Grant microphone permissions when prompted by your browser/system

### Step-by-Step Usage
1. **Open the App**: Launch the Interview Coder application
2. **Navigate to Queue**: The audio recorder is located in the main Queue interface
3. **Start Recording**: Click the "Start Recording" button (red microphone icon)
4. **Ask Your Question**: Speak your behavioral interview question clearly
5. **Stop Recording**: Click "Stop Recording" when finished
6. **Review (Optional)**: Click "Play" to review your recorded audio
7. **Generate Answer**: Click "Generate Answer" to process the audio
8. **View Results**: The transcribed question and generated answer will appear below

## Technical Details

### Audio Processing
- **OpenRouter Users**: Uses GPT-4o audio model for transcription via multimodal chat completions
- **OpenAI Users**: Uses Whisper-1 model for transcription via dedicated audio API
- **Supported Formats**: WebM (recorded), WAV, MP3
- **Base64 Encoding**: Audio is automatically converted to base64 for OpenRouter processing

### Answer Generation
- Uses GPT-4o model (configurable in settings)
- Follows the STAR method (Situation, Task, Action, Result)
- Generates 300-450 word responses (2-3 minutes when spoken)
- Professional, conversational tone suitable for interviews

### API Key Detection
The app automatically detects your API key type:
- **OpenRouter keys** (`sk-or-...`): Uses multimodal audio API for transcription
- **OpenAI keys** (`sk-...`): Uses traditional Whisper API for transcription

## Troubleshooting

### Common Issues
1. **Microphone Not Working**: Check browser/system permissions for microphone access
2. **No Transcription**: Ensure you're speaking clearly and the recording has audio
3. **API Errors**: Verify your API key is valid and has sufficient credits
4. **Poor Audio Quality**: Try recording in a quieter environment

### Error Messages
- "Failed to start recording": Check microphone permissions
- "No speech detected": The recording may be too quiet or empty
- "API key required": Configure your API key in settings
- "Failed to process audio": Check your internet connection and API key

## Tips for Best Results
1. **Speak Clearly**: Enunciate words clearly for better transcription
2. **Quiet Environment**: Record in a quiet space to minimize background noise
3. **Complete Questions**: Ask full, complete behavioral interview questions
4. **Review Answers**: Use the generated answers as a starting point and personalize them
5. **Practice**: Use the feature regularly to improve your interview skills
