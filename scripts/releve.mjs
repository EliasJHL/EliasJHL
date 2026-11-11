// Le relevé en relief : un an de contributions GitHub en trame, comme sur eliasjhl.dev, vu en perspective.
// Chaque jour est une pile de points qui pousse à l'ouverture ; la pile du jour pulse. Régénéré chaque jour par le workflow.
// usage : node scripts/releve.mjs [pseudo]   (Node 20+, sans dépendance)
import { mkdirSync, writeFileSync } from 'node:fs'

const PSEUDO = process.argv[2] ?? 'EliasJHL'
const r = await fetch(`https://github-contributions-api.jogruber.de/v4/${PSEUDO}?y=last`)
if (!r.ok) throw new Error(`API des contributions : ${r.status}`)
const jours = (await r.json()).contributions.map(x => ({ date: x.date, count: x.count }))

// les semaines en colonnes, du lundi au dimanche
const cols = []
for (const j of jours) {
  const ligne = (new Date(j.date + 'T12:00:00Z').getUTCDay() + 6) % 7
  if (!cols.length || ligne === 0) cols.push(Array(7).fill(null))
  cols[cols.length - 1][ligne] = j
}
const max = Math.max(1, ...jours.map(j => j.count)), total = jours.reduce((s, j) => s + j.count, 0)

const MOIS = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })
const PALETTES = {
  clair: { encre: '#151617', doux: '#5F6166', sol: '#C9CBC4', bas: '#8FB8DB', haut: '#2F5F98', jour: '#D9733F' },
  sombre: { encre: '#ECECE8', doux: '#A3A5A9', sol: '#34373B', bas: '#3F6FA8', haut: '#B9D4EC', jour: '#F0B27A' },
}
const POLICE = 'ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif'
const melange = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')

// projection oblique : les semaines vont vers la droite, les jours s'enfoncent en haut à droite,
// et chaque jour devient une pile de points, d'autant plus haute qu'il compte de contributions
const P = 15, PROF_X = P * 0.62, PROF_Y = P * 0.46, R = 4.4, DZ = 5.2, NIVEAUX = 13
// racine carrée pour la hauteur : sinon tout paraît plat, la plupart des jours étant faibles
const niveau = n => (n ? Math.max(1, Math.round(NIVEAUX * Math.sqrt(n / max))) : 0)
const HAUT = 44 + NIVEAUX * DZ + 6 * PROF_Y + 8, W = Math.ceil(cols.length * P + 6 * PROF_X + 16), H = Math.ceil(HAUT + 34)
const position = (i, d) => {
  const q = 6 - d // le lundi au fond, le dimanche devant
  return [8 + i * P + P / 2 + q * PROF_X, HAUT - q * PROF_Y]
}

function relief(mode) {
  const c = PALETTES[mode], fond = [], piles = []
  fond.push(`<text x="4" y="22" font-family="${POLICE}" font-size="20" font-weight="800" fill="${c.encre}">${total.toLocaleString('en-US')}</text>`)
  fond.push(`<text x="${4 + total.toLocaleString('en-US').length * 12.5 + 8}" y="22" font-family="${POLICE}" font-size="14" fill="${c.doux}">contributions in the last twelve months</text>`)
  // du fond vers l'avant, de gauche à droite : les piles de devant passent devant celles de derrière
  for (let d = 0; d < 7; d++)
    cols.forEach((col, i) => {
      const j = col[d]
      if (!j) return
      const [x, y] = position(i, d), n = niveau(j.count), jour = j === jours.at(-1), retard = 0.2 + i * 0.02 + (6 - d) * 0.01
      if (!n && !jour) return fond.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="${c.sol}"/>`)
      const pile = Math.max(n, jour ? 2 : 0)
      for (let k = 0; k < pile; k++) {
        const couleur = jour ? c.jour : melange(c.bas, c.haut, k / (NIVEAUX - 1))
        // chaque point part du sol et monte à sa place : la pile pousse
        piles.push(`<circle cx="${x.toFixed(1)}" cy="${(y - k * DZ).toFixed(1)}" r="${R}" fill="${couleur}" style="--h:${(k * DZ).toFixed(1)}px;animation-delay:${(retard + k * 0.025).toFixed(3)}s"/>`)
      }
      if (jour) piles.push(`<circle class="anneau" cx="${x.toFixed(1)}" cy="${(y - (pile - 1) * DZ).toFixed(1)}" r="${R}" fill="none" stroke="${c.jour}" stroke-width="1.5"/>`)
    })
  // les mois le long du bord avant, sous leur première semaine
  cols.forEach((col, i) => {
    const premier = col.find(Boolean)
    if (premier && +premier.date.slice(8) <= 7 && i * P + 40 < W) fond.push(`<text x="${(8 + i * P).toFixed(1)}" y="${HAUT + 22}" font-family="${POLICE}" font-size="11" font-weight="600" fill="${c.doux}">${MOIS.format(new Date(premier.date + 'T12:00:00Z'))}</text>`)
  })
  const style =
    'circle[style]{animation:monte .7s cubic-bezier(.23,1,.32,1) both}@keyframes monte{from{transform:translateY(var(--h));opacity:.35}to{transform:none;opacity:1}}' +
    `.anneau{transform-box:fill-box;transform-origin:center;opacity:0;animation:anneau 1.6s ease-out ${(0.2 + cols.length * 0.02 + 0.6).toFixed(2)}s infinite}@keyframes anneau{from{transform:scale(1);opacity:1}to{transform:scale(2.4);opacity:0}}` +
    '@media (prefers-reduced-motion:reduce){circle[style]{animation:none}.anneau{display:none}}'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${total} GitHub contributions in the last twelve months, as stacks of dots"><style>${style}</style>${fond.join('')}${piles.join('')}</svg>`
}

mkdirSync('assets', { recursive: true })
writeFileSync('assets/releve.svg', relief('clair'))
writeFileSync('assets/releve-sombre.svg', relief('sombre'))
console.log(`relevé : ${total} contributions, ${cols.length} semaines → assets/releve.svg, assets/releve-sombre.svg`)
