import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // CORS middleware for deployment
  app.use((req, res, next) => {
    const origin = process.env.APP_URL || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API Route for chat
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, model = 'zai-org/GLM-5.2:zai-org' } = req.body;

      if (!messages || messages.length === 0) {
        return res.status(400).json({ error: 'Messages are required' });
      }

      const isHuggingFaceModel = model === 'zai-org/GLM-5.2:zai-org' || model.startsWith('zai-org/');
      let apiResponse;

      if (isHuggingFaceModel) {
        const hfMessages = messages.map((msg: any) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }));

        apiResponse = await fetch(
          `https://router.huggingface.co/v1/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: hfMessages,
              model: "zai-org/GLM-5.2:zai-org",
              stream: true
            }),
          }
        );
      } else {
        // Convert messages to Gemini format
        const geminiMessages = messages.map((msg: any) => {
          if (msg.images && msg.images.length > 0) {
            return {
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [
                ...(msg.content ? [{ text: msg.content }] : []),
                ...msg.images.map((url: string) => {
                  // url is a base64 data url like data:image/jpeg;base64,...
                  const mimeType = url.split(';')[0].split(':')[1];
                  const data = url.split(',')[1];
                  return {
                    inlineData: {
                      mimeType,
                      data
                    }
                  };
                })
              ]
            };
          }
          return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          };
        });

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: geminiMessages
          })
        });
      }

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("API Error:", errorText);
        return res.status(apiResponse.status).json({ error: 'Failed to fetch from API' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (!apiResponse.body) throw new Error("No response body");

      const reader = apiResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const dataStr = line.trim().slice(6);
            if (dataStr === '[DONE]') {
              res.write(`data: [DONE]\n\n`);
              continue;
            }
            try {
              const data = JSON.parse(dataStr);
              if (isHuggingFaceModel) {
                const textPart = data.choices?.[0]?.delta?.content;
                if (textPart) {
                  res.write(`data: ${JSON.stringify({ text: textPart })}\n\n`);
                }
              } else {
                const parts = data.candidates?.[0]?.content?.parts;
                if (parts && parts.length > 0) {
                  let textToSend = '';
                  for (const part of parts) {
                    if (part.text) {
                      textToSend += part.text;
                    }
                  }
                  if (textToSend) {
                    res.write(`data: ${JSON.stringify({ text: textToSend })}\n\n`);
                  }
                }
              }
            } catch (e) {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error) {
      console.error('Chat API Error:', error);
      // In Server-Sent Events, an error during streaming might just close the stream.
      // If we haven't started responding, we can send a 500
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'An error occurred during generation.' })}\n\n`);
        res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

  app.listen(Number(PORT), HOST, () => {
    console.log(`Server is running at ${APP_URL}`);
  });
}

startServer();
