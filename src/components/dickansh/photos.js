import { useEffect, useState } from 'react';
import SEALED from './sealed.json';
import { KEPT, boxKey, unsealBytes } from './seal';
import { storage } from '../../lib/hooks';

// The friendship wall's photos, opened: each sealed file fetched and
// decrypted with the key the visit's password gives (the same as the
// exhibits'), as object URLs for the page and the 3D. [] until then, or
// when there are none; the URLs are let go when the page goes.
export function usePhotos(museum) {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    const list = museum?.photos ?? [];
    const password = storage.get(KEPT);
    if (!list.length || !password) return undefined;
    let live = true;
    const urls = [];
    (async () => {
      const key = await boxKey(SEALED, password);
      if (!key) return;
      const opened = await Promise.all(
        list.map(async (p) => {
          try {
            const res = await fetch(p.src);
            if (!res.ok) return null;
            const plain = await unsealBytes(await res.arrayBuffer(), key);
            if (!plain) return null;
            const url = URL.createObjectURL(new Blob([plain], { type: 'image/webp' }));
            urls.push(url);
            return { url, caption: p.caption, w: p.w, h: p.h };
          } catch {
            return null;
          }
        }),
      );
      if (live) setPhotos(opened.filter(Boolean));
    })();
    return () => {
      live = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [museum]);
  return photos;
}
