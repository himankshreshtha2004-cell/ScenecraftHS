// Sample illustrations for the bundled demo project. They are drawn here as SVG and are always
// labelled "Sample illustration" in the app — they are not generated film stills.

const W = 1600, H = 900;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const r = (a: number, b: number) => a + rnd() * (b - a);
const f = (n: number) => n.toFixed(1);

function svg(body: string, w = W, h = H, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>
<filter id="b8"><feGaussianBlur stdDeviation="8"/></filter><filter id="b20"><feGaussianBlur stdDeviation="20"/></filter>
<filter id="b40"><feGaussianBlur stdDeviation="40"/></filter><filter id="b3"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
${defs}</defs>${body}<rect width="${w}" height="${h}" fill="url(#vig)"/><rect width="${w}" height="${h}" filter="url(#grain)" opacity=".9"/></svg>`;
}

function rain(n: number, op = 0.22, w = W, h = H, len = 34) {
  let s = `<g stroke="#cfd8ff" stroke-opacity="${op}" stroke-width="1.4" stroke-linecap="round">`;
  for (let i = 0; i < n; i++) { const x = r(0, w), y = r(-40, h); s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x - 6)}" y2="${f(y + r(len * .6, len))}"/>`; }
  return s + "</g>";
}

function skyline(base: number, hmin: number, hmax: number, color: string, winColor: string, winOp: number, density = 0.35) {
  let s = "", x = -20;
  while (x < W + 20) {
    const bw = r(50, 140), bh = r(hmin, hmax), top = base - bh;
    s += `<rect x="${f(x)}" y="${f(top)}" width="${f(bw)}" height="${f(bh + 400)}" fill="${color}"/>`;
    if (rnd() < 0.25) s += `<rect x="${f(x + bw / 2 - 3)}" y="${f(top - r(20, 70))}" width="5" height="70" fill="${color}"/>`;
    for (let wy = top + 14; wy < base - 8; wy += 18) for (let wx = x + 8; wx < x + bw - 10; wx += 15)
      if (rnd() < density) s += `<rect x="${f(wx)}" y="${f(wy)}" width="7" height="9" fill="${winColor}" opacity="${f(winOp * r(.35, 1))}"/>`;
    x += bw + r(-6, 10);
  }
  return s;
}

/** a standing woman in a long coat, seen from behind or in profile (silhouette) */
function woman(x: number, y: number, h: number, fill: string, rim = "#ff9d6b", rimOp = 0.5, walking = false) {
  const k = h / 400;
  const t = (px: number, py: number) => `${f(x + px * k)},${f(y + py * k)}`;
  const legs = walking
    ? `<path d="M${t(-14, 300)} L${t(-30, 392)} L${t(-18, 396)} L${t(-2, 304)}Z M${t(6, 300)} L${t(26, 390)} L${t(38, 386)} L${t(20, 298)}Z" fill="${fill}"/>`
    : `<path d="M${t(-14, 300)} L${t(-16, 396)} L${t(-4, 396)} L${t(-2, 304)}Z M${t(4, 300)} L${t(8, 396)} L${t(20, 396)} L${t(16, 298)}Z" fill="${fill}"/>`;
  return `<g>${legs}
<path d="M${t(-34, 92)} C${t(-46, 160)} ${t(-56, 250)} ${t(-60, 318)} L${t(56, 318)} C${t(50, 250)} ${t(44, 160)} ${t(32, 92)} C${t(18, 80)} ${t(-20, 80)} ${t(-34, 92)}Z" fill="${fill}"/>
<path d="M${t(-36, 96)} C${t(-50, 170)} ${t(-58, 250)} ${t(-60, 318)}" stroke="${rim}" stroke-opacity="${rimOp}" stroke-width="${f(3 * k)}" fill="none"/>
<path d="M${t(-10, 82)} L${t(-8, 64)} L${t(10, 64)} L${t(12, 82)}Z" fill="${fill}"/>
<ellipse cx="${f(x)}" cy="${f(y + 40 * k)}" rx="${f(25 * k)}" ry="${f(30 * k)}" fill="${fill}"/>
<path d="M${t(-26, 34)} C${t(-30, 0)} ${t(26, -4)} ${t(28, 36)} C${t(34, 70)} ${t(30, 96)} ${t(22, 108)} L${t(-22, 108)} C${t(-32, 90)} ${t(-32, 60)} ${t(-26, 34)}Z" fill="${fill}"/>
<path d="M${t(-27, 40)} C${t(-30, 70)} ${t(-30, 92)} ${t(-22, 108)}" stroke="${rim}" stroke-opacity="${rimOp}" stroke-width="${f(2.4 * k)}" fill="none"/>
</g>`;
}

function man(x: number, y: number, h: number, fill: string) {
  const k = h / 400, t = (px: number, py: number) => `${f(x + px * k)},${f(y + py * k)}`;
  return `<g fill="${fill}"><ellipse cx="${f(x)}" cy="${f(y + 44 * k)}" rx="${f(24 * k)}" ry="${f(28 * k)}"/>
<path d="M${t(-38, 24)} L${t(38, 24)} L${t(46, 34)} L${t(-46, 34)}Z"/><rect x="${f(x - 22 * k)}" y="${f(y - 4 * k)}" width="${f(44 * k)}" height="${f(30 * k)}" rx="${f(4 * k)}"/>
<path d="M${t(-50, 96)} C${t(-58, 180)} ${t(-60, 260)} ${t(-58, 330)} L${t(58, 330)} C${t(60, 260)} ${t(58, 180)} ${t(50, 96)} C${t(30, 80)} ${t(-30, 80)} ${t(-50, 96)}Z"/>
<path d="M${t(-20, 320)} L${t(-22, 398)} L${t(-6, 398)} L${t(-4, 320)}Z M${t(6, 320)} L${t(8, 398)} L${t(24, 398)} L${t(22, 320)}Z"/></g>`;
}

const neon = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${c}" filter="url(#b20)" opacity=".8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${c}" stroke-width="5"/><rect x="${x + 10}" y="${y + h / 2 - 3}" width="${w - 20}" height="6" rx="3" fill="${c}" opacity=".85"/>`;

export function artCity() {
  seed = 11;
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0f1d"/><stop offset=".55" stop-color="#1b2140"/><stop offset="1" stop-color="#3a2a3e"/></linearGradient>
<linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1a26"/><stop offset="1" stop-color="#07070c"/></linearGradient>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#sky)"/>
<ellipse cx="800" cy="560" rx="900" ry="160" fill="#ff8a5c" opacity=".18" filter="url(#b40)"/>
${skyline(600, 160, 420, "#121628", "#ffc98a", 0.9, 0.22)}
${skyline(640, 80, 240, "#0b0d18", "#ffd9a0", 1, 0.3)}
<rect y="640" width="${W}" height="260" fill="url(#road)"/>
<g opacity=".45" filter="url(#b8)">${skyline(640, 40, 120, "#ffb27a", "#ffb27a", 0, 0).replace(/height="([\d.]+)"/g, 'height="6"')}</g>
<g filter="url(#b3)"><rect x="300" y="650" width="10" height="240" fill="#ff5f8f" opacity=".35"/><rect x="1180" y="650" width="12" height="240" fill="#58c8ff" opacity=".3"/><rect x="760" y="650" width="8" height="240" fill="#ffc07a" opacity=".35"/></g>
${rain(520, .2)}`, W, H, defs);
}

export function artReturn(variant: "far" | "near" | "empty" = "far") {
  seed = 23;
  const defs = `<linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090b14"/><stop offset="1" stop-color="#1c1626"/></linearGradient>
<linearGradient id="wet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1724"/><stop offset="1" stop-color="#0a0a10"/></linearGradient>`;
  const fig = variant === "empty" ? "" : variant === "far" ? woman(800, 470, 230, "#07070b", "#ff9d6b", .55, true) : woman(820, 300, 520, "#07070b", "#ff9d6b", .6, true);
  return svg(`<rect width="${W}" height="${H}" fill="url(#sky2)"/>
<path d="M0 0 L560 0 L700 640 L0 900Z" fill="#141220"/><path d="M1600 0 L1040 0 L900 640 L1600 900Z" fill="#12101c"/>
${[0, 1, 2, 3, 4].map((i) => `<rect x="${60 + i * 90}" y="${120 + i * 70}" width="${70 - i * 6}" height="${90 - i * 8}" fill="#ffc27a" opacity="${.5 - i * .06}"/>`).join("")}
${[0, 1, 2, 3, 4].map((i) => `<rect x="${1470 - i * 90}" y="${140 + i * 70}" width="${60 - i * 6}" height="${80 - i * 8}" fill="#ffd59a" opacity="${.45 - i * .06}"/>`).join("")}
${neon(250, 260, 170, 60, "#ff4f8b")}${neon(1180, 230, 200, 64, "#3fd0ff")}${neon(470, 420, 90, 40, "#ffb84f")}${neon(1060, 400, 110, 44, "#b77bff")}
<path d="M0 900 L700 640 L900 640 L1600 900Z" fill="url(#wet)"/>
<g filter="url(#b8)" opacity=".55"><rect x="320" y="660" width="40" height="240" fill="#ff4f8b" transform="skewX(-12)"/><rect x="1300" y="650" width="46" height="250" fill="#3fd0ff" transform="skewX(14)"/><rect x="620" y="660" width="20" height="200" fill="#ffb84f"/></g>
<ellipse cx="800" cy="680" rx="260" ry="24" fill="#ff9d6b" opacity=".16" filter="url(#b20)"/>
${fig}
${rain(420, .18)}`, W, H, defs);
}

export function artMessage(lit = true) {
  seed = 37;
  const defs = `<linearGradient id="tbl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1712"/><stop offset="1" stop-color="#0b0806"/></linearGradient>
<linearGradient id="win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1730"/><stop offset="1" stop-color="#241a33"/></linearGradient>`;
  let bokeh = ""; for (let i = 0; i < 26; i++) bokeh += `<circle cx="${f(r(0, W))}" cy="${f(r(0, 420))}" r="${f(r(12, 46))}" fill="${["#ff6f9b", "#5ac8ff", "#ffbf6b", "#a98bff"][i % 4]}" opacity="${f(r(.08, .3))}" filter="url(#b8)"/>`;
  let wave = ""; if (lit) for (let i = 0; i < 34; i++) { const hh = 6 + Math.abs(Math.sin(i * .7) * 30) + (i % 5) * 3; wave += `<rect x="${f(718 + i * 5.2)}" y="${f(560 - hh / 2)}" width="3" height="${f(hh)}" rx="1.5" fill="#9fb8ff"/>`; }
  return svg(`<rect width="${W}" height="${H}" fill="url(#win)"/>${bokeh}${rain(260, .14, W, 470, 28)}
<rect y="430" width="${W}" height="470" fill="url(#tbl)"/>
<ellipse cx="800" cy="610" rx="${lit ? 360 : 200}" ry="${lit ? 150 : 80}" fill="#7f9cff" opacity="${lit ? .22 : .06}" filter="url(#b40)"/>
<g transform="rotate(-8 800 590)"><rect x="640" y="420" width="320" height="330" rx="40" fill="#050507"/><rect x="652" y="432" width="296" height="306" rx="32" fill="${lit ? "#0e1630" : "#06070b"}"/>
${lit ? `<text x="800" y="500" fill="#c9d4ff" font-family="Inter,Arial" font-size="20" text-anchor="middle" opacity=".8">Unknown number</text>${wave}<text x="800" y="640" fill="#c9d4ff" font-family="Inter,Arial" font-size="18" text-anchor="middle" opacity=".6">0:36</text>` : ""}</g>
<rect x="1100" y="560" width="200" height="40" rx="6" fill="#120e0b" opacity=".9"/>`, W, H, defs);
}

export function artEncounter() {
  seed = 41;
  const defs = `<linearGradient id="al" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0b10"/><stop offset="1" stop-color="#14121a"/></linearGradient>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#al)"/>
<path d="M0 0 L520 0 L640 700 L0 900Z" fill="#100f16"/><path d="M1600 0 L1080 0 L960 700 L1600 900Z" fill="#0d0c12"/>
<circle cx="800" cy="210" r="16" fill="#ffd9a0"/><circle cx="800" cy="210" r="140" fill="#ffb877" opacity=".25" filter="url(#b40)"/>
<path d="M800 220 L560 900 L1040 900Z" fill="#ffcf96" opacity=".07"/>
${man(800, 300, 340, "#050507")}
${woman(330, 230, 760, "#030305", "#ffb877", .35)}
<g stroke="#4a4a5a" stroke-width="3" opacity=".6"><line x1="1120" y1="120" x2="1120" y2="700"/><line x1="1160" y1="160" x2="1160" y2="680"/></g>
${rain(260, .12)}`, W, H, defs);
}

export function artRevelation() {
  seed = 53;
  let photos = "", pins: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const x = 150 + (i % 5) * 270 + r(-30, 30), y = 110 + Math.floor(i / 5) * 250 + r(-20, 20), rot = r(-9, 9);
    pins.push([x + 70, y + 8]);
    photos += `<g transform="rotate(${f(rot)} ${f(x + 70)} ${f(y + 90)})"><rect x="${f(x)}" y="${f(y)}" width="150" height="${i % 3 ? 180 : 110}" fill="#e9e1d1"/><rect x="${f(x + 10)}" y="${f(y + 10)}" width="130" height="${i % 3 ? 130 : 90}" fill="${["#3b3a42", "#53493f", "#2f3a45", "#4a3d3d"][i % 4]}"/>
${i % 3 ? `<ellipse cx="${f(x + 75)}" cy="${f(y + 60)}" rx="22" ry="27" fill="#1a1a1f" opacity=".85"/><rect x="${f(x + 45)}" y="${f(y + 88)}" width="60" height="52" rx="18" fill="#1a1a1f" opacity=".85"/>` : ""}</g>`;
  }
  let strings = "";
  [[0, 6], [6, 2], [2, 8], [8, 12], [6, 11], [3, 7], [7, 12], [1, 7]].forEach(([a, b]) => { strings += `<line x1="${f(pins[a][0])}" y1="${f(pins[a][1])}" x2="${f(pins[b][0])}" y2="${f(pins[b][1])}" stroke="#d6312e" stroke-width="3"/>`; });
  return svg(`<rect width="${W}" height="${H}" fill="#2a2119"/><rect width="${W}" height="${H}" fill="#6b5236" opacity=".35"/>
<ellipse cx="800" cy="420" rx="760" ry="420" fill="#ffcf8a" opacity=".18" filter="url(#b40)"/>${photos}${strings}
${pins.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="#c02a26"/>`).join("")}`, W, H);
}

export function artNewLead() {
  seed = 61;
  const defs = `<linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2140"/><stop offset=".55" stop-color="#6a5a7a"/><stop offset=".8" stop-color="#e59a72"/><stop offset="1" stop-color="#f6c48c"/></linearGradient>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#dawn)"/>
<ellipse cx="1060" cy="640" rx="520" ry="160" fill="#ffd9a0" opacity=".55" filter="url(#b40)"/>
${skyline(690, 60, 260, "#2a2236", "#ffd59a", 0.5, 0.08)}
<rect y="690" width="${W}" height="210" fill="#120f18"/><rect y="700" width="${W}" height="14" fill="#3a2d38"/>
${woman(470, 300, 560, "#0b0910", "#ffc28a", .7)}`, W, H, defs);
}

export function artElara() {
  seed = 71;
  const w = 900, h = 1200;
  const defs = `<linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2232"/><stop offset="1" stop-color="#0d0d14"/></linearGradient>`;
  return svg(`<rect width="${w}" height="${h}" fill="url(#pbg)"/><circle cx="640" cy="300" r="260" fill="#ff8f6b" opacity=".18" filter="url(#b40)"/>
<path d="M170 1200 C190 940 280 820 450 800 C620 820 710 940 730 1200Z" fill="#5a3b26"/>
<path d="M330 820 L450 1000 L570 820 C540 810 360 810 330 820Z" fill="#1a1824"/>
<path d="M400 690 L400 800 L500 800 L500 690Z" fill="#b98a6a"/>
<ellipse cx="450" cy="560" rx="125" ry="160" fill="#c99877"/>
<path d="M320 540 C300 360 600 330 590 540 C620 640 600 760 560 820 L560 600 C540 520 380 500 360 600 L350 820 C300 760 300 640 320 540Z" fill="#17121a"/>
<ellipse cx="405" cy="560" rx="14" ry="8" fill="#1b1414"/><ellipse cx="495" cy="560" rx="14" ry="8" fill="#1b1414"/>
<path d="M425 640 Q450 652 475 640" stroke="#7a4b3c" stroke-width="5" fill="none"/>
<text x="450" y="1150" fill="#f6f4f0" font-family="Inter,Arial" font-size="34" text-anchor="middle" opacity=".7" letter-spacing="6">ELARA</text>`, w, h, defs);
}

export function artDistrict() {
  return artReturn("empty"); // the same street without the walker
}

export function artApartment() {
  seed = 97;
  const defs = `<linearGradient id="ap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15121a"/><stop offset="1" stop-color="#0a090d"/></linearGradient>`;
  let bokeh = ""; for (let i = 0; i < 18; i++) bokeh += `<circle cx="${f(r(980, 1440))}" cy="${f(r(140, 560))}" r="${f(r(10, 30))}" fill="${["#ff6f9b", "#5ac8ff", "#ffbf6b"][i % 3]}" opacity="${f(r(.15, .4))}" filter="url(#b8)"/>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#ap)"/>
<rect x="940" y="100" width="540" height="500" fill="#0f1a33"/>${bokeh}${rain(140, .2, W, 600, 26).replace("<g ", '<g clip-path="none" ')}
<rect x="930" y="90" width="560" height="520" fill="none" stroke="#2a2430" stroke-width="22"/><line x1="1210" y1="90" x2="1210" y2="610" stroke="#2a2430" stroke-width="14"/>
<rect x="0" y="640" width="${W}" height="260" fill="#1a130e"/><rect x="180" y="420" width="420" height="240" rx="10" fill="#241b16"/>
<circle cx="300" cy="300" r="70" fill="#ffb877" opacity=".25" filter="url(#b40)"/><path d="M270 330 L330 330 L350 420 L250 420Z" fill="#3a2a20"/>`, W, H, defs);
}

export const svgBlob = (s: string) => new Blob([s], { type: "image/svg+xml" });
