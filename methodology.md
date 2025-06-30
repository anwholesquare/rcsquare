# RCSquare: AI-Powered Video Search System - Research Methodology

## Abstract

This document outlines the comprehensive methodology for developing and evaluating RCSquare, an advanced AI-powered video search system that enables semantic content discovery across video libraries through multiple search modalities. The system integrates natural language processing, computer vision, and vector databases to provide intuitive access to video content through text queries, person recognition, and visual frame similarity matching.

## 1. Research Objectives

### 1.1 Primary Objectives
- **Develop a multi-modal video search system** that combines text, person, and visual frame search capabilities
- **Create an intuitive public interface** for non-authenticated video content discovery
- **Implement cost-effective AI integration** with comprehensive token usage tracking and optimization
- **Establish scalable architecture** supporting multiple concurrent users and large video libraries

### 1.2 Secondary Objectives
- **Evaluate search accuracy** across different modalities and content types
- **Analyze user interaction patterns** and search behavior through comprehensive logging
- **Optimize system performance** for real-time search responses and video playback
- **Develop reusable frameworks** for video content analysis and retrieval

## 2. System Architecture Overview

### 2.1 Technology Stack
```
Frontend Layer:
├── Next.js 14 (React Framework)
├── TypeScript (Type Safety)
├── Tailwind CSS (Styling)
└── shadcn/ui (Component Library)

Backend Services:
├── Next.js API Routes (REST Endpoints)
├── Flask (Python Video Processing)
├── Prisma ORM (Database Management)
└── MySQL (Relational Database)

AI/ML Components:
├── OpenAI GPT-4.1-nano-2025-04-14 (Text Analysis)
├── Qdrant Cloud (Vector Database)
├── Computer Vision Models (Frame Analysis)
└── Embedding Models (Semantic Representations)
```

### 2.2 Data Flow Architecture
The system follows a multi-stage processing pipeline:

1. **Input Layer**: User queries (text/image) through web interface
2. **Processing Layer**: AI models analyze and generate embeddings
3. **Search Layer**: Vector similarity search in Qdrant collections
4. **Ranking Layer**: Result scoring and relevance filtering
5. **Presentation Layer**: Video playback with timestamp navigation

## 3. Data Collection and Preparation

### 3.1 Video Content Processing
```python
# Example video processing pipeline
def process_video_content(video_path, project_name):
    """
    Process uploaded videos for multi-modal search indexing
    """
    # 1. Extract video metadata
    metadata = extract_video_metadata(video_path)
    
    # 2. Generate video transcription
    transcription = generate_transcription(video_path)
    
    # 3. Extract key frames at regular intervals
    frames = extract_key_frames(video_path, interval=30)  # Every 30 seconds
    
    # 4. Perform face detection and recognition
    faces = detect_and_extract_faces(frames)
    
    # 5. Generate embeddings for visual content
    frame_embeddings = generate_frame_embeddings(frames)
    face_embeddings = generate_face_embeddings(faces)
    
    # 6. Store in respective collections
    store_video_data(metadata, transcription, project_name)
    store_embeddings(frame_embeddings, face_embeddings, project_name)
    
    return {
        'video_id': metadata['id'],
        'frames_processed': len(frames),
        'faces_detected': len(faces),
        'transcription_length': len(transcription)
    }
```

### 3.2 Database Schema Design
```sql
-- Core video content table
CREATE TABLE Video (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(191) NOT NULL,
  description TEXT,
  filePath VARCHAR(191) NOT NULL,
  duration DOUBLE,
  projectId VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (projectId) REFERENCES Project(id)
);

-- Transcription segments for text search
CREATE TABLE TranscriptionSegment (
  id VARCHAR(191) PRIMARY KEY,
  videoId VARCHAR(191) NOT NULL,
  startTime DOUBLE NOT NULL,
  endTime DOUBLE NOT NULL,
  text TEXT NOT NULL,
  confidence DOUBLE,
  FOREIGN KEY (videoId) REFERENCES Video(id)
);

-- Search history for analytics
CREATE TABLE SearchHistory (
  id VARCHAR(191) PRIMARY KEY,
  projectId VARCHAR(191) NOT NULL,
  query TEXT NOT NULL,
  searchType ENUM('text', 'person', 'frame') NOT NULL,
  results JSON NOT NULL,
  tokenUsage INT NOT NULL,
  cost DECIMAL(10,4) NOT NULL,
  model VARCHAR(191),
  metadata JSON,
  createdAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (projectId) REFERENCES Project(id)
);
```

## 4. Search Methodologies

### 4.1 Text Search Implementation

The text search utilizes OpenAI's GPT-4.1-nano-2025-04-14 model for advanced semantic understanding:

```javascript
// Text search methodology example
async function performTextSearch(query, projectName) {
  const prompt = `
    Analyze video transcriptions for relevance to user query.
    
    User Query: "${query}"
    
    Video Content: [transcriptions and segments data]
    
    Return JSON with:
    - videoId, relevanceScore (0-1), matchedSegments, explanation
    
    Limit to top 5 results, minimum score 0.3.
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano-2025-04-14",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### 4.2 Person Search Implementation

Face recognition using Qdrant vector database:

```python
def search_similar_persons(uploaded_image, project_name, limit=5):
    """
    Find videos containing similar faces using vector similarity
    """
    # Extract face embeddings from uploaded image
    face_embedding = extract_face_embedding(uploaded_image)
    
    # Query Qdrant collection for similar faces
    search_results = qdrant_client.search(
        collection_name=f"{project_name}_person",
        query_vector=face_embedding,
        limit=limit,
        score_threshold=0.7
    )
    
    # Format results with video metadata
    results = []
    for result in search_results:
        video_metadata = get_video_metadata(result.payload['video_id'])
        results.append({
            'videoId': result.payload['video_id'],
            'score': result.score,
            'timestamp': result.payload.get('timestamp'),
            'videoTitle': video_metadata['title']
        })
    
    return results
```

### 4.3 Frame Search Implementation

Visual similarity matching using CLIP embeddings:

```python
def search_similar_frames(uploaded_image, project_name, limit=5):
    """
    Find visually similar video frames
    """
    # Generate CLIP embedding for uploaded image
    image_embedding = generate_clip_embedding(uploaded_image)
    
    # Search Qdrant frame collection
    search_results = qdrant_client.search(
        collection_name=f"{project_name}_frames",
        query_vector=image_embedding,
        limit=limit,
        score_threshold=0.6
    )
    
    return format_frame_results(search_results)
```

## 5. User Interface Design

### 5.1 Public Access System
```typescript
// Project validation for public access
async function validatePublicProject(projectName: string) {
  const project = await prisma.project.findFirst({
    where: { 
      name: projectName,
      isPublic: true
    }
  });
  
  return project;
}
```

### 5.2 Multi-Modal Search Interface
The interface provides three search tabs:
- **Text Search**: Natural language queries
- **Person Search**: Face recognition via image upload
- **Frame Search**: Visual similarity via image upload

### 5.3 Video Playback with Smart Seeking
```typescript
const VideoPlayer = ({ result }) => {
  const handleVideoLoad = (video: HTMLVideoElement) => {
    if (result.timestamp) {
      // Parse timestamp and auto-seek
      const [hours, minutes, seconds] = result.timestamp
        .split('-')[0]
        .split('.')
        .map(Number);
      
      const seekTime = hours * 3600 + minutes * 60 + seconds;
      video.currentTime = seekTime;
    }
  };
  
  return (
    <video
      controls
      onLoadedMetadata={(e) => handleVideoLoad(e.target)}
      src={`${VIDEO_BASE_URL}/${result.videoId}?project=${projectName}`}
    />
  );
};
```

## 6. Example Use Cases

### 6.1 Educational Content Discovery
**Scenario**: Student searching for "binary search algorithm"

**Expected Results**:
1. Video: "Data Structures Lecture 5" (Score: 0.95)
   - Timestamp: 00.12.30-00.18.45
   - Content: Detailed binary search implementation

2. Video: "Algorithm Practice" (Score: 0.87)
   - Timestamp: 00.03.15-00.09.22
   - Content: Step-by-step coding example

### 6.2 Person Recognition
**Scenario**: Finding all appearances of a speaker

**Input**: Photo of Dr. Jane Smith

**Expected Results**:
1. Video: "Keynote Day 1" (Score: 0.94)
   - Timestamp: 00.00.00-00.45.30
   - Context: Opening presentation

2. Video: "Panel Discussion" (Score: 0.91)
   - Timestamp: 00.15.20-00.18.45
   - Context: Panel participation

### 6.3 Visual Content Matching
**Scenario**: Finding similar lab setups

**Input**: Lab equipment photo

**Expected Results**:
1. Video: "Lab Setup Tutorial" (Score: 0.92)
   - Timestamp: 00.05.45-00.07.20
   - Context: Similar equipment arrangement

## 7. Evaluation Methodology

### 7.1 Performance Metrics
```python
def evaluate_search_accuracy(test_queries, ground_truth):
    """
    Evaluate using standard IR metrics
    """
    metrics = {
        'precision_at_k': [],
        'recall_at_k': [],
        'mean_average_precision': []
    }
    
    for query, expected in test_queries:
        results = perform_search(query)
        
        precision = calculate_precision_at_k(results, expected, k=5)
        recall = calculate_recall_at_k(results, expected, k=5)
        ap = calculate_average_precision(results, expected)
        
        metrics['precision_at_k'].append(precision)
        metrics['recall_at_k'].append(recall)
        metrics['mean_average_precision'].append(ap)
    
    return {
        'MAP': np.mean(metrics['mean_average_precision']),
        'Precision@5': np.mean(metrics['precision_at_k']),
        'Recall@5': np.mean(metrics['recall_at_k'])
    }
```

### 7.2 Cost Analysis
```typescript
async function generateCostAnalysis(projectId: string) {
  const searchHistory = await prisma.searchHistory.findMany({
    where: { projectId }
  });
  
  return {
    totalSearches: searchHistory.length,
    totalTokens: searchHistory.reduce((sum, s) => sum + s.tokenUsage, 0),
    totalCost: searchHistory.reduce((sum, s) => sum + s.cost, 0),
    averageCostPerSearch: totalCost / totalSearches
  };
}
```

## 8. Quality Assurance

### 8.1 Automated Testing
```typescript
describe('Search Functionality', () => {
  test('Text search returns relevant results', async () => {
    const results = await performTextSearch("machine learning", "test-project");
    
    expect(results).toHaveLength(5);
    expect(results[0].score).toBeGreaterThan(0.8);
  });
  
  test('Search history recorded properly', async () => {
    await performTextSearch("test query", "test-project");
    const history = await getSearchHistory("test-project");
    
    expect(history[0].tokenUsage).toBeGreaterThan(0);
  });
});
```

### 8.2 Load Testing
```python
# Load testing with concurrent users
class VideoSearchUser(HttpUser):
    @task(3)
    def perform_text_search(self):
        query = random.choice(['python', 'algorithms', 'data structures'])
        response = self.client.post("/api/search", data={
            'projectName': 'learn-python',
            'query': query,
            'searchType': 'text'
        })
        assert response.status_code == 200
```

## 9. Deployment Architecture

### 9.1 Production Setup
```yaml
# Docker Compose
services:
  nextjs-app:
    build: .
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - QDRANT_BASE_URL=${QDRANT_BASE_URL}
  
  flask-backend:
    build: ./flask
    ports: ["3001:3001"]
    volumes: ["./videos:/app/videos"]
  
  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_DATABASE=rcsquare
```

### 9.2 Monitoring
```typescript
// Performance monitoring
export async function logSearchMetrics(searchData) {
  logger.info('Search completed', {
    searchType: searchData.type,
    resultCount: searchData.resultCount,
    responseTimeMs: searchData.responseTime,
    tokens: searchData.tokenUsage,
    costUSD: searchData.cost
  });
}
```

## 10. Technical Implementation Details

### 10.1 Environment Configuration
```bash
# Required environment variables
OPENAI_API_KEY=your_openai_key
DATABASE_URL=mysql://user:pass@localhost:3306/rcsquare
QDRANT_BASE_URL=https://your-qdrant-instance.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key
```

### 10.2 API Endpoints
- `POST /api/search` - Main search endpoint
- `GET /api/projects/public` - Public project validation
- `GET /api/search-history` - Search history retrieval
- `GET /api/video/{id}` - Video streaming endpoint

## 11. Future Research Directions

### 11.1 Advanced Features
1. **Multi-modal Fusion**: Combining text, visual, and audio analysis
2. **Real-time Processing**: Live video content analysis
3. **Personalization**: User-specific search customization
4. **Cross-lingual Support**: Multi-language content discovery

### 11.2 Scalability Improvements
1. **Microservices Architecture**: Distributed search components
2. **Edge Computing**: Geographically distributed processing
3. **Auto-scaling**: Dynamic resource allocation
4. **Advanced Caching**: Multi-layer result caching

## 12. Conclusion

The RCSquare methodology presents a comprehensive approach to AI-powered video search, combining state-of-the-art NLP, computer vision, and vector database technologies. The system provides researchers and educators with powerful tools for video content discovery while maintaining cost-effectiveness and scalability.

Key contributions:
- **Multi-modal search capabilities** across text, person, and visual content
- **Public access architecture** for unauthenticated content discovery  
- **Comprehensive analytics** with token usage and cost tracking
- **Smart video playback** with automatic timestamp seeking
- **Scalable design** supporting multiple concurrent users

The methodology emphasizes both technical excellence and practical usability, positioning RCSquare as a leading platform for intelligent video content discovery in educational and research contexts.

---

**Keywords**: Video Search, Multi-modal AI, Vector Databases, Content Discovery, Information Retrieval, Computer Vision, Natural Language Processing, Educational Technology

**Citation**: Please cite this methodology when using RCSquare in research publications. 