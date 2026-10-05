// What this device can afford, decided once so every scene, game and world
// fits it the same way. Phones have less to draw with (a smaller graphics
// chip, sharing memory with everything else, throttled when warm), less room
// to keep things in, and often a metered connection, so they start lower and
// ask before a world downloads a lot.
//
//   tier      'high' (a desktop or laptop with a graphics chip), 'mid' (a
//             phone or tablet, or a small or low-memory computer) or 'low'
//             (software WebGL, an older or budget phone, very little memory)
//   phone     a phone or tablet
//   saveData  the visitor asked for less data (Data Saver, Low Data Mode),
//             or the connection is 2G
//   memory    GB of memory, where the browser says (Chrome-based only)
//   why       what pulled the tier down: 'phone', 'memory', 'cores', 'gpu',
//             'software', 'screen'
//
// `budget()` turns the tier into numbers a renderer uses: the sharpest pixel
// ratio, multisampling, shadows, bloom, texture filtering. The renderers'
// own watchdogs still step down from there when frames run long.
//
// For testing on a desktop: ?quality=low (or mid, high) in the address, or
// localStorage 'tp-quality', pins the tier.

const KEY = 'tp-quality';
const TIERS = ['low', 'mid', 'high'];

// Phone graphics chips that struggle with full scenes: Mali's older and
// entry lines, Adreno 2xx to 5xx, PowerVR, VideoCore, Vivante, early Tegra.
const WEAK_GPU = /mali-(4\d\d|t\d|g(31|51|52)\b)|adreno[^\d]*[2-5]\d\d|powervr|sgx|videocore|vivante|tegra [34]\b/i;
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i;

export const BUDGETS = {
  high: { ratio: 2, antialias: true, samples: 4, shadows: true, shadowMap: 2048, bloom: 1, aniso: 16, stars: 1 },
  mid: { ratio: 1.5, antialias: true, samples: 2, shadows: true, shadowMap: 1024, bloom: 0.5, aniso: 4, stars: 0.6 },
  low: { ratio: 1, antialias: false, samples: 0, shadows: false, shadowMap: 512, bloom: 0, aniso: 1, stars: 0.35 },
};

// The tier from what the browser tells us. Pure, so it can be tested.
export function classifyDevice({ ua = '', touchPoints = 0, coarse = false, screen = 1920, memory = null, cores = null, saveData = false, net = '', renderer = '', software = false, override = null } = {}) {
  const phone = MOBILE_UA.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1) || (coarse && screen < 900);
  const lowData = Boolean(saveData) || /(^|-)2g$/.test(net);
  const why = [];
  if (software) why.push('software');
  if (memory != null && memory <= (phone ? 3 : 2)) why.push('memory');
  if (cores != null && cores > 0 && cores <= 2) why.push('cores');
  if (phone && WEAK_GPU.test(renderer)) why.push('gpu');
  let tier = why.length ? 'low' : 'high';
  if (tier === 'high') {
    if (phone) why.push('phone');
    else if (memory != null && memory <= 4) why.push('memory');
    else if (screen < 700) why.push('screen');
    if (why.length) tier = 'mid';
  }
  if (TIERS.includes(override)) tier = override;
  return { tier, phone, saveData: lowData, memory: memory ?? null, why };
}

function readOverride() {
  try {
    const q = new URLSearchParams(window.location.search).get('quality') ?? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('quality');
    if (TIERS.includes(q)) return q;
    const kept = window.localStorage.getItem(KEY);
    return TIERS.includes(kept) ? kept : null;
  } catch {
    return null;
  }
}

// What the browser says about itself. The graphics chip comes from lib/gpu's
// one look (passed in, so this module doesn't pull it in where it isn't used).
export function signals(gpuInfo = {}) {
  if (typeof window === 'undefined') return {};
  const nav = window.navigator ?? {};
  const conn = nav.connection ?? {};
  return {
    ua: nav.userAgent ?? '',
    touchPoints: nav.maxTouchPoints ?? 0,
    coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    screen: Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080, window.innerWidth || 1920),
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    saveData: Boolean(conn.saveData),
    net: conn.effectiveType ?? '',
    renderer: gpuInfo.renderer ?? '',
    software: Boolean(gpuInfo.software),
    override: readOverride(),
  };
}

let cached = null;
let gpuLook = null;

// The device, looked at once. lib/gpu hands over its look at the graphics
// chip when it makes one, which can sharpen the answer (a weak phone chip,
// software WebGL); until then the tier is read from everything else.
export function device() {
  return (cached ??= classifyDevice(signals(gpuLook ?? {})));
}

export function noteGpu(info) {
  gpuLook = info;
  cached = null;
}

export const budget = (tier = device().tier) => BUDGETS[tier] ?? BUDGETS.high;

// The sharpest pixel ratio worth drawing at: the tier's, under the scene's
// own cap, never above the screen's.
export function pixelRatio(cap = 2, tier) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  return Math.min(cap, budget(tier).ratio, dpr);
}

// Room left in this site's storage, in MB (null where the browser won't say).
export async function storageFree() {
  try {
    const est = await window.navigator?.storage?.estimate?.();
    if (!est || typeof est.quota !== 'number') return null;
    return Math.max(0, (est.quota - (est.usage ?? 0)) / 1048576);
  } catch {
    return null;
  }
}

// Whether a world of `mb` megabytes should wait for the visitor to say so
// before it downloads its 3D, and why. Desktops just load. Phones load the
// light ones and ask about the heavy ones; a weak device, Data Saver, or
// too little room left asks about anything but the lightest.
export const HEAVY_MB = 3;
export function worldCheck(mb, dev = device(), free = null) {
  if (mb <= 1) return { ask: false, why: null };
  if (dev.saveData) return { ask: true, why: 'data' };
  if (free != null && free < mb * 4) return { ask: true, why: 'storage' };
  if (dev.tier === 'low') return { ask: true, why: dev.why.includes('software') ? 'software' : 'weak' };
  if (dev.tier === 'mid' && dev.phone && mb >= HEAVY_MB) return { ask: true, why: 'phone' };
  return { ask: false, why: null };
}
