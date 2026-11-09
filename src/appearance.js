export const ACCENTS = [
  { name: 'Мята', color: '#c2e6d9' },
  { name: 'Небо', color: '#adcfee' },
  { name: 'Лаванда', color: '#c5ace9' },
  { name: 'Роза', color: '#edb7ce' },
  { name: 'Персик', color: '#edbea4' },
  { name: 'Песок', color: '#edcf87' },
];
export const validColor = (color) => /^#[\da-f]{6}$/i.test(color || '');
export function readAppearance(account = 'demo') {
  try {
    return {
      theme: localStorage.getItem('ritm.theme') === 'light' ? 'light' : 'dark',
      accent: validColor(localStorage.getItem(`ritm.accent.${account}`)) ? localStorage.getItem(`ritm.accent.${account}`) : ACCENTS[0].color,
    };
  } catch { return { theme: 'dark', accent: ACCENTS[0].color }; }
}
export function persistAppearance(appearance, account) {
  localStorage.setItem('ritm.theme', appearance.theme);
  localStorage.setItem(`ritm.accent.${account}`, appearance.accent);
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(hex) {
  const channels = rgb(hex).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
function accentText(color, theme) {
  const base = rgb(color), target = theme === 'light' ? 0 : 255;
  const background = theme === 'light' ? '#f5f5f2' : '#1b1c20';
  let result = color;
  for (let i = 0; i <= 20 && contrast(result, background) < 4.5; i++) {
    result = '#' + base.map((v) => Math.round(v + (target - v) * i / 20).toString(16).padStart(2, '0')).join('');
  }
  return result;
}
export function applyAppearance({ theme, accent }) {
  const onAccent = contrast(accent, '#202824') >= contrast(accent, '#ffffff') ? '#202824' : '#ffffff';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--on-accent', onAccent);
  document.documentElement.style.setProperty('--accent-ink', accentText(accent, theme));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f5f2' : '#1b1c20');
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && favicon.dataset.accent !== accent) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${accent}"/><path d="M17 39V26m15 18V20m15 18V26" fill="none" stroke="${onAccent}" stroke-width="7" stroke-linecap="round"/></svg>`;
    favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    favicon.dataset.accent = accent;
  }
}
export function profileFromUser(user) {
  const metadata = { ...(user?.identities?.[0]?.identity_data || {}), ...(user?.user_metadata || {}) };
  return {
    display_name: metadata.name || metadata.full_name || [metadata.given_name, metadata.family_name].filter(Boolean).join(' ') || 'Участник',
    telegram_username: metadata.preferred_username || metadata.username || null,
    avatar_url: metadata.picture || metadata.avatar_url || metadata.photo_url || null,
    accent_color: ACCENTS[0].color,
  };
}
export function avatarUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
}
export function validateProfile(input) {
  const fields = {};
  if ('display_name' in input) {
    const name = String(input.display_name).trim();
    if (!name || [...name].length > 80) throw new Error('Имя: от 1 до 80 символов.');
    fields.display_name = name;
  }
  if ('accent_color' in input) {
    if (!validColor(input.accent_color)) throw new Error('Выбери цвет в формате #RRGGBB.');
    fields.accent_color = input.accent_color.toLowerCase();
  }
  return fields;
}
