import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, model = 'gemini-2.5-flash' } = req.body;

        const geminiMessages = messages.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        }));

        const apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

        const data = await apiResponse.json();

        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Internal Server Error',
        });
    }
}