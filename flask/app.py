from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import yt_dlp
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
from werkzeug.utils import secure_filename
import ffmpeg
from datetime import datetime
import uuid
import requests
import cv2
import numpy as np
from PIL import Image
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration, CLIPProcessor, CLIPModel
from sentence_transformers import SentenceTransformer
import mediapipe as mp
import base64
from io import BytesIO
import hashlib
from qdrant_client import QdrantClient
from qdrant_client.http import models
import time
import threading
import logging
import os
import whisper
from pydub import AudioSegment
import tempfile
from openai import OpenAI

# Suppress MediaPipe warnings and TensorFlow logs
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['GLOG_minloglevel'] = '3'
logging.getLogger('mediapipe').setLevel(logging.ERROR)
logging.getLogger('tensorflow').setLevel(logging.ERROR)

# Create a Flask app instance
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'webm'}
SECURITY_KEY = "123_RAGISACTIVATED_321"
NEXTJS_API_BASE = "http://localhost:3000/api"

# OpenAI Configuration (optional - for text refinement)
# Set your OpenAI API key in environment variable: OPENAI_API_KEY
openai_client = None
try:
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if openai_api_key and openai_api_key.strip() and openai_api_key != "your-openai-api-key-here":
        openai_client = OpenAI(api_key=openai_api_key)
        print("✅ OpenAI client initialized for text refinement")
    else:
        print("⚠️ OpenAI API key not found - text refinement will be skipped")
        print("   Set OPENAI_API_KEY in your .env file to enable LLM text refinement")
except Exception as e:
    print(f"❌ OpenAI client initialization failed: {e}")
    print("   Text refinement will be disabled")

# AI Models Configuration
# Initialize models as None - they will be loaded on demand
print("AI models will be loaded on demand to speed up startup...")
clip_model = clip_processor = caption_processor = caption_model = sentence_model = whisper_model = None
models_loaded = False
transcription_models_loaded = False

def load_ai_models():
    """Load AI models with progress feedback"""
    global clip_model, clip_processor, caption_processor, caption_model, sentence_model, models_loaded
    
    if models_loaded:
        print("   ✅ Models already loaded!")
        return True
    
    try:
        print("   📥 [1/3] Loading CLIP model (image embeddings)...")
        import time
        start_time = time.time()
        clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        elapsed = time.time() - start_time
        print(f"   ✅ CLIP loaded in {elapsed:.1f}s")
        
        print("   📥 [2/3] Loading BLIP model (image captioning)...")
        start_time = time.time()
        caption_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        caption_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        elapsed = time.time() - start_time
        print(f"   ✅ BLIP loaded in {elapsed:.1f}s")
        
        print("   📥 [3/3] Loading sentence transformer (text embeddings)...")
        start_time = time.time()
        sentence_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        elapsed = time.time() - start_time
        print(f"   ✅ Sentence transformer loaded in {elapsed:.1f}s")
        
        models_loaded = True
        print("   🎉 All AI models loaded successfully!")
        return True
        
    except ImportError as e:
        print(f"   ❌ Missing dependencies: {e}")
        print("   💡 Try: pip install transformers sentence-transformers")
        return False
    except Exception as e:
        print(f"   ❌ Error loading AI models: {e}")
        print("   🌐 Check your internet connection")
        print("   💾 Models will be cached after first download")
        return False

def load_transcription_models():
    """Load transcription models with progress feedback"""
    global whisper_model, transcription_models_loaded
    
    if transcription_models_loaded:
        print("   ✅ Transcription models already loaded!")
        return True
    
    try:
        print("   📥 Loading Whisper model (audio transcription)...")
        import time
        start_time = time.time()
        whisper_model = whisper.load_model("base")
        elapsed = time.time() - start_time
        print(f"   ✅ Whisper loaded in {elapsed:.1f}s")
        
        transcription_models_loaded = True
        print("   🎉 Transcription models loaded successfully!")
        return True
        
    except ImportError as e:
        print(f"   ❌ Missing dependencies: {e}")
        print("   💡 Try: pip install openai-whisper")
        return False
    except Exception as e:
        print(f"   ❌ Error loading transcription models: {e}")
        print("   🌐 Check your internet connection")
        print("   💾 Models will be cached after first download")
        return False

# Qdrant configuration
QDRANT_URL = "https://2ad10262-46e6-4989-b11b-f887cf715954.us-east4-0.gcp.cloud.qdrant.io:6333"
QDRANT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.iaTMvQ8-8mfYoiKLu4FNmbtedDihnjgwFZZ3h2WvpTA"

try:
    qdrant_client = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY,
    )
    print("Qdrant client initialized successfully!")
except Exception as e:
    print(f"Error initializing Qdrant client: {e}")
    qdrant_client = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_project_folder(project_name):
    """Create project folder structure"""
    project_path = os.path.join(project_name)
    videos_path = os.path.join(project_path, 'videos')
    
    os.makedirs(videos_path, exist_ok=True)
    return project_path, videos_path

def compress_video(input_path, output_path):
    """Compress video to 480p"""
    try:
        print(f"Compressing video: {input_path} -> {output_path}")
        
        # Check if input file exists
        if not os.path.exists(input_path):
            print(f"Input file does not exist: {input_path}")
            return False
        
        # Create output directory if it doesn't exist
        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)
        
        # Run FFmpeg compression
        (
            ffmpeg
            .input(input_path)
            .filter('scale', -1, 480)
            .output(output_path, vcodec='libx264', acodec='aac', crf=28, preset='fast')
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        
        # Check if output file was created
        if os.path.exists(output_path):
            print(f"Video compressed successfully: {output_path}")
            return True
        else:
            print("Output file was not created")
            return False
            
    except ffmpeg.Error as e:
        print(f"FFmpeg error: {e}")
        print(f"FFmpeg stderr: {e.stderr.decode() if e.stderr else 'No stderr'}")
        return False
    except Exception as e:
        print(f"Unexpected error compressing video: {e}")
        return False

def save_metadata(metadata_path, title, description, tags, created_at, updated_at):
    """Save video metadata to text file"""
    metadata = {
        "title": title,
        "description": description,
        "tags": tags,
        "created_at": created_at,
        "updated_at": updated_at
    }
    
    with open(metadata_path, 'w', encoding='utf-8') as f:
        for key, value in metadata.items():
            f.write(f"{key}: {value}\n")

def extract_frames(video_path, output_dir, sampling_interval=5):
    """Extract frames from video at specified intervals"""
    frames = []
    
    try:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_interval = int(fps * sampling_interval)
        
        frame_count = 0
        extracted_count = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_count % frame_interval == 0:
                # Convert timestamp to HH.MM.SS format
                timestamp_seconds = frame_count / fps
                hours = int(timestamp_seconds // 3600)
                minutes = int((timestamp_seconds % 3600) // 60)
                seconds = int(timestamp_seconds % 60)
                timestamp = f"{hours:02d}.{minutes:02d}.{seconds:02d}"
                
                # Save frame as image
                frame_filename = f"frame_{extracted_count}_{timestamp.replace('.', '_')}.jpg"
                frame_path = os.path.join(output_dir, frame_filename)
                
                cv2.imwrite(frame_path, frame)
                
                # Extract video_id from output_dir
                video_id = os.path.basename(output_dir)
                
                frames.append({
                    'timestamp': timestamp,
                    'image_path': frame_path,
                    'image_link': f"/frames/{video_id}/{frame_filename}"
                })
                extracted_count += 1
            
            frame_count += 1
        
        cap.release()
        return frames
        
    except Exception as e:
        print(f"Error extracting frames: {e}")
        return []

def generate_clip_embedding(image_path):
    """Generate CLIP embedding for an image"""
    try:
        if not clip_model or not clip_processor:
            return None
            
        image = Image.open(image_path).convert('RGB')
        inputs = clip_processor(images=image, return_tensors="pt")
        
        with torch.no_grad():
            image_features = clip_model.get_image_features(**inputs)
            embedding = image_features.cpu().numpy().flatten().tolist()
            
        return embedding
    except Exception as e:
        print(f"Error generating CLIP embedding: {e}")
        return None

def generate_caption(image_path):
    """Generate caption for an image using BLIP"""
    try:
        if not caption_model or not caption_processor:
            return None
            
        image = Image.open(image_path).convert('RGB')
        inputs = caption_processor(image, return_tensors="pt")
        
        with torch.no_grad():
            out = caption_model.generate(**inputs, max_length=50, num_beams=5)
            caption = caption_processor.decode(out[0], skip_special_tokens=True)
            
        return caption
    except Exception as e:
        print(f"Error generating caption: {e}")
        return None

def generate_caption_embedding(caption):
    """Generate embedding for a caption using sentence transformer"""
    try:
        if not sentence_model:
            return None
            
        embedding = sentence_model.encode(caption).tolist()
        return embedding
    except Exception as e:
        print(f"Error generating caption embedding: {e}")
        return None

# Global MediaPipe face detection instance to reuse
_face_detection = None

def get_face_detection():
    """Get or create MediaPipe face detection instance"""
    global _face_detection
    if _face_detection is None:
        mp_face_detection = mp.solutions.face_detection
        _face_detection = mp_face_detection.FaceDetection(
            model_selection=0, 
            min_detection_confidence=0.5
        )
    return _face_detection

def detect_persons(image_path):
    """Detect and identify persons in an image using MediaPipe"""
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            print(f"Could not load image: {image_path}")
            return []
        
        # Convert BGR to RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        persons = []
        # Use shared MediaPipe instance to reduce overhead
        face_detection = get_face_detection()
        
        # Process the image
        results = face_detection.process(image_rgb)
        
        if results.detections:
            for i, detection in enumerate(results.detections):
                # Get bounding box
                bboxC = detection.location_data.relative_bounding_box
                ih, iw, _ = image.shape
                
                # Convert relative coordinates to absolute
                x = int(bboxC.xmin * iw)
                y = int(bboxC.ymin * ih)
                w = int(bboxC.width * iw)
                h = int(bboxC.height * ih)
                
                # Ensure coordinates are within image bounds
                x = max(0, x)
                y = max(0, y)
                w = min(w, iw - x)
                h = min(h, ih - y)
                
                # Skip if face region is too small
                if w < 20 or h < 20:
                    continue
                
                # Extract face region
                face_image = image_rgb[y:y+h, x:x+w]
                
                if face_image.size == 0:
                    continue
                
                # Generate unique person ID based on face image characteristics
                # Use image hash for consistent person identification
                face_hash = hashlib.md5(face_image.tobytes()).hexdigest()[:16]
                person_uid = f"person_{face_hash}"
                
                # Save face image
                face_filename = f"person_{person_uid}_{i}.jpg"
                face_dir = os.path.dirname(image_path)
                face_path = os.path.join(face_dir, face_filename)
                
                # Convert back to PIL Image and save
                face_image_pil = Image.fromarray(face_image)
                face_image_pil.save(face_path)
                
                # Generate CLIP embedding for the face
                clip_embedding = generate_clip_embedding(face_path)
                
                # Extract video_id from the path structure
                path_parts = image_path.split('/')
                video_id = "unknown"
                for part in path_parts:
                    if 'frames' in part and len(path_parts) > path_parts.index(part) + 1:
                        video_id = path_parts[path_parts.index(part) + 1]
                        break
                
                persons.append({
                    'person_uid': person_uid,
                    'image_link': f"/faces/{video_id}/{face_filename}",
                    'clip_embedding': clip_embedding
                })
        
        return persons
    except Exception as e:
        print(f"Error detecting persons in {image_path}: {e}")
        return []

def create_qdrant_collection(collection_name, vector_size=512):
    """Create a Qdrant collection if it doesn't exist"""
    try:
        if not qdrant_client:
            return False
            
        collections = qdrant_client.get_collections().collections
        collection_names = [col.name for col in collections]
        
        if collection_name not in collection_names:
            qdrant_client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE
                )
            )
            print(f"Created Qdrant collection: {collection_name}")
        
        return True
    except Exception as e:
        print(f"Error creating Qdrant collection {collection_name}: {e}")
        return False

def store_vector_data(collection_name, vectors_data):
    """Store vector data in Qdrant"""
    try:
        if not qdrant_client:
            return False
            
        points = []
        for i, data in enumerate(vectors_data):
            point = models.PointStruct(
                id=i,
                vector=data['embedding'],
                payload=data['payload']
            )
            points.append(point)
        
        qdrant_client.upsert(
            collection_name=collection_name,
            points=points
        )
        
        return True
    except Exception as e:
        print(f"Error storing vector data in {collection_name}: {e}")
        return False

def extract_audio_from_video(video_path, output_audio_path):
    """Extract audio from video file"""
    try:
        print(f"🎵 Extracting audio from: {video_path}")
        
        # Use pydub to extract audio
        video = AudioSegment.from_file(video_path)
        video.export(output_audio_path, format="wav")
        
        if os.path.exists(output_audio_path):
            print(f"✅ Audio extracted to: {output_audio_path}")
            return True
        else:
            print("❌ Audio extraction failed")
            return False
            
    except Exception as e:
        print(f"❌ Error extracting audio: {e}")
        return False

def seconds_to_timestamp(seconds):
    """Convert seconds to HH.MM.SS format"""
    if seconds is None:
        return "00.00.00"
    
    try:
        seconds = float(seconds)
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}.{minutes:02d}.{secs:02d}"
    except (ValueError, TypeError):
        return "00.00.00"

def transcribe_audio_with_whisper(audio_path):
    """Transcribe audio using Whisper model"""
    try:
        if not whisper_model:
            print("❌ Whisper model not loaded")
            return None
            
        print(f"🎤 Transcribing audio with Whisper...")
        result = whisper_model.transcribe(audio_path)
        
        segments = []
        for i, segment in enumerate(result["segments"]):
            # Convert timestamps to our format
            start_timestamp = seconds_to_timestamp(segment["start"])
            end_timestamp = seconds_to_timestamp(segment["end"])
            
            # Convert log probability to confidence score (0-1 range)
            # avg_logprob is typically between -3.0 (low confidence) and -0.1 (high confidence)
            avg_logprob = segment.get("avg_logprob", -1.0)
            # Normalize to 0-1 range: higher (less negative) logprob = higher confidence
            confidence = max(0.0, min(1.0, (avg_logprob + 3.0) / 3.0))
            
            segments.append({
                "segment_index": i,
                "starting_timestamp": start_timestamp,
                "ending_timestamp": end_timestamp,
                "start_seconds": segment["start"],
                "end_seconds": segment["end"],
                "transcription": segment["text"].strip(),
                "confidence": confidence
            })
        
        # Calculate total duration from segments (use the end time of the last segment)
        total_duration = segments[-1]["end_seconds"] if segments else 0.0
        
        transcription_data = {
            "language": result.get("language", "unknown"),
            "total_duration": total_duration,
            "segments": segments
        }
        
        print(f"✅ Transcribed {len(segments)} segments")
        return transcription_data
        
    except Exception as e:
        print(f"❌ Error transcribing audio: {e}")
        return None

def refine_text_with_llm(text):
    """Refine transcription text using OpenAI LLM"""
    try:
        if not openai_client:
            print("⚠️ OpenAI client not available - skipping text refinement")
            return text
        
        # Create a prompt for text refinement
        prompt = f"""Please refine and improve the following transcribed text while preserving its original meaning and tone. 
Fix any grammar errors, spelling mistakes, and improve clarity while maintaining the speaker's intended message.

Original text: "{text}"

Refined text:"""
        
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that improves transcribed text quality while preserving the original meaning and tone."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.3
        )
        
        refined_text = response.choices[0].message.content.strip()
        
        # Remove quotes if they were added
        if refined_text.startswith('"') and refined_text.endswith('"'):
            refined_text = refined_text[1:-1]
        
        return refined_text
        
    except Exception as e:
        print(f"⚠️ Error refining text with LLM: {e}")
        return text  # Return original text if refinement fails

@app.route('/')
def hello_world():
    return '<h1>RCSquare Flask Backend</h1><p>Server is running! ✅</p>'

@app.route('/api/ai-status', methods=['GET'])
def ai_status():
    """Check AI models status"""
    return jsonify({
        'models_loaded': models_loaded,
        'transcription_models_loaded': transcription_models_loaded,
        'clip_available': clip_model is not None,
        'blip_available': caption_model is not None,
        'sentence_transformer_available': sentence_model is not None,
        'whisper_available': whisper_model is not None,
        'openai_available': openai_client is not None
    })

@app.route('/api/load-models', methods=['POST'])
def load_models_endpoint():
    """Manually trigger AI model loading"""
    success = load_ai_models()
    return jsonify({
        'success': success,
        'models_loaded': models_loaded,
        'message': 'Models loaded successfully' if success else 'Failed to load models'
    })

@app.route('/api/load-transcription-models', methods=['POST'])
def load_transcription_models_endpoint():
    """Manually trigger transcription model loading"""
    success = load_transcription_models()
    return jsonify({
        'success': success,
        'transcription_models_loaded': transcription_models_loaded,
        'message': 'Transcription models loaded successfully' if success else 'Failed to load transcription models'
    })

def create_video_record(project_name, title, description, tags, filename, original_url=None, file_size=None, duration=None):
    """Create video record in database via NextJS API"""
    try:
        response = requests.post(f"{NEXTJS_API_BASE}/videos", 
            json={
                'projectName': project_name,
                'title': title,
                'description': description,
                'tags': tags,
                'filename': filename,
                'originalUrl': original_url,
                'fileSize': file_size,
                'duration': duration
            },
            headers={'x-security-key': SECURITY_KEY}
        )
        return response.json() if response.status_code == 200 else None
    except Exception as e:
        print(f"Failed to create video record: {e}")
        return None

@app.route('/api/validate-project', methods=['POST'])
def validate_project():
    """Validate project name and security key via NextJS API"""
    data = request.get_json()
    
    if not data or 'projectName' not in data or 'securityKey' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        # Forward to NextJS API
        response = requests.post(f"{NEXTJS_API_BASE}/projects", json=data)
        
        if response.status_code == 200:
            result = response.json()
            project_name = data['projectName']
            # Create project folder if it doesn't exist
            project_path, videos_path = create_project_folder(project_name)
            return jsonify(result)
        else:
            return jsonify(response.json()), response.status_code
            
    except Exception as e:
        return jsonify({'error': f'Failed to validate project: {str(e)}'}), 500

@app.route('/api/download-youtube', methods=['POST'])
def download_youtube():
    """Download YouTube video and save with metadata"""
    data = request.get_json()
    
    if not data or 'url' not in data or 'projectName' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    url = data['url']
    project_name = data['projectName']
    title = data.get('title', '')
    description = data.get('description', '')
    tags = data.get('tags', '')
    
    try:
        project_path, videos_path = create_project_folder(project_name)
        
        # Generate unique filename
        video_id = str(uuid.uuid4())[:8]
        
        # Download with yt-dlp
        ydl_opts = {
            'format': 'best[ext=mp4]/best[ext=webm]/best/worst',
            'outtmpl': os.path.join(videos_path, f'{video_id}_original.%(ext)s'),
            'noplaylist': True,
            'extractaudio': False,
            'ignoreerrors': False,
            # Anti-bot detection measures
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            # Additional options for better compatibility
            'extract_flat': False,
            'writethumbnail': False,
            'writeinfojson': False,
            'no_warnings': False,
            'sleep_interval': 1,
            'max_sleep_interval': 5,
        }
        
        # Try downloading with primary options first
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                original_filename = ydl.prepare_filename(info)
                
                # If no metadata provided, extract from video info
                if not title:
                    title = info.get('title', 'Unknown Title')
                if not description:
                    description = info.get('description', '')
                if not tags:
                    tags = ', '.join(info.get('tags', []))
        except Exception as primary_error:
            print(f"Primary download failed: {primary_error}")
            
            # Fallback: Try with more conservative settings
            fallback_opts = {
                'format': 'worst/best',
                'outtmpl': os.path.join(videos_path, f'{video_id}_original.%(ext)s'),
                'noplaylist': True,
                'extractaudio': False,
                'ignoreerrors': True,
                'no_warnings': True,
                'quiet': True,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'sleep_interval': 2,
                'max_sleep_interval': 10,
            }
            
            try:
                print("Trying fallback download with conservative settings...")
                with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    original_filename = ydl.prepare_filename(info)
                    
                    # If no metadata provided, extract from video info
                    if not title:
                        title = info.get('title', 'Unknown Title')
                    if not description:
                        description = info.get('description', '')
                    if not tags:
                        tags = ', '.join(info.get('tags', []))
            except Exception as fallback_error:
                print(f"Fallback download also failed: {fallback_error}")
                return jsonify({'error': f'Download failed: {str(fallback_error)}. YouTube may be blocking downloads. Try again later or use a different video.'}), 500
        
        print(f"Downloaded video: {original_filename}")
        
        # Check if the download was successful
        if not os.path.exists(original_filename):
            return jsonify({'error': f'Download failed - file not found: {original_filename}'}), 500
        
        # Comment out video compression
        # # Compress video to 480p
        # compressed_filename = f'{video_id}.mp4'
        # compressed_path = os.path.join(videos_path, compressed_filename)
        # 
        # print(f"Attempting to compress: {original_filename} -> {compressed_path}")
        # 
        # if compress_video(original_filename, compressed_path):
        #     # Remove original file to save space
        #     if os.path.exists(original_filename):
        #         os.remove(original_filename)
        #         print(f"Removed original file: {original_filename}")
        #     
        #     # Save metadata
        #     metadata_filename = f'{video_id}_context.txt'
        #     metadata_path = os.path.join(videos_path, metadata_filename)
        #     
        #     now = datetime.now().isoformat()
        #     save_metadata(metadata_path, title, description, tags, now, now)
        #     
        #     # Create video record in database
        #     file_size = os.path.getsize(compressed_path) if os.path.exists(compressed_path) else None
        #     video_record = create_video_record(
        #         project_name, title, description, tags, 
        #         compressed_filename, url, file_size
        #     )
        #     
        #     return jsonify({
        #         'success': True,
        #         'message': 'Video downloaded and processed successfully',
        #         'filename': compressed_filename,
        #         'metadata': metadata_filename,
        #         'video': video_record
        #     })
        # else:
        #     # Clean up original file if compression failed
        #     if os.path.exists(original_filename):
        #         os.remove(original_filename)
        #     return jsonify({'error': 'Failed to compress video. Please check if FFmpeg is installed correctly.'}), 500
        
        # Use original file without compression
        final_filename = f'{video_id}.{original_filename.split(".")[-1]}'
        final_path = os.path.join(videos_path, final_filename)
        
        # Rename original file to final filename
        os.rename(original_filename, final_path)
        print(f"Renamed file: {original_filename} -> {final_path}")
        
        # Save metadata
        metadata_filename = f'{video_id}_context.txt'
        metadata_path = os.path.join(videos_path, metadata_filename)
        
        now = datetime.now().isoformat()
        save_metadata(metadata_path, title, description, tags, now, now)
        
        # Create video record in database
        file_size = os.path.getsize(final_path) if os.path.exists(final_path) else None
        video_record = create_video_record(
            project_name, title, description, tags, 
            final_filename, url, file_size
        )
        
        return jsonify({
            'success': True,
            'message': 'Video downloaded successfully',  # Updated message
            'filename': final_filename,
            'metadata': metadata_filename,
            'video': video_record
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to download video: {str(e)}'}), 500

@app.route('/api/upload-video', methods=['POST'])
def upload_video():
    """Upload and process video file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    project_name = request.form.get('projectName')
    title = request.form.get('title', '')
    description = request.form.get('description', '')
    tags = request.form.get('tags', '')
    
    if not project_name:
        return jsonify({'error': 'Project name is required'}), 400
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    try:
        project_path, videos_path = create_project_folder(project_name)
        
        # Generate unique filename
        video_id = str(uuid.uuid4())[:8]
        original_filename = secure_filename(file.filename)
        temp_path = os.path.join(videos_path, f'{video_id}_temp_{original_filename}')
        
        # Save uploaded file temporarily
        file.save(temp_path)
        print(f"Uploaded file saved to: {temp_path}")
        
        # Check if file was saved successfully
        if not os.path.exists(temp_path):
            return jsonify({'error': 'Failed to save uploaded file'}), 500
        
        # Comment out video compression
        # # Compress video to 480p
        # compressed_filename = f'{video_id}.mp4'
        # compressed_path = os.path.join(videos_path, compressed_filename)
        # 
        # print(f"Attempting to compress: {temp_path} -> {compressed_path}")
        # 
        # if compress_video(temp_path, compressed_path):
        #     # Remove temporary file
        #     os.remove(temp_path)
        #     print(f"Removed temporary file: {temp_path}")
        #     
        #     # Save metadata
        #     metadata_filename = f'{video_id}_context.txt'
        #     metadata_path = os.path.join(videos_path, metadata_filename)
        #     
        #     now = datetime.now().isoformat()
        #     save_metadata(metadata_path, title or original_filename, description, tags, now, now)
        #     
        #     # Create video record in database
        #     file_size = os.path.getsize(compressed_path) if os.path.exists(compressed_path) else None
        #     video_record = create_video_record(
        #         project_name, title or original_filename, description, tags, 
        #         compressed_filename, None, file_size
        #     )
        #     
        #     return jsonify({
        #         'success': True,
        #         'message': 'Video uploaded and processed successfully',
        #         'filename': compressed_filename,
        #         'metadata': metadata_filename,
        #         'video': video_record
        #     })
        # else:
        #     # Clean up on failure
        #     if os.path.exists(temp_path):
        #         os.remove(temp_path)
        #     return jsonify({'error': 'Failed to compress video. Please check if FFmpeg is installed correctly.'}), 500
        
        # Use original file without compression
        final_filename = f'{video_id}.{original_filename.split(".")[-1]}'
        final_path = os.path.join(videos_path, final_filename)
        
        # Rename temp file to final filename
        os.rename(temp_path, final_path)
        print(f"Renamed file: {temp_path} -> {final_path}")
        
        # Save metadata
        metadata_filename = f'{video_id}_context.txt'
        metadata_path = os.path.join(videos_path, metadata_filename)
        
        now = datetime.now().isoformat()
        save_metadata(metadata_path, title or original_filename, description, tags, now, now)
        
        # Create video record in database
        file_size = os.path.getsize(final_path) if os.path.exists(final_path) else None
        video_record = create_video_record(
            project_name, title or original_filename, description, tags, 
            final_filename, None, file_size
        )
        
        return jsonify({
            'success': True,
            'message': 'Video uploaded successfully',  # Updated message
            'filename': final_filename,
            'metadata': metadata_filename,
            'video': video_record
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to upload video: {str(e)}'}), 500

@app.route('/api/list-videos/<project_name>', methods=['GET'])
def list_videos(project_name):
    """List all videos in a project from database"""
    security_key = request.headers.get('X-Security-Key')
    
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        # Get videos from database via NextJS API
        response = requests.get(f"{NEXTJS_API_BASE}/projects?name={project_name}",
            headers={'x-security-key': SECURITY_KEY}
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': f'Failed to list videos: {str(e)}'}), 500

@app.route('/api/video/<video_id>', methods=['GET'])
def serve_video(video_id):
    """Serve video file"""
    try:
        project_name = request.args.get('project')
        if not project_name:
            return jsonify({'error': 'Project name required'}), 400
        
        # Get the actual filename from the database via NextJS API
        try:
            response = requests.get(f"{NEXTJS_API_BASE}/projects?name={project_name}",
                headers={'x-security-key': SECURITY_KEY}
            )
            
            if response.status_code != 200:
                return jsonify({'error': 'Failed to get project data'}), 404
                
            project_data = response.json()
            videos = project_data.get('project', {}).get('videos', [])
            
            # Find the video by matching the video_id with the database ID or filename
            target_video = None
            for video in videos:
                db_video_id = video.get('id', '')
                filename = video.get('filename', '')
                file_video_id = filename.split('.')[0] if '.' in filename else filename
                
                # Check if video_id matches:
                # 1. The first 8 characters of the database video ID
                # 2. The full database video ID 
                # 3. The filename (without extension)
                if (db_video_id.startswith(video_id) or 
                    db_video_id == video_id or 
                    file_video_id == video_id):
                    target_video = video
                    break
            
            if not target_video:
                return jsonify({'error': 'Video not found in database'}), 404
                
            actual_filename = target_video['filename']
            
        except Exception as e:
            print(f"Database lookup failed: {e}")
            # Fallback to looking for .mp4 file
            actual_filename = f'{video_id}.mp4'
        
        video_path = os.path.join(project_name, 'videos', actual_filename)
        
        if not os.path.exists(video_path):
            return jsonify({'error': 'Video file not found'}), 404
        
        return send_file(video_path, mimetype='video/mp4')
        
    except Exception as e:
        return jsonify({'error': f'Failed to serve video: {str(e)}'}), 500

@app.route('/api/extract-frames', methods=['POST'])
def extract_frames_api():
    """Extract frames, generate captions, and detect persons from video"""
    data = request.get_json()
    
    if not data or 'videoId' not in data or 'projectName' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    video_id = data['videoId']
    project_name = data['projectName']
    frame_sampling = data.get('frameSampling', 5)  # Default 5 seconds
    
    security_key = request.headers.get('X-Security-Key')
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        # Create frame analysis record in database
        analysis_response = requests.post(f"{NEXTJS_API_BASE}/frame-analysis", 
            json={
                'videoId': video_id,
                'frameSampling': frame_sampling,
                'status': 'processing'
            },
            headers={'x-security-key': SECURITY_KEY}
        )
        
        if analysis_response.status_code != 200:
            return jsonify({'error': 'Failed to create frame analysis record'}), 500
        
        analysis_data = analysis_response.json()
        analysis_id = analysis_data['analysis']['id']
        
        # Process frames in background thread
        def process_video_frames():
            try:
                print(f"🚀 Starting frame processing for video {video_id}")
                
                # Load AI models if not already loaded
                if not load_ai_models():
                    raise Exception("Failed to load AI models")
                
                print(f"✅ AI models ready")
                
                # Find video file
                video_filename = None
                project_response = requests.get(f"{NEXTJS_API_BASE}/projects?name={project_name}",
                    headers={'x-security-key': SECURITY_KEY}
                )
                
                if project_response.status_code == 200:
                    project_data = project_response.json()
                    videos = project_data.get('project', {}).get('videos', [])
                    
                    for video in videos:
                        if video['id'] == video_id:
                            video_filename = video['filename']
                            break
                
                if not video_filename:
                    raise Exception("Video not found in database")
                
                video_path = os.path.join(project_name, 'videos', video_filename)
                if not os.path.exists(video_path):
                    raise Exception(f"Video file not found: {video_path}")
                
                print(f"📁 Processing video: {video_filename}")
                
                # Create directories for extracted content
                frames_dir = os.path.join(project_name, 'frames', video_id)
                faces_dir = os.path.join(project_name, 'faces', video_id)
                os.makedirs(frames_dir, exist_ok=True)
                os.makedirs(faces_dir, exist_ok=True)
                
                # Extract frames
                print(f"🎬 Extracting frames (every {frame_sampling} seconds)...")
                frames = extract_frames(video_path, frames_dir, frame_sampling)
                
                if not frames:
                    raise Exception("No frames could be extracted from video")
                
                print(f"📸 Extracted {len(frames)} frames")
                
                # Process each frame
                frame_data = []
                caption_data = []
                person_data = []
                
                frame_vectors = []
                caption_vectors = []
                person_vectors = []
                
                total_frames = len(frames)
                
                for i, frame_info in enumerate(frames):
                    timestamp = frame_info['timestamp']
                    image_path = frame_info['image_path']
                    image_link = frame_info['image_link']
                    
                    print(f"⚡ Processing frame {i+1}/{total_frames} at {timestamp}...")
                    
                    # Generate CLIP embedding for frame
                    clip_embedding = generate_clip_embedding(image_path)
                    if clip_embedding:
                        frame_data.append({
                            'analysisId': analysis_id,
                            'timestamp': timestamp,
                            'imageLink': image_link,
                            'clipEmbedding': json.dumps(clip_embedding)
                        })
                        
                        frame_vectors.append({
                            'embedding': clip_embedding,
                            'payload': {
                                'video_id': video_id,
                                'timestamp': timestamp,
                                'image_link': image_link,
                                'type': 'frame'
                            }
                        })
                    
                    # Generate caption
                    caption = generate_caption(image_path)
                    if caption:
                        caption_embedding = generate_caption_embedding(caption)
                        if caption_embedding:
                            caption_data.append({
                                'analysisId': analysis_id,
                                'timestamp': timestamp,
                                'imageLink': image_link,
                                'caption': caption,
                                'captionEmbedding': json.dumps(caption_embedding)
                            })
                            
                            caption_vectors.append({
                                'embedding': caption_embedding,
                                'payload': {
                                    'video_id': video_id,
                                    'timestamp': timestamp,
                                    'image_link': image_link,
                                    'caption': caption,
                                    'type': 'caption'
                                }
                            })
                    
                    # Detect persons
                    persons = detect_persons(image_path)
                    for person in persons:
                        person_uid = person['person_uid']
                        person_image_link = person['image_link']
                        person_embedding = person['clip_embedding']
                        
                        if person_embedding:
                            person_data.append({
                                'analysisId': analysis_id,
                                'timestamp': timestamp,
                                'imageLink': person_image_link,
                                'personUid': person_uid,
                                'clipEmbedding': json.dumps(person_embedding)
                            })
                            
                            person_vectors.append({
                                'embedding': person_embedding,
                                'payload': {
                                    'video_id': video_id,
                                    'timestamp': timestamp,
                                    'image_link': person_image_link,
                                    'person_uid': person_uid,
                                    'type': 'person'
                                }
                            })
                
                print(f"💾 Storing data in database...")
                
                # Store data in database
                stored_counts = {'frames': 0, 'captions': 0, 'persons': 0}
                
                if frame_data:
                    response = requests.post(f"{NEXTJS_API_BASE}/frames", 
                        json={'frames': frame_data},
                        headers={'x-security-key': SECURITY_KEY}
                    )
                    if response.status_code == 200:
                        stored_counts['frames'] = len(frame_data)
                        print(f"  ✅ Stored {len(frame_data)} frames")
                    else:
                        print(f"  ❌ Failed to store frames: {response.status_code}")
                
                if caption_data:
                    response = requests.post(f"{NEXTJS_API_BASE}/captions", 
                        json={'captions': caption_data},
                        headers={'x-security-key': SECURITY_KEY}
                    )
                    if response.status_code == 200:
                        stored_counts['captions'] = len(caption_data)
                        print(f"  ✅ Stored {len(caption_data)} captions")
                    else:
                        print(f"  ❌ Failed to store captions: {response.status_code}")
                
                if person_data:
                    response = requests.post(f"{NEXTJS_API_BASE}/persons", 
                        json={'persons': person_data},
                        headers={'x-security-key': SECURITY_KEY}
                    )
                    if response.status_code == 200:
                        stored_counts['persons'] = len(person_data)
                        print(f"  ✅ Stored {len(person_data)} person detections")
                    else:
                        print(f"  ❌ Failed to store persons: {response.status_code}")
                
                print(f"🔍 Storing vectors in Qdrant...")
                
                # Store vectors in Qdrant
                if frame_vectors:
                    collection_name = f"{project_name}_frames"
                    if create_qdrant_collection(collection_name, 512):  # CLIP embedding size
                        if store_vector_data(collection_name, frame_vectors):
                            print(f"  ✅ Stored {len(frame_vectors)} frame vectors")
                        else:
                            print(f"  ❌ Failed to store frame vectors")
                    else:
                        print(f"  ❌ Failed to create frames collection")
                
                if caption_vectors:
                    collection_name = f"{project_name}_captions"
                    if create_qdrant_collection(collection_name, 384):  # MiniLM embedding size
                        if store_vector_data(collection_name, caption_vectors):
                            print(f"  ✅ Stored {len(caption_vectors)} caption vectors")
                        else:
                            print(f"  ❌ Failed to store caption vectors")
                    else:
                        print(f"  ❌ Failed to create captions collection")
                
                if person_vectors:
                    collection_name = f"{project_name}_persons"
                    if create_qdrant_collection(collection_name, 512):  # CLIP embedding size
                        if store_vector_data(collection_name, person_vectors):
                            print(f"  ✅ Stored {len(person_vectors)} person vectors")
                        else:
                            print(f"  ❌ Failed to store person vectors")
                    else:
                        print(f"  ❌ Failed to create persons collection")
                
                # Update analysis status
                print(f"📊 Finalizing analysis...")
                response = requests.put(f"{NEXTJS_API_BASE}/frame-analysis", 
                    json={
                        'id': analysis_id,
                        'status': 'completed',
                        'totalFrames': len(frames),
                        'processedAt': datetime.now().isoformat()
                    },
                    headers={'x-security-key': SECURITY_KEY}
                )
                
                if response.status_code == 200:
                    print(f"🎉 Frame extraction completed successfully for video {video_id}")
                    print(f"   📊 Summary: {stored_counts['frames']} frames, {stored_counts['captions']} captions, {stored_counts['persons']} persons")
                else:
                    print(f"⚠️  Analysis completed but failed to update status: {response.status_code}")
                
            except Exception as e:
                print(f"❌ Error processing frames for video {video_id}: {e}")
                print(f"   Error type: {type(e).__name__}")
                
                # Update analysis status to failed
                try:
                    requests.put(f"{NEXTJS_API_BASE}/frame-analysis", 
                        json={
                            'id': analysis_id,
                            'status': 'failed',
                            'errorMessage': str(e)
                        },
                        headers={'x-security-key': SECURITY_KEY}
                    )
                    print(f"🔄 Updated analysis status to failed")
                except Exception as update_error:
                    print(f"❌ Failed to update analysis status: {update_error}")
        
        # Start background processing
        thread = threading.Thread(target=process_video_frames)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Frame extraction started',
            'analysisId': analysis_id
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to start frame extraction: {str(e)}'}), 500

@app.route('/api/frame-analysis/<analysis_id>', methods=['GET'])
def get_frame_analysis(analysis_id):
    """Get frame analysis status and results"""
    security_key = request.headers.get('X-Security-Key')
    
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        response = requests.get(f"{NEXTJS_API_BASE}/frame-analysis?id={analysis_id}",
            headers={'x-security-key': SECURITY_KEY}
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': f'Failed to get frame analysis: {str(e)}'}), 500

@app.route('/api/transcribe-video', methods=['POST'])
def transcribe_video_api():
    """Transcribe video audio using Whisper and refine with LLM"""
    data = request.get_json()
    
    if not data or 'videoId' not in data or 'projectName' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    video_id = data['videoId']
    project_name = data['projectName']
    model_name = data.get('model', 'whisper-base')
    refine_with_llm = data.get('refineWithLlm', True)
    
    security_key = request.headers.get('X-Security-Key')
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        # Create transcription record in database
        transcription_response = requests.post(f"{NEXTJS_API_BASE}/transcriptions", 
            json={
                'videoId': video_id,
                'model': model_name,
                'status': 'processing'
            },
            headers={'x-security-key': SECURITY_KEY}
        )
        
        if transcription_response.status_code != 200:
            return jsonify({'error': 'Failed to create transcription record'}), 500
        
        transcription_data = transcription_response.json()
        transcription_id = transcription_data['transcription']['id']
        
        # Process transcription in background thread
        def process_video_transcription():
            try:
                print(f"🚀 Starting transcription for video {video_id}")
                
                # Load transcription models if not already loaded
                if not load_transcription_models():
                    raise Exception("Failed to load transcription models")
                
                print(f"✅ Transcription models ready")
                
                # Find video file
                video_filename = None
                project_response = requests.get(f"{NEXTJS_API_BASE}/projects?name={project_name}",
                    headers={'x-security-key': SECURITY_KEY}
                )
                
                if project_response.status_code == 200:
                    project_data = project_response.json()
                    videos = project_data.get('project', {}).get('videos', [])
                    
                    for video in videos:
                        if video['id'] == video_id:
                            video_filename = video['filename']
                            break
                
                if not video_filename:
                    raise Exception("Video not found in database")
                
                video_path = os.path.join(project_name, 'videos', video_filename)
                if not os.path.exists(video_path):
                    raise Exception(f"Video file not found: {video_path}")
                
                print(f"📁 Processing video: {video_filename}")
                
                # Create temporary audio file
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                    temp_audio_path = temp_audio.name
                
                try:
                    # Extract audio from video
                    if not extract_audio_from_video(video_path, temp_audio_path):
                        raise Exception("Failed to extract audio from video")
                    
                    # Transcribe audio with Whisper
                    print(f"🎤 Transcribing audio...")
                    transcription_result = transcribe_audio_with_whisper(temp_audio_path)
                    
                    if not transcription_result:
                        raise Exception("Failed to transcribe audio")
                    
                    segments = transcription_result['segments']
                    language = transcription_result['language']
                    total_duration = transcription_result['total_duration']
                    
                    print(f"✅ Transcribed {len(segments)} segments in {language}")
                    
                    # Refine transcriptions with LLM if requested
                    if refine_with_llm and openai_client:
                        print(f"🔍 Refining transcriptions with LLM...")
                        
                        for segment in segments:
                            original_text = segment['transcription']
                            refined_text = refine_text_with_llm(original_text)
                            segment['refined_transcription'] = refined_text
                            
                            # Add a small delay to avoid rate limiting
                            time.sleep(0.1)
                    
                    # Prepare data for database
                    segment_data = []
                    for segment in segments:
                        segment_data.append({
                            'transcriptionId': transcription_id,
                            'segmentIndex': segment['segment_index'],
                            'startingTimestamp': segment['starting_timestamp'],
                            'endingTimestamp': segment['ending_timestamp'],
                            'startSeconds': segment['start_seconds'],
                            'endSeconds': segment['end_seconds'],
                            'transcription': segment['transcription'],
                            'refinedTranscription': segment.get('refined_transcription'),
                            'confidence': segment.get('confidence', 0.0)
                        })
                    
                    print(f"💾 Storing transcription segments in database...")
                    
                    # Store segments in database
                    response = requests.post(f"{NEXTJS_API_BASE}/transcription-segments?key={SECURITY_KEY}", 
                        json={'segments': segment_data}
                    )
                    
                    if response.status_code != 200:
                        raise Exception(f"Failed to store segments: {response.status_code}")
                    
                    print(f"✅ Stored {len(segment_data)} transcription segments")
                    
                    # Update transcription status
                    print(f"📊 Finalizing transcription...")
                    response = requests.put(f"{NEXTJS_API_BASE}/transcriptions?key={SECURITY_KEY}", 
                        json={
                            'id': transcription_id,
                            'status': 'completed',
                            'language': language,
                            'totalSegments': len(segments),
                            'totalDuration': total_duration,
                            'processedAt': datetime.now().isoformat()
                        }
                    )
                    
                    if response.status_code == 200:
                        print(f"🎉 Transcription completed successfully for video {video_id}")
                        print(f"   📊 Summary: {len(segments)} segments, {language} language")
                    else:
                        print(f"⚠️  Transcription completed but failed to update status: {response.status_code}")
                
                finally:
                    # Clean up temporary audio file
                    if os.path.exists(temp_audio_path):
                        os.unlink(temp_audio_path)
                
            except Exception as e:
                print(f"❌ Error processing transcription for video {video_id}: {e}")
                print(f"   Error type: {type(e).__name__}")
                
                # Update transcription status to failed
                try:
                    requests.put(f"{NEXTJS_API_BASE}/transcriptions?key={SECURITY_KEY}", 
                        json={
                            'id': transcription_id,
                            'status': 'failed',
                            'errorMessage': str(e)
                        }
                    )
                    print(f"🔄 Updated transcription status to failed")
                except Exception as update_error:
                    print(f"❌ Failed to update transcription status: {update_error}")
        
        # Start background processing
        thread = threading.Thread(target=process_video_transcription)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Video transcription started',
            'transcriptionId': transcription_id
        })
        
    except Exception as e:
        return jsonify({'error': f'Failed to start transcription: {str(e)}'}), 500

@app.route('/api/transcription/<transcription_id>', methods=['GET'])
def get_transcription(transcription_id):
    """Get transcription status and results"""
    security_key = request.headers.get('X-Security-Key')
    
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        response = requests.get(f"{NEXTJS_API_BASE}/transcriptions?key={SECURITY_KEY}&id={transcription_id}")
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify(response.json()), response.status_code
        
    except Exception as e:
        return jsonify({'error': f'Failed to get transcription: {str(e)}'}), 500

@app.route('/api/summarize-video', methods=['POST'])
def summarize_video_api():
    """Generate video summaries and contextual topics using GPT"""
    security_key = request.headers.get('X-Security-Key')
    
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        data = request.get_json()
        video_id = data.get('video_id')
        model_name = data.get('model', 'gpt-4o-mini-2024-07-18')  # default to gpt-4o-mini-2024-07-18
        segment_duration = data.get('segment_duration', 60)  # 60 seconds per segment by default
        
        if not video_id:
            return jsonify({'error': 'Video ID is required'}), 400
            
        # Validate model name
        allowed_models = ['gpt-4.1-nano-2025-04-14', 'gpt-4o-mini-2024-07-18']
        if model_name not in allowed_models:
            return jsonify({'error': f'Model must be one of: {allowed_models}'}), 400
        
        # Check if OpenAI client is available
        if not openai_client:
            return jsonify({'error': 'OpenAI client not configured. Please set OPENAI_API_KEY'}), 500
        
        print(f"Starting video summarization for video: {video_id} with model: {model_name}")
        
        # Start background processing
        threading.Thread(target=process_video_summarization, args=(video_id, model_name, segment_duration)).start()
        
        return jsonify({
            'message': 'Video summarization started',
            'video_id': video_id,
            'model': model_name,
            'status': 'processing'
        })
        
    except Exception as e:
        print(f"Error starting video summarization: {e}")
        return jsonify({'error': str(e)}), 500

def process_video_summarization(video_id, model_name, segment_duration):
    """Background task to process video summarization"""
    try:
        print(f"🎬 Processing video summarization for video: {video_id}")
        
        # Get video data  
        response = requests.get(f"{NEXTJS_API_BASE}/projects?key={SECURITY_KEY}")
        
        print(f"📊 Projects API response: {response.status_code}")
        if response.status_code != 200:
            print(f"❌ Failed to get projects data: {response.text}")
            return
        
        projects = response.json()
        video_data = None
        
        # Find the video
        for project in projects:
            for video in project.get('videos', []):
                if video['id'] == video_id:
                    video_data = video
                    break
            if video_data:
                break
        
        if not video_data:
            print(f"❌ Video not found: {video_id}")
            return
        
        print(f"📹 Video data found - Duration: {video_data.get('duration')}")
        
        # Get transcription data
        transcription_data = video_data.get('transcription')
        frame_analysis_data = video_data.get('frameAnalysis')
        
        print(f"📝 Transcription data: {'Found' if transcription_data else 'None'}")
        print(f"🖼️ Frame analysis data: {'Found' if frame_analysis_data else 'None'}")
        
        # Delete existing segments and topics for regeneration
        print(f"🗑️ Deleting existing segments and topics for video: {video_id}")
        
        # Delete existing video segments
        try:
            segments_delete_response = requests.delete(
                f"{NEXTJS_API_BASE}/video-segments?key={SECURITY_KEY}&videoId={video_id}"
            )
            if segments_delete_response.status_code == 200:
                print(f"✅ Deleted existing video segments")
            else:
                print(f"⚠️ Failed to delete segments: {segments_delete_response.status_code} - {segments_delete_response.text}")
        except Exception as e:
            print(f"⚠️ Error deleting segments: {e}")
        
        # Delete existing video topics
        try:
            topics_delete_response = requests.delete(
                f"{NEXTJS_API_BASE}/video-topics?key={SECURITY_KEY}&videoId={video_id}"
            )
            if topics_delete_response.status_code == 200:
                print(f"✅ Deleted existing video topics")
            else:
                print(f"⚠️ Failed to delete topics: {topics_delete_response.status_code} - {topics_delete_response.text}")
        except Exception as e:
            print(f"⚠️ Error deleting topics: {e}")
        
        print(f"🆕 Starting fresh summarization generation...")
        
        # Generate segments based on transcription or video duration
        segments = generate_video_segments(video_data, transcription_data, frame_analysis_data, segment_duration)
        
        # Process segments with GPT
        processed_segments = []
        processed_topics = []
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_cost = 0.0
        
        for i, segment in enumerate(segments):
            print(f"📝 Processing segment {i+1}/{len(segments)}: {segment['startingTimestamp']} - {segment['endingTimestamp']}")
            
            # Generate segment description
            segment_description, prompt_tokens, completion_tokens, segment_cost = generate_segment_description(
                segment, video_data, model_name
            )
            
            # Save segment to database
            segment_data = {
                'videoId': video_id,
                'segmentIndex': i,
                'startingTimestamp': segment['startingTimestamp'],
                'endingTimestamp': segment['endingTimestamp'],
                'startSeconds': segment['startSeconds'],
                'endSeconds': segment['endSeconds'],
                'description': segment_description,
                'status': 'completed',
                'model': model_name
            }
            
            segment_response = requests.post(
                f"{NEXTJS_API_BASE}/video-segments?key={SECURITY_KEY}",
                json=segment_data
            )
            
            print(f"💾 Segment API response: {segment_response.status_code}")
            if segment_response.status_code == 201:
                processed_segments.append(segment_response.json())
                print(f"✅ Saved segment {i+1}")
            else:
                print(f"❌ Failed to save segment {i+1}: {segment_response.text}")
            
            total_prompt_tokens += prompt_tokens
            total_completion_tokens += completion_tokens
            total_cost += segment_cost
        
        # Generate contextual topics (only if we have processed segments)
        topics = []
        if processed_segments:
            topics = generate_contextual_topics(processed_segments, video_data, model_name)
        
        for i, topic_data in enumerate(topics):
            topic_request = {
                'videoId': video_id,
                'topicIndex': i,
                'startingTimestamp': topic_data['startingTimestamp'],
                'endingTimestamp': topic_data['endingTimestamp'],
                'startSeconds': topic_data['startSeconds'],
                'endSeconds': topic_data['endSeconds'],
                'topic': topic_data['topic'],
                'status': 'completed',
                'model': model_name
            }
            
            topic_response = requests.post(
                f"{NEXTJS_API_BASE}/video-topics?key={SECURITY_KEY}",
                json=topic_request
            )
            
            print(f"🏷️ Topic API response: {topic_response.status_code}")
            if topic_response.status_code == 201:
                processed_topics.append(topic_response.json())
                print(f"✅ Saved topic {i+1}")
            else:
                print(f"❌ Failed to save topic {i+1}: {topic_response.text}")
        
        # Log token usage
        log_token_usage(video_id, 'video_summarization', model_name, 
                       total_prompt_tokens, total_completion_tokens, 
                       total_prompt_tokens + total_completion_tokens, total_cost)
        
        print(f"✅ Video summarization completed for video: {video_id}")
        print(f"📊 Generated {len(processed_segments)} segments and {len(processed_topics)} topics")
        print(f"🎯 Total tokens used: {total_prompt_tokens + total_completion_tokens}, Cost: ${total_cost:.4f}")
        
    except Exception as e:
        print(f"❌ Error processing video summarization: {e}")

def generate_video_segments(video_data, transcription_data, frame_analysis_data, segment_duration):
    """Generate video segments based on duration"""
    segments = []
    
    # Get video duration with proper null checking
    video_duration = video_data.get('duration')
    if video_duration is None or video_duration <= 0:
        # Try to get duration from transcription data
        if transcription_data and transcription_data.get('totalDuration'):
            video_duration = transcription_data['totalDuration']
        else:
            video_duration = 300  # Default 5 minutes
    
    # Ensure we have valid numeric values
    video_duration = float(video_duration) if video_duration else 300.0
    segment_duration = float(segment_duration) if segment_duration else 60.0
    
    current_time = 0.0
    
    while current_time < video_duration:
        start_seconds = current_time
        end_seconds = min(current_time + segment_duration, video_duration)
        
        segments.append({
            'startingTimestamp': seconds_to_timestamp(start_seconds),
            'endingTimestamp': seconds_to_timestamp(end_seconds),
            'startSeconds': start_seconds,
            'endSeconds': end_seconds,
            'transcription': get_segment_transcription(transcription_data, start_seconds, end_seconds),
            'frames': get_segment_frames(frame_analysis_data, start_seconds, end_seconds)
        })
        
        current_time = end_seconds
    
    return segments

def get_segment_transcription(transcription_data, start_seconds, end_seconds):
    """Get transcription text for a specific time segment"""
    if not transcription_data or 'segments' not in transcription_data:
        return ""
    
    # Ensure we have valid numeric values
    start_seconds = float(start_seconds) if start_seconds is not None else 0.0
    end_seconds = float(end_seconds) if end_seconds is not None else 0.0
    
    relevant_text = []
    for segment in transcription_data['segments']:
        # Get segment times with null checking
        seg_start = segment.get('startSeconds')
        seg_end = segment.get('endSeconds')
        
        if seg_start is None or seg_end is None:
            continue
            
        seg_start = float(seg_start)
        seg_end = float(seg_end)
        
        if (seg_start >= start_seconds and seg_start < end_seconds) or \
           (seg_end > start_seconds and seg_end <= end_seconds) or \
           (seg_start < start_seconds and seg_end > end_seconds):
            text = segment.get('refinedTranscription') or segment.get('transcription', '')
            if text:
                relevant_text.append(text)
    
    return ' '.join(relevant_text)

def get_segment_frames(frame_analysis_data, start_seconds, end_seconds):
    """Get frame captions for a specific time segment"""
    if not frame_analysis_data or 'captions' not in frame_analysis_data:
        return []
    
    # Ensure we have valid numeric values
    start_seconds = float(start_seconds) if start_seconds is not None else 0.0
    end_seconds = float(end_seconds) if end_seconds is not None else 0.0
    
    relevant_captions = []
    for caption in frame_analysis_data['captions']:
        try:
            # Convert timestamp to seconds (assuming HH.MM.SS format)
            timestamp = caption.get('timestamp', '')
            if not timestamp:
                continue
                
            timestamp_parts = timestamp.split('.')
            if len(timestamp_parts) == 3:
                caption_seconds = float(int(timestamp_parts[0]) * 3600 + int(timestamp_parts[1]) * 60 + int(timestamp_parts[2]))
                if start_seconds <= caption_seconds < end_seconds:
                    caption_text = caption.get('caption', '')
                    if caption_text:
                        relevant_captions.append(caption_text)
        except (ValueError, TypeError, AttributeError):
            # Skip invalid timestamps
            continue
    
    return relevant_captions

def generate_segment_description(segment, video_data, model_name):
    """Generate AI description for a video segment using GPT"""
    try:
        # Prepare context for GPT
        context = f"""
Video Title: {video_data.get('title', 'Unknown')}
Video Description: {video_data.get('description', 'No description available')}
Segment Time: {segment['startingTimestamp']} - {segment['endingTimestamp']}

Audio Transcription:
{segment.get('transcription', 'No transcription available')}

Visual Elements:
{' | '.join(segment.get('frames', []))}

Generate a concise, engaging description (2-3 sentences) that captures the essence of what happens in this video segment. Focus on the main actions, topics, or visual elements.
"""
        
        response = openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are an expert video content analyst. Generate concise, engaging descriptions for video segments based on transcription and visual elements."},
                {"role": "user", "content": context}
            ],
            max_tokens=150,
            temperature=0.7
        )
        
        description = response.choices[0].message.content.strip()
        prompt_tokens = response.usage.prompt_tokens
        completion_tokens = response.usage.completion_tokens
        cost = calculate_cost(model_name, prompt_tokens, completion_tokens)
        
        return description, prompt_tokens, completion_tokens, cost
        
    except Exception as e:
        print(f"Error generating segment description: {e}")
        return f"Content from {segment['startingTimestamp']} to {segment['endingTimestamp']}", 0, 0, 0.0

def generate_contextual_topics(segments, video_data, model_name):
    """Generate contextual topics that span multiple segments"""
    try:
        # Group segments into larger topic clusters
        topics = []
        current_topic_segments = []
        topic_duration = 120.0  # 2 minutes per topic on average
        
        for segment in segments:
            current_topic_segments.append(segment)
            
            # Check if we should create a topic with null checking
            try:
                if len(current_topic_segments) >= 2:
                    # Get start and end times with null checking
                    start_time = current_topic_segments[0].get('startSeconds')
                    end_time = current_topic_segments[-1].get('endSeconds')
                    
                    if start_time is not None and end_time is not None:
                        duration_check = (float(end_time) - float(start_time)) >= topic_duration
                    else:
                        duration_check = False
                else:
                    duration_check = False
                
                # Create topic if duration threshold met or this is the last segment
                if duration_check or segment == segments[-1]:
                    # Generate topic for current segments
                    topic_text = generate_topic_from_segments(current_topic_segments, video_data, model_name)
                    
                    topics.append({
                        'startingTimestamp': current_topic_segments[0].get('startingTimestamp', '00:00:00'),
                        'endingTimestamp': current_topic_segments[-1].get('endingTimestamp', '00:00:00'),
                        'startSeconds': float(current_topic_segments[0].get('startSeconds', 0)),
                        'endSeconds': float(current_topic_segments[-1].get('endSeconds', 0)),
                        'topic': topic_text
                    })
                    
                    # Reset for next topic
                    current_topic_segments = []
                    
            except (ValueError, TypeError, AttributeError) as e:
                print(f"Error processing topic segment: {e}")
                continue
        
        return topics
        
    except Exception as e:
        print(f"Error generating contextual topics: {e}")
        return []

def generate_topic_from_segments(segments, video_data, model_name):
    """Generate a contextual topic from multiple segments"""
    try:
        # Combine segment descriptions
        segment_descriptions = [seg.get('description', '') for seg in segments]
        combined_descriptions = '\n'.join(segment_descriptions)
        
        context = f"""
Video Title: {video_data.get('title', 'Unknown')}
Time Range: {segments[0]['startingTimestamp']} - {segments[-1]['endingTimestamp']}

Segment Descriptions:
{combined_descriptions}

Based on these segment descriptions, generate a concise, descriptive topic title (3-6 words) that captures the main theme or subject matter of this portion of the video.
"""
        
        response = openai_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are an expert content categorizer. Generate concise, descriptive topic titles that capture the essence of video content."},
                {"role": "user", "content": context}
            ],
            max_tokens=50,
            temperature=0.5
        )
        
        topic = response.choices[0].message.content.strip()
        return topic
        
    except Exception as e:
        print(f"Error generating topic: {e}")
        return f"Topic {segments[0]['startingTimestamp']}-{segments[-1]['endingTimestamp']}"

def calculate_cost(model_name, prompt_tokens, completion_tokens):
    """Calculate cost based on model pricing"""
    pricing = {
        'gpt-4.1-nano-2025-04-14': {'input': 0.00010/1000, 'output': 0.0004/1000},  # per 1K tokens (estimated)
        'gpt-4o-mini-2024-07-18': {'input': 0.00015/1000, 'output': 0.0006/1000}  # per 1K tokens
    }
    
    if model_name in pricing:
        input_cost = prompt_tokens * pricing[model_name]['input']
        output_cost = completion_tokens * pricing[model_name]['output']
        return input_cost + output_cost
    
    return 0.0

def log_token_usage(video_id, operation, model, prompt_tokens, completion_tokens, total_tokens, cost):
    """Log token usage to database"""
    try:
        usage_data = {
            'videoId': video_id,
            'operation': operation,
            'model': model,
            'promptTokens': prompt_tokens,
            'completionTokens': completion_tokens,
            'totalTokens': total_tokens,
            'cost': cost
        }
        
        response = requests.post(
            f"{NEXTJS_API_BASE}/token-usage?key={SECURITY_KEY}",
            json=usage_data
        )
        
        if response.status_code == 201:
            print(f"📊 Token usage logged: {total_tokens} tokens, ${cost:.4f}")
        else:
            print(f"❌ Failed to log token usage: {response.status_code} - {response.text}")
        
    except Exception as e:
        print(f"❌ Error logging token usage: {e}")

@app.route('/api/video-segments/<video_id>', methods=['GET'])
def get_video_segments(video_id):
    """Get video segments by video ID"""
    security_key = request.headers.get('X-Security-Key')
    
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        response = requests.get(
            f"{NEXTJS_API_BASE}/video-segments?key={SECURITY_KEY}&videoId={video_id}"
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Segments not found'}), 404
            
    except Exception as e:
        print(f"Error fetching video segments: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/video-topics/<video_id>', methods=['GET'])
def get_video_topics(video_id):
    """Get video topics by video ID"""
    security_key = request.headers.get('X-Security-Key')
    
    if security_key != SECURITY_KEY:
        return jsonify({'error': 'Invalid security key'}), 401
    
    try:
        response = requests.get(
            f"{NEXTJS_API_BASE}/video-topics?key={SECURITY_KEY}&videoId={video_id}"
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Topics not found'}), 404
            
    except Exception as e:
        print(f"Error fetching video topics: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/frames/<path:filename>')
def serve_frame(filename):
    """Serve extracted frame images"""
    try:
        # Extract video_id from the path
        path_parts = filename.split('/')
        if len(path_parts) >= 2:
            video_id = path_parts[0]
            frame_filename = path_parts[1]
            
            # Find the project containing this video
            project_dirs = [d for d in os.listdir('.') if os.path.isdir(d) and d != 'venv' and d != '__pycache__']
            
            for project_name in project_dirs:
                frame_path = os.path.join(project_name, 'frames', video_id, frame_filename)
                if os.path.exists(frame_path):
                    return send_file(frame_path, mimetype='image/jpeg')
            
        return jsonify({'error': 'Frame not found'}), 404
        
    except Exception as e:
        return jsonify({'error': f'Failed to serve frame: {str(e)}'}), 500

@app.route('/faces/<path:filename>')
def serve_face(filename):
    """Serve detected face images"""
    try:
        # Extract video_id from the path
        path_parts = filename.split('/')
        if len(path_parts) >= 2:
            video_id = path_parts[0]
            face_filename = path_parts[1]
            
            # Find the project containing this video
            project_dirs = [d for d in os.listdir('.') if os.path.isdir(d) and d != 'venv' and d != '__pycache__']
            
            for project_name in project_dirs:
                face_path = os.path.join(project_name, 'faces', video_id, face_filename)
                if os.path.exists(face_path):
                    return send_file(face_path, mimetype='image/jpeg')
            
        return jsonify({'error': 'Face image not found'}), 404
        
    except Exception as e:
        return jsonify({'error': f'Failed to serve face: {str(e)}'}), 500

# This allows you to run the app directly with `python app.py`
if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("🚀 Starting RCSquare Flask Backend...")
    print("📍 Server will be available at: http://localhost:3001")
    print("=" * 60)
    
    # Load AI models on startup
    print("\n🤖 Loading AI models on startup...")
    print("   This may take 2-3 minutes on first run (downloading models)")
    print("   Please wait...")
    
    success = load_ai_models()
    
    if success:
        print("\n✅ All systems ready!")
        print("💫 Frame extraction with AI features is now available")
    else:
        print("\n⚠️  Server starting without AI features")
        print("   You can retry loading models later using /api/load-models")
    
    print("\n" + "=" * 60)
    print("🌐 Starting Flask server...")
    app.run(host='0.0.0.0', port=3001, debug=True)