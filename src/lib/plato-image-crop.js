/**
 * Recorte 4:3 de fotos de plato (admin + detalle WebApp).
 * La subida NUNCA va a api.cloudinary.com desde el navegador:
 * solo FormData → POST /api/upload (firma autenticada en el servidor).
 */

/**
 * @param {File} file
 */
export function isCroppableImageFile(file) {
  if (!(file instanceof File)) return false;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('video/')) return false;
  if (type === 'image/gif') return false;
  if (type.startsWith('image/')) return true;
  return /\.(jpg|jpeg|png|webp|avif|heic)$/i.test(file.name || '');
}

function cancelledError() {
  const err = new Error('cancelled');
  err.cancelled = true;
  return err;
}

/**
 * @param {File|string} source
 * @returns {Promise<File>}
 */
export function cropPlatoImage(source) {
  return new Promise((resolve, reject) => {
    const cropApi = window.XemillaImageCrop;
    if (!cropApi || typeof cropApi.open !== 'function') {
      if (source instanceof File) {
        resolve(source);
        return;
      }
      reject(new Error('No hay editor de recorte'));
      return;
    }

    void Promise.resolve(
      cropApi.open({
        file: source instanceof File ? source : undefined,
        url: typeof source === 'string' ? source : undefined,
        aspect: 'plato',
        fit: 'cover',
        title: 'Ajustar foto del plato',
        hint: 'Llenar cubre el recuadro sin bandas negras. Encajar muestra la foto entera. Arrastrá y usá el zoom.',
        onConfirm: (cropped) => resolve(cropped),
        onCancel: () => reject(cancelledError()),
      }),
    ).then(() => {
      const root = document.getElementById('xemilla-image-crop');
      if (!root || !root.classList.contains('is-open')) {
        reject(cancelledError());
      }
    });
  });
}

/**
 * Sube el Blob/File del recorte SOLO vía nuestro backend.
 * No genera signature / timestamp / api_key en el cliente.
 *
 * @param {Blob|File} croppedBlob
 * @param {string} [restauranteId]
 * @param {string} [restauranteSlug]
 * @returns {Promise<string>} secure URL
 */
export async function uploadPlatoMediaFile(croppedBlob, restauranteId, restauranteSlug) {
  const currentSlug = String(restauranteSlug || '').trim() || 'black-sushi';
  const formData = new FormData();
  const file =
    croppedBlob instanceof File
      ? croppedBlob
      : new File([croppedBlob], 'plato.jpg', {
          type: croppedBlob.type || 'image/jpeg',
        });

  formData.append('file', file, file.name || 'plato.jpg');
  formData.append('restaurante_slug', currentSlug);
  formData.append('asset_type', 'dishes');
  if (restauranteId) formData.append('restaurante_id', String(restauranteId));

  const uploadRes = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  /** @type {{ ok?: boolean, url?: string, secure_url?: string, error?: string }} */
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || uploadJson.ok === false) {
    throw new Error(uploadJson.error || 'No se pudo subir a Cloudinary');
  }
  const url = uploadJson.url || uploadJson.secure_url;
  if (!url) throw new Error('Cloudinary no devolvió URL');
  return String(url);
}
