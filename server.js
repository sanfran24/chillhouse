import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

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

// Multer storage to tmp files
const upload = multer({ dest: path.join(__dirname, 'uploads_tmp') });

// In-memory image store (id -> Buffer)
const imageIdToBuffer = new Map();

// Style -> prompt fragments
function buildPrompt(style) {
  const base = process.env.SYSTEM_PROMPT || 'Transform the person into a bold, high-contrast meme style while preserving identity and pose.';
  const byStyle = {
    'stonks-red': 'Apply the classic red "stonks down" chart vibe with red-tinted lighting and bold meme aesthetics. Add subtle red arrows or chart elements in the background.',
    'stonks-green': 'Apply the classic green "stonks up" chart vibe with green-tinted lighting and bold meme aesthetics. Add subtle green arrows or chart elements in the background.',
    'og-gigachad': 'Gigachad look: pronounced jawline, high contrast lighting, grayscale with subtle tint, while preserving the person.',
    'mog-chad': 'Mog Chad look: exaggerated masculine features with clean, crisp shading and dramatic lighting.',
    'cartoon-gigachad': 'Cartoon Gigachad: stylized, thick outlines, vibrant colors, playful but still powerful look.',
    'troll-gigachad': 'Troll Gigachad: mischievous expression, high-contrast shadows, subtle meme vibes.',
    'brainrot-gigachad': 'Brainrot Gigachad: absurd, over-the-top meme styling with neon accents.'
  };
  const extra = byStyle[style] || 'High-quality meme render, consistent with the selected vibe.';
  return `${base}\n${extra}`;
}

// OpenAI client (reuse same key)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /transform -> returns { success, image_id }
app.post('/transform', upload.single('image'), async (req, res) => {
  const style = req.body?.style;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Missing image upload' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ success: false, error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const prompt = buildPrompt(style);

    // Use image-to-image (edits) with gpt-image-1
    const response = await openai.images.edits({
      model: 'gpt-image-1',
      image: fs.createReadStream(file.path),
      prompt,
      size: '1024x1024'
    });

    const b64 = response?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('No image returned from OpenAI');
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


