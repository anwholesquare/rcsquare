# RCSquare - Retrieve Contextually Relevant Clips

A full-stack application for managing video clips with contextual metadata, built with Next.js, Flask, and MySQL.

## Features

- **Project Management**: Create unique projects with security key validation
- **Video Upload**: Upload video files with metadata (title, description, tags)
- **YouTube Integration**: Download videos from YouTube URLs with automatic metadata extraction
- **Video Processing**: Automatic compression to 480p for optimal storage
- **Metadata Storage**: Save contextual information alongside videos
- **Secure Access**: Project-based access control with security key validation

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript and shadcn/ui components
- **Backend**: Flask with video processing capabilities
- **Database**: MySQL with Prisma ORM
- **Video Processing**: FFmpeg for video compression
- **YouTube Integration**: yt-dlp for downloading videos

## Prerequisites

- Node.js 18+ and pnpm
- Python 3.9+ with pip
- MySQL server running on localhost:3306
- FFmpeg installed on your system

## Installation

1. **Clone the repository and install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up the database**:
   - Create a MySQL database named `rcsquare`
   - Run the database migration:
     ```bash
     npx prisma migrate dev
     ```

3. **Set up the Flask backend**:
   ```bash
   cd flask
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install flask-cors yt-dlp ffmpeg-python
   cd ..
   ```

4. **Environment Variables**:
   Create a `.env` file with:
   ```
   DATABASE_URL="mysql://root:@localhost:3306/rcsquare"
   SECURITY_KEY=123_RAGISACTIVATED_321
   ```

## Usage

### Running the Application

1. **Start both servers**:
   ```bash
   pnpm run dev:full
   ```
   This will start:
   - Next.js frontend on http://localhost:3000
   - Flask backend on http://localhost:3001

2. **Or run servers separately**:
   ```bash
   # Terminal 1 - Frontend
   pnpm run dev
   
   # Terminal 2 - Backend
   pnpm run flask
   ```

### Using the Application

1. **Project Access**:
   - Enter a unique project name (minimum 3 characters)
   - Enter the security key: `123_RAGISACTIVATED_321`

2. **Upload Videos**:
   - **File Upload**: Drag & drop video files or click to select
   - **YouTube URLs**: Paste YouTube video URLs for automatic download
   - Add metadata: title, description, tags

3. **View Videos**:
   - Browse uploaded videos with their metadata
   - Videos are automatically compressed to 480p
   - Metadata is stored in text files alongside videos

## File Structure

```
rcsquare-nextjs/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main application page
│   └── layout.tsx         # App layout
├── components/            # React components
│   ├── project-validation.tsx
│   ├── video-upload.tsx
│   └── video-list.tsx
├── flask/                 # Flask backend
│   ├── app.py            # Flask application
│   ├── venv/             # Python virtual environment
│   └── {project-name}/   # Project directories (created dynamically)
│       └── videos/       # Video files and metadata
├── prisma/               # Database schema and migrations
└── lib/                  # Utility functions
```

## API Endpoints

- `POST /api/validate-project` - Validate project and security key
- `POST /api/download-youtube` - Download YouTube video
- `POST /api/upload-video` - Upload video file
- `GET /api/list-videos/{project_name}` - List project videos

## Video Storage

Videos are stored in the following structure:
```
flask/
└── {project-name}/
    └── videos/
        ├── {video-id}.mp4           # Compressed video (480p)
        └── {video-id}_context.txt   # Metadata file
```

## Security

- All projects require the security key: `123_RAGISACTIVATED_321`
- Projects are isolated by name
- Video access requires both project name and security key

## Development

- **Frontend**: Built with Next.js 15, TypeScript, and shadcn/ui
- **Backend**: Flask with CORS enabled for cross-origin requests
- **Database**: MySQL with Prisma for type-safe database access
- **Video Processing**: FFmpeg for compression and format conversion

## Troubleshooting

1. **Database Connection**: Ensure MySQL is running and accessible
2. **FFmpeg**: Install FFmpeg for video processing
3. **Python Dependencies**: Ensure all Flask dependencies are installed
4. **CORS Issues**: Backend includes CORS headers for frontend access

## Next Steps

This is the foundation for the RCSquare application. Future enhancements can include:
- Advanced video search and filtering
- Video transcription and analysis
- User authentication and authorization
- Cloud storage integration
- Advanced metadata extraction
