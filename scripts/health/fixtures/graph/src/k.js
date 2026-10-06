// a comment before the specifier (Vite's own, here) leaves the literal alone
export const k = () => import(/* @vite-ignore */ './j.js');
