import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
            const geminiMessages = messages.map((msg: any) => {
                if (msg.images && msg.images.length > 0) {
                    return {
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [
                            ...(msg.content ? [{ text: msg.content }] : []),
                            ...msg.images.map((url: string) => {
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

            apiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: geminiMessages,
                    }),
                }
            );
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
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'An error occurred during generation.' })}\n\n`);
            res.end();
        }
    }
}