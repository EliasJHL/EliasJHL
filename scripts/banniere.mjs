// La bannière, les étiquettes et les badges du profil (assets/*.svg), en trame comme sur eliasjhl.dev.
// À relancer à la main après un changement de texte ou de badge.
// usage : node scripts/banniere.mjs   (Node 20+, sans dépendance ; les logos viennent de Simple Icons)
import { readFileSync, writeFileSync } from 'node:fs'

const MODES = { clair: { encre: '#151617', papier: '#ECECE8' }, sombre: { encre: '#ECECE8', papier: '#151617' } }
// une couleur par domaine, comme sur le site
const TEINTE = { securite: '#A8432F', systeme: '#3F6FA8', materiel: '#B9821C', interfaces: '#D9733F', donnees: '#6B4FB8' }
const POLICE = 'ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif'
const ENTREE = '.e{opacity:0;animation:e .5s cubic-bezier(.23,1,.32,1) both}@keyframes e{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'
const xml = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const melange = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')
const svg = (w, h, titre, style, corps) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${xml(titre)}"><style>${style}</style>${corps}</svg>`
const ecrire = (nom, mode, contenu) => writeFileSync(`assets/${nom}${mode === 'sombre' ? '-sombre' : ''}.svg`, contenu)

// ---- la bannière : la spirale « Sécurité » qui tourne, et « EliasJHL » qui s'y déchiffre puis respire

// le nom en points, relevé une fois sur le texte composé : [x, y, encre de 0 à 1]
const nom = JSON.parse(readFileSync(new URL('nom-points.json', import.meta.url)))
const W = 1280, H = 320, PAS = 14, TOUR = 7, PHASES = 36, MIN = 0.12
// la spirale du site pour « EliasJHL » : centre, pas et phase
const CX = 0.7654 * W, CY = 0.4082 * H, K = 0.022 * 1.097 * 1.4, PHI = 0.3523

// un hasard reproductible : la bannière ne change pas d'une construction à l'autre
let g = 7
const hasard = () => (g = (Math.imul(g, 1103515245) + 12345) >>> 0) / 4294967296

// chaque point du nom part d'un endroit au hasard de la bannière et rejoint sa place
const lettres = nom.pts
  .map(([x, y, a]) => {
    const t = 0.3 + ((x - nom.x0) / nom.largeur) * 0.7 + hasard() * 0.35
    return `<circle cx="${x}" cy="${y}" r="${(4.5 * (0.45 + 0.55 * a)).toFixed(1)}" class="n" style="--x:${(hasard() * W - x).toFixed(0)}px;--y:${(hasard() * H - y).toFixed(0)}px;animation-delay:${t.toFixed(2)}s,${(t + 1.6).toFixed(2)}s"/>`
  })
  .join('')

// Faire tourner la spirale revient à décaler sa phase d'autant partout : chaque point du fond grossit et rapetisse
// au même rythme, en retard selon sa place dans la spirale. Les points trop près du nom sont retirés : il se lit dans un creux.
// ponytail: comparaison de chaque point du fond avec chaque point du nom (2 millions de calculs), instantané pour une construction à la main
let fond = ''
for (let y = PAS / 2; y < H; y += PAS)
  for (let x = PAS / 2; x < W; x += PAS) {
    if (nom.pts.some(([a, b]) => (a - x) ** 2 + (b - y) ** 2 < 169)) continue
    const phase = Math.atan2(y - CY, x - CX) * 3 + Math.hypot(x - CX, y - CY) * K + PHI
    const f = Math.floor(((((phase - Math.PI / 2) / (2 * Math.PI)) % 1) + 1) % 1 * PHASES)
    fond += `<circle cx="${x}" cy="${y}" r="6.9" class="c${Math.min(7, Math.floor((x / W) * 6 + 1))} f${f}"/>`
  }
// « .fond .fN » et pas « .fN » : sinon « .fond circle », plus précis, remettrait le retard à zéro
const phases = fn => Array.from({ length: PHASES }, (_, f) => `.fond .f${f}{${fn(f)}}`).join('')

for (const [mode, { encre, papier }] of Object.entries(MODES)) {
  const style =
    Array.from({ length: 8 }, (_, i) => `.c${i}{fill:${melange(TEINTE.securite, '#E39A7E', i / 7)}}`).join('') +
    `.fond circle{transform-box:fill-box;transform-origin:center;animation:t ${TOUR}s ease-in-out infinite}@keyframes t{0%,100%{transform:scale(1)}50%{transform:scale(${MIN})}}` +
    phases(f => `animation-delay:${((f / PHASES - 1) * TOUR).toFixed(2)}s`) +
    `.n{fill:${encre};transform-box:fill-box;transform-origin:center;animation:dec 1.3s cubic-bezier(.23,1,.32,1) both,res 2.6s ease-in-out infinite}` +
    '@keyframes dec{from{translate:var(--x) var(--y);opacity:0;transform:scale(.5)}40%{opacity:1}to{translate:0 0;opacity:1;transform:scale(1)}}' +
    '@keyframes res{0%,100%{transform:scale(1)}50%{transform:scale(.72)}}' +
    // sans animation, la spirale reste à l'arrêt
    `@media (prefers-reduced-motion:reduce){.fond circle,.n{animation:none}${phases(f => `transform:scale(${(MIN + (1 - MIN) * (0.5 + 0.5 * Math.cos((2 * Math.PI * f) / PHASES))).toFixed(2)})`)}}`
  ecrire('banniere', mode, svg(W, H, 'EliasJHL', style, `<rect width="${W}" height="${H}" rx="22" fill="${papier}"/><g class="fond">${fond}</g>${lettres}`))
}

// ---- les étiquettes des domaines : des pastilles qui entrent l'une après l'autre, le point du premier bat

function etiquettes(libelles, mode) {
  const { encre } = MODES[mode]
  let x = 0, corps = ''
  libelles.forEach((l, i) => {
    const w = Math.round(l.length * 7.4 + 26) + (i ? 0 : 14)
    corps +=
      `<g class="e" style="animation-delay:${(0.2 + i * 0.12).toFixed(2)}s"><rect x="${x + 0.75}" y="0.75" width="${w - 1.5}" height="26.5" rx="13.25" fill="none" stroke="${encre}" stroke-opacity="0.22"/>` +
      (i ? '' : `<circle cx="${x + 15}" cy="14" r="5" fill="${TEINTE.securite}"/>`) +
      `<text x="${x + (i ? 13 : 27)}" y="18.5" font-family="${POLICE}" font-size="13" font-weight="${i ? 500 : 700}" fill="${encre}">${xml(l)}</text></g>`
    x += w + 8
  })
  const style = ENTREE + 'circle{transform-box:fill-box;transform-origin:center;animation:b 2.6s ease-in-out 1s infinite}@keyframes b{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}@media (prefers-reduced-motion:reduce){.e,circle{animation:none;opacity:1}}'
  return svg(x - 8, 28, libelles.join(', '), style, corps)
}

// ---- les badges : le logo sur un carré à la couleur de son domaine (les outils sans domaine prennent l'encre), le nom à côté

const OUTILS = [
  ['C', 'c', 'systeme'], ['C++', 'cplusplus', 'systeme'], ['Linux', 'linux', 'systeme'], ['Android (AOSP)', 'android', 'systeme'],
  ['Raspberry Pi Pico', 'raspberrypi', 'materiel'], ['ESP32', 'espressif', 'materiel'],
  ['TypeScript', 'typescript', 'interfaces'], ['React', 'react', 'interfaces'],
  ['Python', 'python', 'donnees'], ['PostgreSQL', 'postgresql', 'donnees'],
  ['Git', 'git'], ['Docker', 'docker'], ['GitLab CI', 'gitlab'], ['Grafana', 'grafana'],
]
const TRYHACKME = [['TryHackMe', 'tryhackme', 'securite']], HACKTHEBOX = [['Hack The Box', 'hackthebox', 'securite']]

const logos = {}
for (const [, logo] of [...OUTILS, ...TRYHACKME, ...HACKTHEBOX]) {
  const r = await fetch(`https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/${logo}.svg`)
  if (!r.ok) throw new Error(`logo ${logo} : ${r.status}`)
  logos[logo] = (await r.text()).match(/ d="([^"]+)"/)[1]
}

function badges(liste, mode) {
  const { encre, papier } = MODES[mode]
  let x = 0, y = 0, largeur = 0, corps = ''
  liste.forEach(([libelle, logo, domaine], i) => {
    const w = 30 + Math.round(libelle.length * 6.9 + 22)
    if (x && x + w > 720) [x, y] = [0, y + 36] // au-delà de 720 px, on passe à la ligne
    corps +=
      `<g class="e" style="animation-delay:${(0.2 + i * 0.06).toFixed(2)}s">` +
      `<rect x="${x + 0.75}" y="${y + 0.75}" width="${w - 1.5}" height="26.5" rx="7" fill="none" stroke="${encre}" stroke-opacity="0.22"/>` +
      `<path d="M${x + 7},${y}h23v28h-23a7,7 0 0 1-7-7v-14a7,7 0 0 1 7-7z" fill="${TEINTE[domaine] ?? encre}"/>` +
      `<path d="${logos[logo]}" fill="${domaine ? '#FFFFFF' : papier}" transform="translate(${x + 8},${y + 7}) scale(${14 / 24})"/>` +
      `<text x="${x + 40}" y="${y + 18.5}" font-family="${POLICE}" font-size="13" font-weight="600" fill="${encre}">${xml(libelle)}</text></g>`
    largeur = Math.max(largeur, x + w)
    x += w + 8
  })
  return svg(largeur, y + 28, liste.map(b => b[0]).join(', '), ENTREE + '@media (prefers-reduced-motion:reduce){.e{animation:none;opacity:1}}', corps)
}

for (const mode of Object.keys(MODES)) {
  ecrire('etiquettes', mode, etiquettes(['Security', 'Systems', 'Networking', 'Interfaces'], mode))
  ecrire('outils', mode, badges(OUTILS, mode))
  // une image par plateforme : chacune est un lien vers le profil dans le README
  ecrire('tryhackme', mode, badges(TRYHACKME, mode))
  ecrire('hackthebox', mode, badges(HACKTHEBOX, mode))
}
console.log('bannière, étiquettes et badges → assets/')
