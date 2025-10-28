import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
// Using REST images/edits via fetch + FormData (Node 18+)

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Static hosting (serve index.html, bot.html, assets)
app.use(express.static(__dirname, { extensions: ['html'] }));

// Simple health endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Ensure uploads directory exists and configure Multer
const uploadsDir = path.join(__dirname, 'uploads_tmp');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
const upload = multer({ dest: uploadsDir });

// In-memory image store (id -> Buffer)
const imageIdToBuffer = new Map();

// Single global prompt (no per-style overrides)
function buildPrompt() {
  return process.env.SYSTEM_PROMPT || 'A highly detailed transformation of [character] into the Chillhouse meme style: an anthropomorphic cartoon house with a relaxed, chill expression, bulbous nose, simple eyes sometimes with glasses, house-shaped body with a sloped roof and chimney, wearing a casual gray sweater, blue jeans with hands casually in pockets, and black sneakers, standing in a laid-back pose, simple flat colors, meme art style, high contrast, vibrant background optional, no text.';
}

// POST /transform -> returns { success, image_id }
app.post('/transform', upload.single('image'), async (req, res) => {
  const style = req.body?.style;
  // Check API key first so error is clear even if file is missing
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OPENAI_API_KEY not configured' });
  }
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Missing image upload' });
  }

  try {
    const prompt = buildPrompt();

    // Use Images Edits REST endpoint with multipart form data
    const form = new FormData();
    // Build a Blob for Web FormData (Node 18+ fetch)
    const fileBuffer = await fs.promises.readFile(file.path);
    const blob = new Blob([fileBuffer], { type: file.mimetype || 'application/octet-stream' });
    form.append('image', blob, file.originalname || 'image.png');
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('size', '1024x1024');

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        // Content-Type is set automatically by FormData boundary
      },
      body: form
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OpenAI error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error(`No image returned from OpenAI: ${JSON.stringify(json)}`);
    }
    const buffer = Buffer.from(b64, 'base64');
    const imageId = uuidv4();
    imageIdToBuffer.set(imageId, buffer);

    // Clean up temp file
    try { fs.unlinkSync(file.path); } catch (_) {}

    res.json({ success: true, image_id: imageId });
  } catch (err) {
    console.error('Transform error:', err);
    res.status(500).json({ success: false, error: String(err?.message || err) });
  }
});

// GET /result/:imageId -> image/png
app.get('/result/:imageId', (req, res) => {
  const { imageId } = req.params;
  const buffer = imageIdToBuffer.get(imageId);
  if (!buffer) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Content-Type', 'image/png');
  res.send(buffer);
});

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Chillhouse server listening on http://localhost:${port}`);
});


