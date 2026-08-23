export const prerender = false;

export async function POST({ request }) {
  try {
    const body = await request.json();
    const token = import.meta.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Falta la API Key en .env' }), { status: 401 });
    }

    const promptValue =
      body.prompt_personalizado ||
      body.prompt ||
      'A hyper-realistic luxury gourmet burger, dark aesthetic, cinematic lighting';
    const scaleValue = parseFloat(body.controlnet_conditioning_scale) || 1.2;

    const slug = String(body.slug || '').trim();
    const qrCodeContent = slug
      ? `https://xemilla.app/${slug}`
      : 'https://xemilla.app/crx-prueba';

    const response = await fetch(
      'https://api.replicate.com/v1/models/nateraw/qrcode-stable-diffusion/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            qr_code_content: qrCodeContent,
            prompt: promptValue,
            controlnet_conditioning_scale: scaleValue,
            guidance_scale: 7.5,
            negative_prompt: 'ugly, disfigured, low quality, blurry, nsfw',
          },
        }),
      },
    );

    const prediction = await response.json();

    if (prediction.error || prediction.detail) {
      throw new Error(prediction.error || prediction.detail);
    }

    let finalUrl = null;
    let checkUrl = prediction.urls.get;

    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Token ${token}` },
      });
      const checkData = await checkRes.json();

      if (checkData.status === 'succeeded') {
        finalUrl = Array.isArray(checkData.output) ? checkData.output[0] : checkData.output;
        break;
      } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
        throw new Error('Fallo en Replicate: ' + checkData.error);
      }
    }

    if (!finalUrl) {
      throw new Error('Tiempo de espera agotado en Replicate (Timeout).');
    }

    return new Response(JSON.stringify({ ok: true, imagen_url: finalUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
