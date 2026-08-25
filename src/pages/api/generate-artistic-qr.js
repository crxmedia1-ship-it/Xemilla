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
    const qrContent = body.qr_code_content || "https://xemilla.app/crx-prueba";
    
    // BLINDAJE 422: El modelo de nateraw exige que la escala esté entre 1.0 y 2.0.
    // Si el usuario envía 0.85, lo ajustamos al mínimo permitido para evitar el error de validación.
    const rawScale = parseFloat(body.controlnet_conditioning_scale) || 1.5;
    const scaleValue = Math.max(1.0, Math.min(2.0, rawScale));

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Hash verificado y oficial de nateraw/qrcode-stable-diffusion
        version: "9cdabf8f8a991351960c7ce2105de2909514b40bd27ac202dba57935b07d29d4",
        input: {
          qr_code_content: qrContent,
          prompt: promptValue,
          controlnet_conditioning_scale: scaleValue,
          guidance_scale: 7.5,
          negative_prompt: "ugly, disfigured, low quality, blurry, nsfw"
        }
      })
    });

    const prediction = await response.json();

    if (prediction.error || prediction.detail) {
      throw new Error(prediction.error || prediction.detail);
    }

    // Polling síncrono a prueba de fallos
    let finalUrl = null;
    const checkUrl = prediction.urls.get;

    for (let i = 0; i < 25; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const checkRes = await fetch(checkUrl, {
        headers: { "Authorization": `Token ${token}` }
      });
      const checkData = await checkRes.json();

      if (checkData.status === "succeeded") {
        finalUrl = Array.isArray(checkData.output) ? checkData.output[0] : checkData.output;
        break;
      } else if (checkData.status === "failed" || checkData.status === "canceled") {
        throw new Error("Error en generación: " + (checkData.error || "Proceso cancelado"));
      }
    }

    if (!finalUrl) {
      throw new Error("Tiempo de espera agotado al generar la imagen.");
    }

    return new Response(JSON.stringify({ ok: true, imagen_url: finalUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
