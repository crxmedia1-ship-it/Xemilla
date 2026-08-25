export const prerender = false;

export async function POST({ request }) {
  try {
    const body = await request.json();
    const token = import.meta.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;

    if (!token) {
      return new Response(JSON.stringify({ error: 'Falta la API Key en las variables de entorno' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const promptValue = body.prompt_personalizado || body.prompt || "A hyper-realistic luxury gourmet burger, dark aesthetic, cinematic lighting";
    const scaleValue = parseFloat(body.controlnet_conditioning_scale) || 0.85;

    const slug = String(body.slug || '').trim();
    const qrContent =
      body.qr_code_content ||
      (slug ? `https://xemilla.app/${slug}` : 'https://xemilla.app/crx-prueba');

    // Petición estándar a la API de Replicate para crear la predicción
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '9227d8bc4f4032d5e0f523528b1223fa8c9527e0234771217e20302b11516e8c',
        input: {
          qr_code_content: qrContent,
          prompt: promptValue,
          controlnet_conditioning_scale: scaleValue,
          guidance_scale: 7.5,
          negative_prompt: 'ugly, disfigured, low quality, blurry, nsfw',
        },
      }),
    });

    const prediction = await response.json();

    if (prediction.error || prediction.detail) {
      throw new Error(prediction.error || prediction.detail);
    }

    // Polling síncrono para esperar la imagen
    let finalUrl = null;
    const checkUrl = prediction.urls?.get;

    if (!checkUrl) {
      throw new Error('Replicate no devolvió una URL de seguimiento válida');
    }

    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Token ${token}` },
      });
      const checkData = await checkRes.json();

      if (checkData.status === 'succeeded') {
        finalUrl = Array.isArray(checkData.output) ? checkData.output[0] : checkData.output;
        break;
      } else if (checkData.status === 'failed' || checkData.status === 'canceled') {
        throw new Error('Fallo en Replicate: ' + (checkData.error || checkData.status));
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
    console.error('API Error Replicate:', error);
    return new Response(JSON.stringify({ error: error.message || 'Error al procesar en Replicate' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
