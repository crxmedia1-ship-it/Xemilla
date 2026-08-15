/**
 * Recorte 4:3 de fotos de plato (admin + detalle WebApp).
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
   * @returns {Promise}
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
 * @param {File} file
 * @param {string} restauranteId
 */
export async function uploadPlatoMediaFile(file, restauranteId) {
  const fd = new FormData();
  fd.set('file', file);
  fd.set('folder', `xemilla/platos/${restauranteId || 'general'}`);
  const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd });
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) throw new Error(uploadJson.error || 'No se pudo subir a Cloudinary');
  const url = uploadJson.url;
  if (!url) throw new Error('Cloudinary no devolvió URL');
  return String(url);
}
