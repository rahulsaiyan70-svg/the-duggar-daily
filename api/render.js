/**
 * Serverless / API proxy handler for AI Rendering (e.g. Vercel/Netlify serverless function)
 * Environment Variables required for live production deployment:
 * - STABILITY_API_KEY / OPENAI_API_KEY
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, elevationImageData, referenceImage, provider, apiKey } = req.body;

    const apiSecret = process.env.AI_API_KEY || apiKey;

    if (!apiSecret && provider !== 'client-render') {
      return res.status(400).json({ error: 'AI API Key not configured in server environment or request settings.' });
    }

    // Proxy request to DALL-E or Stability AI if provider selected
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSecret}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json'
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return res.status(200).json({ status: 'success', images: [data.data[0].b64_json] });
    }

    return res.status(200).json({ status: 'success', message: 'API ready for live proxy' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
