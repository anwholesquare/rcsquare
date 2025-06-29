# Video Library with Frame Extraction Setup Guide

This guide will help you set up the enhanced video library with frame extraction, image captioning, and person detection features.

## Features

- **Frame Extraction**: Extract frames from videos at customizable intervals (default: 5 seconds)
- **Image Captioning**: Generate AI-powered captions for each extracted frame using BLIP model
- **Person Detection**: Detect and recognize faces in video frames with unique person IDs using MediaPipe
- **Vector Storage**: Store embeddings in Qdrant for semantic search capabilities
- **Visual Analysis Dashboard**: View extracted frames, captions, and detected persons

## Prerequisites

1. **Node.js** (v18+)
2. **Python** (v3.9+)
3. **MySQL Database**
4. **FFmpeg** (for video processing)
5. **CMake** (for compiling certain Python packages)
6. **Qdrant Cloud Account** (for vector storage)

## Setup Instructions

### 1. Install System Dependencies (macOS)

```bash
# Install CMake and Boost libraries (required for some Python packages)
brew install cmake boost boost-python3

# Verify installations
cmake --version
```

### 2. Clone and Install Node.js Dependencies

```bash
# Install Node.js dependencies
npm install

# Or with pnpm
pnpm install
```

### 3. Database Setup

```bash
# Run database migrations
npx prisma migrate dev
npx prisma generate
```

### 4. Flask Backend Setup

```bash
cd flask

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install Python dependencies (this may take a while for AI models)
pip install -r requirements.txt
```

### 5. Environment Configuration

Create `.env` file in the root directory:

```env
DATABASE_URL="mysql://username:password@localhost:3306/rcsquare"
SECURITY_KEY="123_RAGISACTIVATED_321"
```

### 6. Qdrant Configuration

The system is pre-configured to use Qdrant Cloud:
- **URL**: `https://2ad10262-46e6-4989-b11b-f887cf715954.us-east4-0.gcp.cloud.qdrant.io:6333`
- **API Key**: Pre-configured in the Flask app

Collections will be automatically created with the format:
- `{project_name}_frames` - Frame embeddings (CLIP, 512 dimensions)
- `{project_name}_captions` - Caption embeddings (MiniLM, 384 dimensions)
- `{project_name}_persons` - Person embeddings (CLIP, 512 dimensions)

## Running the Application

### 1. Start the Next.js Frontend

```bash
npm run dev
# or
pnpm dev
```

The frontend will be available at `http://localhost:3000`

### 2. Start the Flask Backend

```bash
cd flask
source venv/bin/activate  # Activate virtual environment
python app.py
```

The Flask API will be available at `http://localhost:3001`

**Note**: First startup will be slow (~2-3 minutes) as AI models are downloaded and loaded.

## Using Frame Extraction Features

### 1. Upload or Download Videos

- Use the existing video upload or YouTube download functionality
- Videos will appear in your project's video library

### 2. Extract Frames

For each video in the library:

1. **Set Frame Sampling**: Adjust the sampling interval (1-60 seconds)
2. **Click "Extract Frames"**: Starts the AI processing pipeline
3. **Monitor Status**: Watch the processing status badge (pending → processing → completed)
4. **View Results**: Once completed, use the view buttons to see results

### 3. View Analysis Results

When frame extraction is complete, you can:

- **View Frames**: See all extracted frames with timestamps
- **View Captions**: Read AI-generated descriptions for each frame
- **View Persons**: See detected faces with unique person IDs

### 4. Regenerate Analysis

- Change the frame sampling interval
- Click "Regenerate" to reprocess with new settings
- Previous data will be updated with new results

## Data Storage

### MySQL Database
- Video metadata and relationships
- Frame analysis status and metadata
- Extracted frame, caption, and person data

### Qdrant Vector Database
- Frame embeddings for visual similarity search
- Caption embeddings for semantic text search
- Person embeddings for face recognition search

### File System
- Original videos: `flask/{project_name}/videos/`
- Extracted frames: `flask/{project_name}/frames/{video_id}/`
- Face images: `flask/{project_name}/faces/{video_id}/`

## API Endpoints

### Frame Extraction
- `POST /api/extract-frames` - Start frame extraction (Flask)
- `GET /api/frame-analysis/{id}` - Get analysis status (Flask)
- `GET /frames/{video_id}/{filename}` - Serve frame images (Flask)
- `GET /faces/{video_id}/{filename}` - Serve face images (Flask)

### Data Management (Next.js)
- `POST /api/frame-analysis` - Create analysis record
- `PUT /api/frame-analysis` - Update analysis status
- `GET /api/frame-analysis?id={id}` - Get analysis details
- `POST /api/frames` - Store frame data
- `POST /api/captions` - Store caption data
- `POST /api/persons` - Store person data

## AI Models Used

- **CLIP (openai/clip-vit-base-patch32)**: Frame and face embeddings (512 dimensions)
- **BLIP (Salesforce/blip-image-captioning-base)**: Image captioning
- **MiniLM (sentence-transformers/all-MiniLM-L6-v2)**: Caption embeddings (384 dimensions)
- **MediaPipe**: Face detection and localization (Google's solution)

## Troubleshooting

### Common Issues

1. **CMake Not Found Error**
   ```bash
   # Install CMake first
   brew install cmake
   # Then retry pip install
   ```

2. **AI Models Loading Slowly**
   - First startup downloads large models (~1-2GB)
   - Subsequent startups are faster
   - Ensure stable internet connection

3. **Face Detection Not Working**
   - MediaPipe is now used (more reliable than dlib)
   - Ensure opencv-python is properly installed
   - Check image file permissions

4. **Vector Storage Errors**
   - Check Qdrant connection and API key
   - Verify network access to Qdrant Cloud
   - Collections are created automatically

5. **Memory Issues**
   - AI models require significant RAM (4GB+ recommended)
   - Close other applications if needed
   - Consider processing videos one at a time

6. **Database Connection Issues**
   - Verify MySQL is running
   - Check DATABASE_URL in .env file
   - Run `npx prisma db push` to sync schema

### Performance Tips

- Use appropriate frame sampling intervals (5-10 seconds is usually optimal)
- Process videos sequentially to avoid memory overload
- Monitor disk space as extracted frames can accumulate
- Restart Flask server if memory usage becomes high

## Example Output Format

### Frame Data
```json
{
  "video_id": "cmcgtws65000139rbm9ec8bet",
  "frames": [
    {
      "timestamp": "00.05.00",
      "image_link": "/frames/video_id/frame_0_00_05_00.jpg",
      "clip_embedding": "[0.1, 0.2, 0.3, ...]"
    }
  ]
}
```

### Caption Data
```json
{
  "captions": [
    {
      "timestamp": "00.05.00",
      "image_link": "/frames/video_id/frame_0_00_05_00.jpg",
      "caption": "A person writing code on a computer",
      "caption_embedding": "[0.3, 0.4, 0.5, ...]"
    }
  ]
}
```

### Person Data
```json
{
  "persons": [
    {
      "timestamp": "00.05.00",
      "image_link": "/faces/video_id/person_abc123_0.jpg",
      "person_uid": "person_abc123456789",
      "clip_embedding": "[0.5, 0.6, 0.7, ...]"
    }
  ]
}
```

## Recent Updates & Improvements

### v2.0 (Latest)
- ✅ **MediaPipe Integration**: Replaced dlib with Google's MediaPipe for reliable face detection
- ✅ **CMake Setup**: Added proper CMake installation instructions
- ✅ **Improved Error Handling**: Better error messages and recovery
- ✅ **Path Structure**: Fixed image serving paths with proper video_id organization
- ✅ **Background Processing**: Asynchronous frame extraction with status updates
- ✅ **Enhanced UI**: Beautiful modal for viewing analysis results

### Features Roadmap
- [ ] Semantic search across frames and captions
- [ ] Person tracking across multiple videos
- [ ] Advanced video analytics and insights
- [ ] Export functionality for analysis results
- [ ] Batch processing for multiple videos
- [ ] Custom AI model integration

## Support

If you encounter any issues:

1. Check the console logs in both Flask and Next.js
2. Verify all dependencies are installed correctly
3. Ensure database migrations are up to date
4. Check network connectivity for AI model downloads
5. Restart both servers if needed 