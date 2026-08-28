import { useState, useRef, useMemo, useEffect } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { name: "BEIGE", hex: "#D4B488" },
  { name: "BLACK", hex: "#1A1A1A" },
  { name: "BLUE", hex: "#2563EB" },
  { name: "BROWN", hex: "#92400E" }, 
  { name: "GRAY", hex: "#6B7280" },
  { name: "GREEN", hex: "#16A34A" },
  { name: "PURPLE", hex: "#9333EA" },
  { name: "ORANGE", hex: "#EA580C" },
  { name: "PINK", hex: "#EC4899" },
  { name: "RED", hex: "#DC2626" },
  { name: "WHITE", hex: "#E5E5E5" },
  { name: "YELLOW", hex: "#EAB308" },
];

// ── Added "gondola" accent color ──
const ACCENT = { walls: "#3B82F6", tables: "#22C55E", browser: "#F97316", gondola: "#06B6D4", export: "#A855F7" };

function getHex(name) { return PRESET_COLORS.find(c => c.name === name)?.hex ?? "#888"; }
function textColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.52 ? "#111" : "#fff";
}
function uniqueSorted(arr) { return [...new Set(arr)].sort(); }
function nextKey(obj) { return Math.max(0, ...Object.keys(obj).map(Number)) + 1; }

// ── Added "gondola" to categorizeFile ──
function categorizeFile(name) {
  const n = name.toLowerCase();
  if (n.includes("wall")) return "wall";
  if (n.includes("table")) return "table";
  if (n.includes("browser")) return "browser";
  if (n.includes("gondola")) return "gondola";
  return null;
}



// ─── COLOR PICKER HELPERS ─────────────────────────────────────────────────────

// function nearestPresetColor(r, g, b) {
//   let best = PRESET_COLORS[0];
//   let bestDist = Infinity;
//   for (const c of PRESET_COLORS) {
//     const cr = parseInt(c.hex.slice(1, 3), 16);
//     const cg = parseInt(c.hex.slice(3, 5), 16);
//     const cb = parseInt(c.hex.slice(5, 7), 16);
//     const dist = Math.sqrt(
//       2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2
//     );
//     if (dist < bestDist) { bestDist = dist; best = c; }
//   }
//   return best;
// }

// ─── COLOR CLASSIFICATION HELPERS ────────────────────────────────────────────

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function nearestPresetColor(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b);

  // ── Achromatic first (low saturation) ──
  if (s < 12) {
    if (v > 78) return PRESET_COLORS.find(c => c.name === "WHITE");
    if (v < 22) return PRESET_COLORS.find(c => c.name === "BLACK");
    return PRESET_COLORS.find(c => c.name === "GRAY");
  }

  // ── Dark low-sat browns/beiges ──
  if (s < 35 && v < 55 && h >= 20 && h <= 50)
    return PRESET_COLORS.find(c => c.name === "BROWN");

  if (s < 40 && v >= 55 && v < 85 && h >= 20 && h <= 50)
    return PRESET_COLORS.find(c => c.name === "BEIGE");

  // ── Chromatic: classify by hue ──
  // Red wraps around 0°/360°
  if (h >= 345 || h < 12)  return PRESET_COLORS.find(c => c.name === "RED");
  if (h >= 12  && h < 22)  return PRESET_COLORS.find(c => c.name === "ORANGE");
  if (h >= 22  && h < 42)  return PRESET_COLORS.find(c => c.name === "YELLOW");  // orange-yellow edge
  if (h >= 42  && h < 75)  return PRESET_COLORS.find(c => c.name === "YELLOW");
  if (h >= 75  && h < 165) return PRESET_COLORS.find(c => c.name === "GREEN");
  if (h >= 165 && h < 255) return PRESET_COLORS.find(c => c.name === "BLUE");
  if (h >= 255 && h < 290) return PRESET_COLORS.find(c => c.name === "PURPLE");
  if (h >= 290 && h < 330) return PRESET_COLORS.find(c => c.name === "PINK");
  if (h >= 330 && h < 345) return PRESET_COLORS.find(c => c.name === "RED");

  // ── Fallback: nearest RGB (shouldn't normally reach here) ──
  let best = PRESET_COLORS[0], bestDist = Infinity;
  for (const c of PRESET_COLORS) {
    const cr = parseInt(c.hex.slice(1,3),16);
    const cg = parseInt(c.hex.slice(3,5),16);
    const cb = parseInt(c.hex.slice(5,7),16);
    const dist = Math.sqrt((r-cr)**2 + (g-cg)**2 + (b-cb)**2);
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}
 
// ─── IMAGE EXTRACTION HELPERS ────────────────────────────────────────────────

function extractRefImageUrl(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const r = extractRefImageUrl(item);
      if (r) return r;
    }
  } else {
    if (obj.type === "img" && obj.innerHtmlTemplate) {
      const m = obj.innerHtmlTemplate.match(/src=["']([^"']+)["']/);
      if (m) return m[1];
    }
    if (obj.innerHtmlTemplate) {
      const m = obj.innerHtmlTemplate.match(/href=["']([^"']+\.(jpg|jpeg|png|webp|gif))["']/i);
      if (m) return m[1];
    }
    for (const val of Object.values(obj)) {
      const r = extractRefImageUrl(val);
      if (r) return r;
    }
  }
  return null;
}

async function readRefImageFromHandle(handle) {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    return extractRefImageUrl(data);
  } catch {
    return null;
  }
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg: "#111318",
  card: "#1C1F26",
  cardHi: "#22262F",
  border: "#2E3340",
  borderHi: "#4A5168",
  text: "#E8EAF0",
  textSub: "#8892A4",
  textDim: "#4A5168",
  green: "#22C55E",
  blue: "#3B82F6",
  red: "#EF4444",
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function Label({ children, color }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
      textTransform: "uppercase", color: color || T.textSub,
      marginBottom: 8,
    }}>{children}</div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: 18, ...style,
    }}>{children}</div>
  );
}

function ColorSwatch({ name }) {
  const hex = getHex(name);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: 6, padding: "4px 10px 4px 6px", fontSize: 12,
    }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: hex, border: `1px solid ${T.border}`, flexShrink: 0 }} />
      <span style={{ color: T.text, fontWeight: 600 }}>{name}</span>
    </span>
  );
}

function ColorPill({ name, index }) {
  const hex = getHex(name);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: T.bg, border: `1px solid ${T.border}`,
      borderRadius: 7, padding: "5px 10px 5px 6px", fontSize: 12,
    }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: hex, border: `1px solid ${T.borderHi}`, flexShrink: 0 }} />
      {index !== undefined && (
        <span style={{ color: T.textDim, fontSize: 10, fontWeight: 700, minWidth: 16 }}>{index + 1}.</span>
      )}
      <span style={{ color: T.text, fontWeight: 600, letterSpacing: "0.03em" }}>{name}</span>
    </div>
  );
}

function ColorButton({ name, onClick, active }) {
  const hex = getHex(name);
  const [hov, setHov] = useState(false);
  const isOn = active !== undefined ? active : false;
  return (
    <button onClick={() => onClick(name)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hex, color: textColor(hex),
        border: isOn ? "2px solid #FFF" : "2px solid transparent",
        borderRadius: 9, padding: "11px 6px", fontSize: 11,
        fontWeight: 800, letterSpacing: "0.06em", cursor: "pointer",
        textTransform: "uppercase", fontFamily: "inherit",
        transform: hov ? "scale(1.08)" : "scale(1)",
        boxShadow: hov ? `0 0 24px ${hex}DD, 0 0 8px ${hex}99` : `0 0 6px ${hex}44`,
        transition: "all 0.13s", position: "relative",
        opacity: isOn ? 1 : hov ? 1 : 0.85,
      }}
    >
      {isOn && <span style={{ position: "absolute", top: 3, right: 4, fontSize: 10 }}>✓</span>}
      {name}
    </button>
  );
}

function PalettePanel({ onAdd, toggleMode, selected, pickerMode, onTogglePicker }) {
  const [custom, setCustom] = useState("");
  const addCustom = () => { const v = custom.trim().toUpperCase(); if (v) { onAdd(v); setCustom(""); } };
  return (
    <Card style={{ width: 248, flexShrink: 0 }}>
      <Label>{toggleMode ? "Toggle Colors" : "Color Palette"}</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {PRESET_COLORS.map(c => (
          <ColorButton key={c.name} name={c.name} onClick={onAdd}
            active={toggleMode ? selected?.has(c.name) : undefined} />
        ))}
      </div>

      {onTogglePicker && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
          <button
            onClick={onTogglePicker}
            title={pickerMode ? "Click to deactivate picker" : "Activate: click on the reference image to pick a color"}
            style={{
              width: "100%",
              background: pickerMode ? "#1E3A2A" : T.cardHi,
              color: pickerMode ? T.green : T.textSub,
              border: `2px solid ${pickerMode ? T.green : T.border}`,
              borderRadius: 9, padding: "10px 0",
              cursor: "pointer", fontSize: 12, fontWeight: 800,
              fontFamily: "inherit", letterSpacing: "0.06em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.15s",
              boxShadow: pickerMode ? `0 0 14px ${T.green}44` : "none",
            }}
          >
            <span style={{ fontSize: 16 }}>🔬</span>
            {pickerMode ? "Picker ON — click image" : "Color Picker"}
            {pickerMode && (
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: T.green,
                animation: "pulse 1s infinite",
              }} />
            )}
          </button>
          {pickerMode && (
            <div style={{ fontSize: 10, color: T.green + "99", textAlign: "center", marginTop: 6, lineHeight: 1.5 }}>
              Hover &amp; click on the clothes image →<br />color auto-selects. Click button again to stop.
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
        <Label>Custom Color</Label>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={custom} onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustom()} placeholder="e.g. CORAL"
            style={{
              flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 7,
              color: T.text, padding: "9px 11px", fontSize: 12,
              fontFamily: "inherit", outline: "none", textTransform: "uppercase",
              transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = T.blue}
            onBlur={e => e.target.style.borderColor = T.border}
          />
          <button onClick={addCustom} style={{
            background: T.blue, color: "#fff", border: "none",
            borderRadius: 7, padding: "9px 14px", cursor: "pointer",
            fontWeight: 800, fontSize: 16, lineHeight: 1,
          }}>+</button>
        </div>
      </div>
    </Card>
  );
}

function ProfileTabs({ keys, active, onSelect, onAdd, onDelete, label }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
      {keys.map(k => (
        <div key={k} style={{ display: "flex" }}>
          <button onClick={() => onSelect(k)} style={{
            background: active === k ? T.blue : T.card,
            color: active === k ? "#fff" : T.textSub,
            border: `1px solid ${active === k ? T.blue : T.border}`,
            borderRadius: "8px 0 0 8px", padding: "7px 14px",
            cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
            fontFamily: "inherit", transition: "all 0.12s",
          }}>{label} {k}</button>
          <button onClick={() => onDelete(k)} disabled={keys.length === 1} style={{
            background: active === k ? "#2A1A1A" : T.card,
            color: T.red, border: `1px solid ${active === k ? T.blue : T.border}`,
            borderLeft: "none", borderRadius: "0 8px 8px 0", padding: "7px 9px",
            cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            opacity: keys.length === 1 ? 0.2 : 1, transition: "all 0.12s",
          }}>✕</button>
        </div>
      ))}
      <button onClick={onAdd}
        onMouseEnter={e => e.currentTarget.style.background = "#22C55E18"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        style={{
          background: "transparent", color: T.green,
          border: `1px dashed ${T.green}88`, borderRadius: 8,
          padding: "7px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.06em", fontFamily: "inherit", transition: "background 0.12s",
        }}
      >+ NEW {label}</button>
    </div>
  );
}

function SequenceArea({ sequence, onUndo, onClear }) {
  return (
    <Card style={{ minHeight: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Label style={{ margin: 0 }}>
          Color Sequence
          <span style={{ color: T.blue, marginLeft: 6, fontWeight: 800 }}>[{sequence.length}]</span>
        </Label>
        <div style={{ display: "flex", gap: 6 }}>
          <SmBtn onClick={onUndo} disabled={!sequence.length}>↩ Undo</SmBtn>
          <SmBtn onClick={onClear} disabled={!sequence.length} danger>✕ Clear</SmBtn>
        </div>
      </div>
      {sequence.length === 0
        ? <div style={{
          color: T.textDim, fontSize: 13, textAlign: "center", padding: "20px 0",
          border: `1px dashed ${T.border}`, borderRadius: 8,
        }}>Click a color from the palette to begin →</div>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sequence.map((c, i) => <ColorPill key={i} name={c} index={i} />)}
        </div>
      }
    </Card>
  );
}

function SmBtn({ onClick, disabled, danger, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: danger ? "#2A1010" : T.cardHi,
      color: danger ? T.red : T.textSub,
      border: `1px solid ${danger ? T.red + "44" : T.border}`,
      borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11,
      fontWeight: 600, fontFamily: "inherit", letterSpacing: "0.04em",
      opacity: disabled ? 0.3 : 1, transition: "all 0.12s",
    }}>{children}</button>
  );
}

function MiniPreview({ label, count, colors, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        marginTop: 8, background: hov ? T.cardHi : T.card,
        border: `1px solid ${hov ? T.borderHi : T.border}`,
        borderRadius: 9, padding: "10px 14px", cursor: "pointer", transition: "all 0.12s",
      }}
    >
      <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginBottom: 7 }}>
        {label}
        <span style={{ color: T.textDim, fontWeight: 400, marginLeft: 6 }}>{count} colors</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {colors.map((c, i) => (
          <div key={i} title={c} style={{
            width: 18, height: 18, borderRadius: 4,
            background: getHex(c), border: `1px solid ${T.border}`,
          }} />
        ))}
        {colors.length === 0 && <span style={{ color: T.textDim, fontSize: 11 }}>Empty — click to add colors</span>}
      </div>
    </div>
  );
}

function GenerateBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#fff" : "#F0F2F8",
        color: "#111", border: "none", borderRadius: 9,
        padding: "11px 26px", fontSize: 12, fontWeight: 800,
        letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit",
        textTransform: "uppercase", boxShadow: hov ? "0 4px 20px #0006" : "0 2px 8px #0004",
        transition: "all 0.13s",
      }}
    >⬡ Generate JSON</button>
  );
}

function JsonOutput({ data, label }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Label>{label}</Label>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          style={{
            background: copied ? T.green : T.cardHi,
            color: copied ? "#000" : T.green,
            border: `1px solid ${T.green}66`, borderRadius: 6,
            padding: "5px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700,
            fontFamily: "inherit", letterSpacing: "0.06em", transition: "all 0.18s",
          }}
        >{copied ? "✓ Copied!" : "Copy"}</button>
      </div>
      <pre style={{
        background: "#0D0F14", border: `1px solid ${T.border}`, borderRadius: 10,
        padding: 18, margin: 0, fontSize: 12.5, lineHeight: 1.85,
        color: "#86EFAC", overflowX: "auto", whiteSpace: "pre-wrap",
        wordBreak: "break-word", fontFamily: "'Courier New',monospace",
      }}>{text}</pre>
    </div>
  );
}


// ─── MAGNIFIER IMAGE ──────────────────────────────────────────────────────────

// const LENS_SIZE = 180;
// const ZOOM_MIN = 1.5;
// const ZOOM_MAX = 10;

// function MagnifierImage({ imageUrl, loaded, setLoaded, setError, border, textDim, pickerMode, onColorPick, zoom, setZoom }) {
//   const imgRef = useRef(null);
//   const canvasRef = useRef(null);
//   const [pos, setPos] = useState({ x: 0, y: 0 });
//   const [canvasReady, setCanvasReady] = useState(false); // ← ADD THIS
//   const [show, setShow] = useState(false);
//   const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
//   const [hoverColor, setHoverColor] = useState(null);
//   const [flash, setFlash] = useState(null);
//   // const [zoom, setZoom] = useState(3); // scroll wheel changes this

//   const onImgLoad = () => {
//     setLoaded(true);
//   };

//   const onMove = (e) => {
//     const img = imgRef.current;
//     if (!img) return;
//     const rect = img.getBoundingClientRect();
//     setImgSize({ w: rect.width, h: rect.height });
//     const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
//     const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
//     setPos({ x, y });

//     if (pickerMode) {
//       const sample = samplePixel(x, y, rect);
//       if (sample) setHoverColor(sample);
//     }
//   };

//   const samplePixel = (cx, cy, rect) => {
//     console.log("Sampling pixel at:", { cx, cy, rect });
//     const canvas = canvasRef.current;
//     const img = imgRef.current;

//     if (!canvas || !img) return null;
//     try {
//       const ctx = canvas.getContext("2d", { willReadFrequently: true });
//       const natW = img.naturalWidth || rect.width;
//       const natH = img.naturalHeight || rect.height;
//       const scale = Math.min(rect.width / natW, rect.height / natH);
//       const offX = (rect.width - natW * scale) / 2;
//       const offY = (rect.height - natH * scale) / 2;
//       const imgX = Math.round((cx - offX) / scale);
//       const imgY = Math.round((cy - offY) / scale);
//       console.log("Mapped to natural image coords:", { imgX, imgY, natW, natH, scale, offX, offY });
//       if (imgX < 0 || imgY < 0 || imgX >= natW || imgY >= natH) return null;
//       if (canvas.width !== natW || canvas.height !== natH) {
//         canvas.width = natW;
//         canvas.height = natH;
//         ctx.clearRect(0, 0, natW, natH);
//         ctx.drawImage(img, 0, 0, natW, natH);
//       }
//       console.log("SUmit::::::::::", ctx.getImageData(imgX, imgY, 1, 1))
//       const px = ctx.getImageData(imgX, imgY, 1, 1)?.data;
//       console.log(px, 'px:::');
//       if (px[3] < 10) return null;
//       return nearestPresetColor(px[0], px[1], px[2]);
//     } catch (err) {
//       console.error(err);
//       console.error("Failed to sample pixel color. This can happen if the image is from a different origin and CORS headers are not set to allow access. To fix this, ensure the image server includes appropriate CORS headers (e.g., Access-Control-Allow-Origin: *).");
//       return null;
//     }
//   };

//   const onPickClick = (e) => {
//     if (!pickerMode) return;
//     const img = imgRef.current;
//     if (!img) return;
//     const rect = img.getBoundingClientRect();
//     const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
//     const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
//     const picked = samplePixel(x, y, rect);
//     if (picked) {
//       onColorPick && onColorPick(picked.name);
//       setFlash(picked);
//       setTimeout(() => setFlash(null), 900);
//     }
//   };

//   const bgPosX = -(pos.x * zoom - LENS_SIZE / 2);
//   const bgPosY = -(pos.y * zoom - LENS_SIZE / 2);
//   const bgW = (imgSize.w || 300) * zoom;
//   const bgH = (imgSize.h || 300) * zoom;

// //  const onWheel = (e) => {
// //   e.preventDefault();
// //   e.stopPropagation(); // ← Add this line
// //   setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * 0.005)));
// // };

//   const lensLeft = Math.max(0, Math.min(pos.x - LENS_SIZE / 2, (imgSize.w || 300) - LENS_SIZE));
//   const lensTop = Math.max(0, Math.min(pos.y - LENS_SIZE / 2, (imgSize.h || 300) - LENS_SIZE));

//   const convertOnlineImageToLocalUrl = async (imageUrl) => {
//     try {
//       const response = await fetch(imageUrl);
//       const blob = await response.blob();
//       const localUrl = URL.createObjectURL(blob);
//       console.log("Local URL:", localUrl);
//       return localUrl;
//     } catch (error) {
//       console.error("Error:", error);
//     }
//   };
//   const [finalImgUrl, setFinalImgUrl] = useState();
//   useEffect(() => {
//     convertOnlineImageToLocalUrl(imageUrl)
//       .then(setFinalImgUrl)
//       .catch(console.error);
//   }, [imageUrl]);

//   return (
//     <div style={{ position: "relative", userSelect: "none" }}>
//       <canvas ref={canvasRef} style={{ display: "none" }} />

//       {!loaded && (
//         <div style={{
//           height: 220, display: "flex", alignItems: "center", justifyContent: "center",
//           color: textDim, fontSize: 12, border: `1px dashed ${border}`, borderRadius: 8,
//         }}>⏳ Loading…</div>
//       )}

//       <img
//         ref={imgRef}
//         crossOrigin="anonymous"
//         // src={`https://cors-anywhere.herokuapp.com/${imageUrl}`}

//         src={imageUrl}

//         onLoad={onImgLoad}
//         alt="Reference"
//         onError={() => setError(true)}
//         onMouseMove={onMove}
//         onMouseEnter={() => setShow(true)}
//         onMouseLeave={() => setShow(false)}
//         // onWheel={onWheel}
//         onClick={onPickClick}
//         draggable={false}
//         style={{
//           display: loaded ? "block" : "none",
//           width: "100%", borderRadius: 8,
//           border: `2px solid ${pickerMode ? T.green + "99" : border}`,
//           objectFit: "contain",
//           cursor: pickerMode ? "crosshair" : "default",
//           transition: "border-color 0.2s",
//         }}
//       />

//       {loaded && pickerMode && !show && (
//         <div style={{
//           position: "absolute", bottom: 8, left: 8, right: 8,
//           background: "rgba(34,197,94,0.18)", border: `1px solid ${T.green}66`,
//           borderRadius: 7, padding: "5px 10px",
//           fontSize: 11, color: T.green, fontWeight: 700,
//           textAlign: "center", pointerEvents: "none",
//           backdropFilter: "blur(2px)",
//         }}>
//           🔬 Picker active — click to sample color
//         </div>
//       )}

//       {flash && (
//         <div style={{
//           position: "absolute", top: "50%", left: "50%",
//           transform: "translate(-50%,-50%)",
//           background: flash.hex, color: textColor(flash.hex),
//           borderRadius: 10, padding: "10px 20px",
//           fontSize: 13, fontWeight: 800, letterSpacing: "0.08em",
//           boxShadow: `0 4px 24px ${flash.hex}99`,
//           pointerEvents: "none", zIndex: 200,
//           border: "2px solid rgba(255,255,255,0.4)",
//           animation: "fadeOut 0.9s ease forwards",
//         }}>
//           ✓ {flash.name}
//         </div>
//       )}
//       {show && loaded && (
//         <div style={{
//           position: "absolute",
//           left: lensLeft,
//           top: lensTop,
//           width: LENS_SIZE,
//           height: LENS_SIZE,
//           pointerEvents: "none",
//           zIndex: 99,
//           borderRadius: 6,
//           outline: "2px solid rgba(255,255,255,0.85)",
//           boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.7)",
//           backgroundImage: `url(${imageUrl})`,
//           backgroundRepeat: "no-repeat",
//           backgroundSize: `${bgW}px ${bgH}px`,
//           backgroundPosition: `${bgPosX}px ${bgPosY}px`,
//           backgroundBlendMode: "normal",
//         }}>
//           <div style={{
//             position: "absolute", inset: 0, pointerEvents: "none",
//             backgroundImage: `
//               linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px),
//               linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)
//             `,
//             backgroundSize: "30px 30px",
//             borderRadius: 6,
//           }} />
//           <div style={{
//             position: "absolute",
//             left: "50%", top: "50%",
//             transform: "translate(-50%,-50%)",
//             width: 6, height: 6,
//             borderRadius: "50%",
//             background: "rgba(255,255,255,0.9)",
//             boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
//           }} />
//           {/* zoom level badge */}
//           <div style={{
//             position: "absolute", bottom: 4, right: 6,
//             fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.85)",
//             textShadow: "0 1px 3px rgba(0,0,0,0.9)",
//             letterSpacing: "0.04em", pointerEvents: "none",
//           }}>{zoom.toFixed(1)}×</div>
//         </div>
//       )}

//       {loaded && (
//         <div style={{
//           marginTop: 6, fontSize: 9, color: textDim,
//           wordBreak: "break-all", lineHeight: 1.4
//         }}>
//           {imageUrl}
//         </div>
//       )}
//     </div>
//   );
// }

// ─── REFERENCE IMAGE PANEL ───────────────────────────────────────────────────


const LENS_SIZE = 180;
const ZOOM_MIN = 1.5;
const ZOOM_MAX = 10;

function MagnifierImage({ imageUrl, loaded, setLoaded, setError, border, textDim, pickerMode, onColorPick, zoom, setZoom }) {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [canvasReady, setCanvasReady] = useState(false); // ✨ FIX #2: ADD THIS
  const [show, setShow] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [hoverColor, setHoverColor] = useState(null);
  const [flash, setFlash] = useState(null);

  // ✨ FIX #2: UPDATE onImgLoad to draw canvas once
  const onImgLoad = () => {
    setLoaded(true);
    
    // NEW: Draw canvas immediately
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (canvas && img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      setCanvasReady(true); // Mark ready
    }
  };

  const onMove = (e) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setImgSize({ w: rect.width, h: rect.height });
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setPos({ x, y });

    if (pickerMode) {
      const sample = samplePixel(x, y, rect);
      if (sample) setHoverColor(sample);
    }
  };

  // ✨ FIX #2: UPDATE samplePixel to skip canvas redraw
  const samplePixel = (cx, cy, rect) => {
    if (!canvasReady) return null; // ✨ CHECK if ready
    
    const canvas = canvasRef.current;
    const img = imgRef.current;

    if (!canvas || !img) return null;
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const natW = img.naturalWidth || rect.width;
      const natH = img.naturalHeight || rect.height;
      const scale = Math.min(rect.width / natW, rect.height / natH);
      const offX = (rect.width - natW * scale) / 2;
      const offY = (rect.height - natH * scale) / 2;
      const imgX = Math.round((cx - offX) / scale);
      const imgY = Math.round((cy - offY) / scale);
      
      if (imgX < 0 || imgY < 0 || imgX >= natW || imgY >= natH) return null;
      
      // ✨ DELETE THESE LINES (they redraw canvas every mousemove):
      // if (canvas.width !== natW || canvas.height !== natH) {
      //   canvas.width = natW;
      //   canvas.height = natH;
      //   ctx.clearRect(0, 0, natW, natH);
      //   ctx.drawImage(img, 0, 0, natW, natH);
      // }
      
      const px = ctx.getImageData(imgX, imgY, 1, 1)?.data;
      if (px[3] < 10) return null;
      return nearestPresetColor(px[0], px[1], px[2]);
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const onPickClick = (e) => {
    if (!pickerMode) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const picked = samplePixel(x, y, rect);
    if (picked) {
      onColorPick && onColorPick(picked.name);
      setFlash(picked);
      setTimeout(() => setFlash(null), 900);
    }
  };

  const bgPosX = -(pos.x * zoom - LENS_SIZE / 2);
  const bgPosY = -(pos.y * zoom - LENS_SIZE / 2);
  const bgW = (imgSize.w || 300) * zoom;
  const bgH = (imgSize.h || 300) * zoom;

  const lensLeft = Math.max(0, Math.min(pos.x - LENS_SIZE / 2, (imgSize.w || 300) - LENS_SIZE));
  const lensTop = Math.max(0, Math.min(pos.y - LENS_SIZE / 2, (imgSize.h || 300) - LENS_SIZE));

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!loaded && (
        <div style={{
          height: 220, display: "flex", alignItems: "center", justifyContent: "center",
          color: textDim, fontSize: 12, border: `1px dashed ${border}`, borderRadius: 8,
        }}>⏳ Loading…</div>
      )}

      <img
        ref={imgRef}
        crossOrigin="anonymous"
        src={imageUrl}  // ✨ FIX #1: REMOVED https://cors-anywhere.herokuapp.com/ prefix
        onLoad={onImgLoad}
        alt="Reference"
        onError={() => setError(true)}
        onMouseMove={onMove}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={onPickClick}
        draggable={false}
        style={{
          display: loaded ? "block" : "none",
          width: "100%", borderRadius: 8,
          border: `2px solid ${pickerMode ? T.green + "99" : border}`,
          objectFit: "contain",
          cursor: pickerMode ? "crosshair" : "default",
          transition: "border-color 0.2s",
        }}
      />

      {loaded && pickerMode && !show && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, right: 8,
          background: "rgba(34,197,94,0.18)", border: `1px solid ${T.green}66`,
          borderRadius: 7, padding: "5px 10px",
          fontSize: 11, color: T.green, fontWeight: 700,
          textAlign: "center", pointerEvents: "none",
          backdropFilter: "blur(2px)",
        }}>
          🔬 Picker active — click to sample color
        </div>
      )}

      {flash && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          background: flash.hex, color: textColor(flash.hex),
          borderRadius: 10, padding: "10px 20px",
          fontSize: 13, fontWeight: 800, letterSpacing: "0.08em",
          boxShadow: `0 4px 24px ${flash.hex}99`,
          pointerEvents: "none", zIndex: 200,
          border: "2px solid rgba(255,255,255,0.4)",
          animation: "fadeOut 0.9s ease forwards",
        }}>
          ✓ {flash.name}
        </div>
      )}
      
      {show && loaded && (
        <div style={{
          position: "absolute",
          left: lensLeft,
          top: lensTop,
          width: LENS_SIZE,
          height: LENS_SIZE,
          pointerEvents: "none",
          zIndex: 99,
          borderRadius: 6,
          outline: "2px solid rgba(255,255,255,0.85)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.7)",
          backgroundImage: `url(${imageUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${bgW}px ${bgH}px`,
          backgroundPosition: `${bgPosX}px ${bgPosY}px`,
          backgroundBlendMode: "normal",
        }}>
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)
            `,
            backgroundSize: "30px 30px",
            borderRadius: 6,
          }} />
          <div style={{
            position: "absolute",
            left: "50%", top: "50%",
            transform: "translate(-50%,-50%)",
            width: 6, height: 6,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }} />
          <div style={{
            position: "absolute", bottom: 4, right: 6,
            fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.85)",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            letterSpacing: "0.04em", pointerEvents: "none",
          }}>{zoom.toFixed(1)}×</div>
        </div>
      )}

      {loaded && (
        <div style={{
          marginTop: 6, fontSize: 9, color: textDim,
          wordBreak: "break-all", lineHeight: 1.4
        }}>
          {imageUrl}
        </div>
      )}
    </div>
  );
}


//  function ReferenceImagePanel({ imageUrl, fileName, onColorPick, pickerMode }) {
//   const [loaded, setLoaded] = useState(false);
//   const [error, setError] = useState(false);
//   const [zoom, setZoom] = useState(3);
//   const panelRef = useRef(null);  // ← ADD THIS
 
//   const [prevUrl, setPrevUrl] = useState(null);
//   if (imageUrl !== prevUrl) { setPrevUrl(imageUrl); setLoaded(false); setError(false); }
 
//   // ← ADD THIS ENTIRE useEffect BLOCK
//   useEffect(() => {
//     const panel = panelRef.current;
//     if (!panel) return;
 
//     const handleWheel = (e) => {
//       if (loaded && imageUrl && !error) {
//         e.preventDefault();
//         e.stopPropagation();
//         setZoom(z => Math.min(10, Math.max(1.5, z - e.deltaY * 0.005)));
//       }
//     };
 
//     // passive: false is CRITICAL - allows preventDefault() to work
//     panel.addEventListener('wheel', handleWheel, { passive: false });
 
//     return () => {
//       panel.removeEventListener('wheel', handleWheel);
//     };
//   }, [loaded, imageUrl, error]);
 
//   return (
//     <div 
//       ref={panelRef}  // ← ADD THIS
//       style={{
//         flex: "1 1 400px",
//         minWidth: 540,
//         maxWidth: 1200,
//         position: "sticky", 
//         top: 70,
//         alignSelf: "flex-start",
//       }}
//       // ← REMOVE onWheel={handlePanelWheel}
//     >
//       <div style={{
//         background: T.card,
//         border: `1px solid ${imageUrl ? T.green + "66" : T.border}`,
//         borderRadius: 12,
//         overflow: "hidden",
//         transition: "border-color 0.2s",
//       }}>
//         <div style={{
//           background: imageUrl ? "#0D1F12" : T.card,
//           borderBottom: `1px solid ${T.border}`,
//           padding: "10px 14px",
//           display: "flex", alignItems: "center", justifyContent: "space-between",
//         }}>
//           <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
//             <span style={{ fontSize: 14 }}>🖼️</span>
//             <div>
//               <div style={{
//                 fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", 
//                 textTransform: "uppercase",
//                 color: imageUrl ? T.green : T.textDim,
//               }}>
//                 Reference Image
//               </div>
//               {fileName && (
//                 <div style={{
//                   fontSize: 9, color: T.textDim, marginTop: 1,
//                   whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300
//                 }}>
//                   {fileName}
//                 </div>
//               )}
//             </div>
//           </div>
//           {imageUrl && (
//             <a href={imageUrl} target="_blank" rel="noreferrer" style={{
//               fontSize: 9, color: T.blue, border: `1px solid ${T.blue}44`,
//               borderRadius: 4, padding: "2px 7px", textDecoration: "none",
//               fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0,
//             }}>↗</a>
//           )}
//         </div>

//         <div style={{ padding: 12, minHeight: 200 }}>
//           {!imageUrl ? (
//             <div style={{
//               height: 600,
//               display: "flex", flexDirection: "column",
//               alignItems: "center", justifyContent: "center", gap: 10,
//               border: `1px dashed ${T.border}`, borderRadius: 8,
//             }}>
//               <span style={{ fontSize: 28, opacity: 0.3 }}>🖼️</span>
//               <div style={{ fontSize: 11, color: T.textDim, textAlign: "center", lineHeight: 1.6 }}>
//                 Link a file to see its<br />reference image here
//               </div>
//             </div>
//           ) : error ? (
//             <div style={{
//               height: 420, display: "flex", flexDirection: "column",
//               alignItems: "center", justifyContent: "center", gap: 12,
//               padding: "24px 12px", textAlign: "center",
//               border: `1px dashed ${T.border}`, borderRadius: 8,
//             }}>
//               <div style={{ fontSize: 11, color: T.textDim, marginBottom: 10 }}>
//                 Image blocked by CORS
//               </div>
//               <a href={imageUrl} target="_blank" rel="noreferrer" style={{
//                 fontSize: 11, color: T.blue, fontWeight: 700, textDecoration: "none",
//                 border: `1px solid ${T.blue}44`, borderRadius: 6, padding: "6px 14px",
//                 display: "inline-block",
//               }}>↗ Open in browser</a>
//             </div>
//           ) : (
//             <MagnifierImage
//               imageUrl={imageUrl}
//               loaded={loaded} setLoaded={setLoaded} setError={setError}
//               border={T.border} textDim={T.textDim}
//               pickerMode={pickerMode} onColorPick={onColorPick}
//                 zoom={zoom} setZoom={setZoom}
//             />
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// ─── FILE LINKER ──────────────────────────────────────────────────────────────

function ReferenceImagePanel({ imageUrl, fileName, onColorPick, pickerMode }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(3);
  const panelRef = useRef(null); // ✨ FIX #3: ADD THIS

  const [prevUrl, setPrevUrl] = useState(null);
  if (imageUrl !== prevUrl) { setPrevUrl(imageUrl); setLoaded(false); setError(false); }

  // ✨ FIX #3: ADD THIS ENTIRE useEffect BLOCK
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const handleWheel = (e) => {
      if (loaded && imageUrl && !error) {
        e.preventDefault();
        e.stopPropagation();
        setZoom(z => Math.min(10, Math.max(1.5, z - e.deltaY * 0.005)));
      }
    };

    // CRITICAL: { passive: false } allows preventDefault()
    panel.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      panel.removeEventListener('wheel', handleWheel);
    };
  }, [loaded, imageUrl, error]);

  return (
    <div 
      ref={panelRef}  // ✨ FIX #3: ADD THIS
      style={{
        flex: "1 1 400px",
        minWidth: 540,
        maxWidth: 1200,
        position: "sticky", 
        top: 70,
        alignSelf: "flex-start",
      }}
    >
      <div style={{
        background: T.card,
        border: `1px solid ${imageUrl ? T.green + "66" : T.border}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}>
        <div style={{
          background: imageUrl ? "#0D1F12" : T.card,
          borderBottom: `1px solid ${T.border}`,
          padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>🖼️</span>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", 
                textTransform: "uppercase",
                color: imageUrl ? T.green : T.textDim,
              }}>
                Reference Image
              </div>
              {fileName && (
                <div style={{
                  fontSize: 9, color: T.textDim, marginTop: 1,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300
                }}>
                  {fileName}
                </div>
              )}
            </div>
          </div>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noreferrer" style={{
              fontSize: 9, color: T.blue, border: `1px solid ${T.blue}44`,
              borderRadius: 4, padding: "2px 7px", textDecoration: "none",
              fontWeight: 700, letterSpacing: "0.06em", flexShrink: 0,
            }}>↗</a>
          )}
        </div>

        <div style={{ padding: 12, minHeight: 200 }}>
          {!imageUrl ? (
            <div style={{
              height: 600,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
              border: `1px dashed ${T.border}`, borderRadius: 8,
            }}>
              <span style={{ fontSize: 28, opacity: 0.3 }}>🖼️</span>
              <div style={{ fontSize: 11, color: T.textDim, textAlign: "center", lineHeight: 1.6 }}>
                Link a file to see its<br />reference image here
              </div>
            </div>
          ) : error ? (
            <div style={{
              height: 420, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              padding: "24px 12px", textAlign: "center",
              border: `1px dashed ${T.border}`, borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 10 }}>
                Image blocked by CORS
              </div>
              <a href={imageUrl} target="_blank" rel="noreferrer" style={{
                fontSize: 11, color: T.blue, fontWeight: 700, textDecoration: "none",
                border: `1px solid ${T.blue}44`, borderRadius: 6, padding: "6px 14px",
                display: "inline-block",
              }}>↗ Open in browser</a>
            </div>
          ) : (
            <MagnifierImage
              imageUrl={imageUrl}
              loaded={loaded} setLoaded={setLoaded} setError={setError}
              border={T.border} textDim={T.textDim}
              pickerMode={pickerMode} onColorPick={onColorPick}
              zoom={zoom} setZoom={setZoom}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FileLinker({ files, linkedFile, onLink, onSave, saveReady, saving, saveStatus }) {
  if (!files || files.length === 0) return null;

  const currentIndex = linkedFile
    ? files.findIndex(f => f.name === linkedFile.name && f.folder === linkedFile.folder)
    : -1;

  const go = dir => {
    const next = currentIndex < 0 ? 0 : (currentIndex + dir + files.length) % files.length;
    onLink(files[next]);
  };

  return (
    <div style={{
      marginTop: 14, background: T.bg,
      border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden",
    }}>
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.border}`,
        padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, letterSpacing: "0.08em" }}>
          📁 SELECT TARGET FILE
          <span style={{ color: T.textDim, fontWeight: 400, marginLeft: 8 }}>{files.length} files found</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: T.textDim, fontFamily: "'Courier New',monospace" }}>
            {currentIndex >= 0 ? `${currentIndex + 1} / ${files.length}` : `— / ${files.length}`}
          </span>
          {[["‹", -1], ["›", 1]].map(([arrow, dir]) => (
            <button key={arrow} onClick={() => go(dir)} style={{
              background: T.cardHi, color: T.text, border: `1px solid ${T.border}`,
              borderRadius: 6, width: 30, height: 30, cursor: "pointer",
              fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, transition: "all 0.12s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = T.blue; e.currentTarget.style.borderColor = T.blue; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.cardHi; e.currentTarget.style.borderColor = T.border; }}
            >{arrow}</button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {files.map((f, i) => {
          const isSel = f.name === linkedFile?.name && f.folder === linkedFile?.folder;
          return (
            <div key={f.folder + "/" + f.name} onClick={() => onLink(f)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 16px",
                background: isSel ? "#1A2540" : "transparent",
                borderLeft: `3px solid ${isSel ? T.blue : "transparent"}`,
                borderBottom: `1px solid ${T.border}`,
                cursor: "pointer", transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = T.card; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{
                fontSize: 10, color: T.textDim, width: 20, textAlign: "right",
                flexShrink: 0, fontFamily: "'Courier New',monospace", fontWeight: 700,
              }}>{i + 1}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: isSel ? "#93C5FD" : T.text,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{f.name}</div>
                {f.folder && f.folder !== "root" && (
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
                    📁 {f.folder}
                  </div>
                )}
              </div>

              {isSel
                ? <span style={{
                  fontSize: 10, fontWeight: 700, color: T.blue,
                  background: "#1E3A6E", border: `1px solid ${T.blue}66`,
                  borderRadius: 5, padding: "3px 8px", flexShrink: 0,
                }}>LINKED</span>
                : <span style={{ fontSize: 10, color: T.textDim, flexShrink: 0 }}>click</span>
              }
            </div>
          );
        })}
      </div>

      {linkedFile && (
        <div style={{
          background: T.card, borderTop: `1px solid ${T.border}`,
          padding: "12px 16px", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 11, color: T.textSub, minWidth: 0 }}>
            Saving to: <span style={{ color: T.text, fontWeight: 700 }}>{linkedFile.name}</span>
            {linkedFile.folder && linkedFile.folder !== "root" &&
              <span style={{ color: T.textDim }}> ({linkedFile.folder})</span>
            }
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {!saveReady && <span style={{ fontSize: 10, color: T.textDim }}>Generate JSON first</span>}
            <button onClick={onSave} disabled={!saveReady || saving} style={{
              background: saveStatus === "ok" ? "#14532D" : saveStatus === "err" ? "#450A0A" : T.blue,
              color: saveStatus === "ok" ? "#86EFAC" : saveStatus === "err" ? "#FCA5A5" : "#fff",
              border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 800,
              cursor: (!saveReady || saving) ? "not-allowed" : "pointer",
              fontSize: 12, fontFamily: "inherit", letterSpacing: "0.06em",
              opacity: (!saveReady || saving) ? 0.4 : 1, transition: "all 0.18s",
              boxShadow: (saveReady && !saving) ? `0 2px 12px ${T.blue}66` : "none",
            }}>
              {saving ? "⏳ Saving…" : saveStatus === "ok" ? "✓ Saved!" : saveStatus === "err" ? "✗ Error" : "💾 Save to File"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FOLDER PANEL ─────────────────────────────────────────────────────────────

function FolderPanel({ folderName, files, onClear }) {
  const walls = files.filter(f => categorizeFile(f.name) === "wall").length;
  const tables = files.filter(f => categorizeFile(f.name) === "table").length;
  const browsers = files.filter(f => categorizeFile(f.name) === "browser").length;
  // ── Added gondola count ──
  const gondolas = files.filter(f => categorizeFile(f.name) === "gondola").length;
  const folders = [...new Set(files.map(f => f.folder))].length;

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.blue}55`,
      borderRadius: 12, padding: "12px 18px", marginBottom: 22,
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      boxShadow: `0 0 0 1px ${T.blue}22`,
    }}>
      <span style={{ fontSize: 20 }}>📂</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: T.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{folderName}</div>
        <div style={{ fontSize: 11, color: T.textSub, marginTop: 4, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>{files.length} files · {folders} folder{folders !== 1 ? "s" : ""}</span>
          {walls > 0 && <span style={{ color: "#93C5FD" }}>🧱 {walls} wall</span>}
          {tables > 0 && <span style={{ color: "#86EFAC" }}>🪑 {tables} table</span>}
          {browsers > 0 && <span style={{ color: "#FDBA74" }}>🪟 {browsers} browser</span>}
          {gondolas > 0 && <span style={{ color: "#67E8F9" }}>🏪 {gondolas} gondola</span>}
        </div>
      </div>
      <button onClick={onClear} style={{
        background: "transparent", color: T.textDim, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 11,
        fontWeight: 600, fontFamily: "inherit", flexShrink: 0, transition: "all 0.12s",
      }}
        onMouseEnter={e => { e.currentTarget.style.color = T.red; e.currentTarget.style.borderColor = T.red + "66"; }}
        onMouseLeave={e => { e.currentTarget.style.color = T.textDim; e.currentTarget.style.borderColor = T.border; }}
      >✕ Unlink</button>
    </div>
  );
}

// ─── DIVIDER ──────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: T.border, margin: "18px 0" }} />;
}


// ─── WALLS SECTION ────────────────────────────────────────────────────────────

function WallsSection({ onJson, folderFiles }) {
  const [profiles, setProfiles] = useState({ 1: [] });
  const [active, setActive] = useState(1);
  const [json, setJson] = useState(null);
  const [linkedFile, setLinkedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [refImageUrl, setRefImageUrl] = useState(null);
  const [pickerMode, setPickerMode] = useState(false);

  const wallFiles = folderFiles.filter(f => categorizeFile(f.name) === "wall");

  const handleLink = async (f) => {
    setLinkedFile(f);
    setSaveStatus(null);
    setRefImageUrl(null);
    const url = await readRefImageFromHandle(f.handle);
    setRefImageUrl(url);
  };
  const keys = Object.keys(profiles).map(Number);
  const seq = profiles[active] || [];

  const add = c => { setProfiles(p => ({ ...p, [active]: [...(p[active] || []), c] })); setJson(null); };
  const undo = () => { setProfiles(p => { const s = [...(p[active] || [])]; s.pop(); return { ...p, [active]: s }; }); setJson(null); };
  const clear = () => { setProfiles(p => ({ ...p, [active]: [] })); setJson(null); };
  const addP = () => { const k = nextKey(profiles); setProfiles(p => ({ ...p, [k]: [] })); setActive(k); };
  const delP = k => {
    if (keys.length === 1) return;
    setProfiles(p => { const u = { ...p }; delete u[k]; return u; });
    if (active === k) setActive(keys.find(x => x !== k));
  };
  const generate = () => {
    const all = new Set(); Object.values(profiles).forEach(s => s.forEach(c => all.add(c)));
    const wall_profiles = {};
    Object.entries(profiles).forEach(([k, s]) => { wall_profiles[k] = { color_sequence: s }; });
    const result = { important_colors: [...all].sort(), wall_profiles };
    setJson(result); onJson && onJson(result); setSaveStatus(null);
  };
  const saveToFile = async () => {
    if (!linkedFile || !json) return;
    setSaving(true); setSaveStatus(null);
    try {
      const w = await linkedFile.handle.createWritable();
      await w.write(JSON.stringify(json, null, 2)); await w.close();
      setSaveStatus("ok"); setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus("err"); }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
      <PalettePanel onAdd={add} pickerMode={pickerMode} onTogglePicker={refImageUrl ? () => setPickerMode(p => !p) : undefined} />
      <div style={{ flex: 1, minWidth: 500 }}>
        <ProfileTabs keys={keys} active={active} onSelect={setActive} onAdd={addP} onDelete={delP} label="PROFILE" />
        <SequenceArea sequence={seq} onUndo={undo} onClear={clear} />

        {keys.filter(k => k !== active).length > 0 && (
          <>
            <Divider />
            <Label>Other Profiles</Label>
            {keys.filter(k => k !== active).map(k => (
              <MiniPreview key={k} label={`Profile ${k}`} count={profiles[k].length} colors={profiles[k]} onClick={() => setActive(k)} />
            ))}
          </>
        )}

        <Divider />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <GenerateBtn onClick={generate} />
          {json && <span style={{ fontSize: 11, color: T.green }}>✓ JSON ready</span>}
        </div>

        <FileLinker files={wallFiles} linkedFile={linkedFile}
          onLink={handleLink}
          onSave={saveToFile} saveReady={!!json} saving={saving} saveStatus={saveStatus} />

        {json && <><Divider /><JsonOutput data={json} label="Output — walls.json" /></>}
      </div>
      <ReferenceImagePanel imageUrl={refImageUrl} fileName={linkedFile?.name} onColorPick={add} pickerMode={pickerMode} />
    </div>
  );
}

// ─── TABLES SECTION ───────────────────────────────────────────────────────────

function TablesSection({ onJson, folderFiles }) {
  const [tiers, setTiers] = useState({ 1: [] });
  const [active, setActive] = useState(1);
  const [json, setJson] = useState(null);
  const [linkedFile, setLinkedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [refImageUrl, setRefImageUrl] = useState(null);
  const [pickerMode, setPickerMode] = useState(false);

  const tableFiles = folderFiles.filter(f => categorizeFile(f.name) === "table");

  const handleLink = async (f) => {
    setLinkedFile(f);
    setSaveStatus(null);
    setRefImageUrl(null);
    const url = await readRefImageFromHandle(f.handle);
    setRefImageUrl(url);
  };
  const keys = Object.keys(tiers).map(Number);
  const seq = tiers[active] || [];

  const add = c => { setTiers(p => ({ ...p, [active]: [...(p[active] || []), c] })); setJson(null); };
  const undo = () => { setTiers(p => { const s = [...(p[active] || [])]; s.pop(); return { ...p, [active]: s }; }); setJson(null); };
  const clear = () => { setTiers(p => ({ ...p, [active]: [] })); setJson(null); };
  const addT = () => { const k = nextKey(tiers); setTiers(p => ({ ...p, [k]: [] })); setActive(k); };
  const delT = k => {
    if (keys.length === 1) return;
    setTiers(p => { const u = { ...p }; delete u[k]; return u; });
    if (active === k) setActive(keys.find(x => x !== k));
  };
  const generate = () => {
    const table_tiers = {};
    Object.entries(tiers).forEach(([k, s]) => { table_tiers[k] = { allowed_colors: uniqueSorted(s), color_sequence: s }; });
    const result = { table_tiers };
    setJson(result); onJson && onJson(result); setSaveStatus(null);
  };
  const saveToFile = async () => {
    if (!linkedFile || !json) return;
    setSaving(true); setSaveStatus(null);
    try {
      const w = await linkedFile.handle.createWritable();
      await w.write(JSON.stringify(json, null, 2)); await w.close();
      setSaveStatus("ok"); setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus("err"); }
    setSaving(false);
  };

  const allowedPreview = uniqueSorted(seq);

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
      <PalettePanel onAdd={add} pickerMode={pickerMode} onTogglePicker={refImageUrl ? () => setPickerMode(p => !p) : undefined} />
      <div style={{ flex: 1, minWidth: 500 }}>
        <ProfileTabs keys={keys} active={active} onSelect={setActive} onAdd={addT} onDelete={delT} label="TIER" />
        <SequenceArea sequence={seq} onUndo={undo} onClear={clear} />

        {allowedPreview.length > 0 && (
          <Card style={{ marginTop: 12, borderColor: "#22C55E44" }}>
            <Label color={T.green}>✓ Allowed Colors — auto-derived from sequence</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allowedPreview.map(c => <ColorSwatch key={c} name={c} />)}
            </div>
          </Card>
        )}

        {keys.filter(k => k !== active).length > 0 && (
          <>
            <Divider />
            <Label>Other Tiers</Label>
            {keys.filter(k => k !== active).map(k => (
              <MiniPreview key={k} label={`Tier ${k}`} count={tiers[k].length} colors={tiers[k]} onClick={() => setActive(k)} />
            ))}
          </>
        )}

        <Divider />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <GenerateBtn onClick={generate} />
          {json && <span style={{ fontSize: 11, color: T.green }}>✓ JSON ready</span>}
        </div>

        <FileLinker files={tableFiles} linkedFile={linkedFile}
          onLink={handleLink}
          onSave={saveToFile} saveReady={!!json} saving={saving} saveStatus={saveStatus} />

        {json && <><Divider /><JsonOutput data={json} label="Output — tables.json" /></>}
      </div>
      <ReferenceImagePanel imageUrl={refImageUrl} fileName={linkedFile?.name} onColorPick={add} pickerMode={pickerMode} />
    </div>
  );
}

// ─── BROWSER SECTION ──────────────────────────────────────────────────────────

function BrowserSection({ onJson, folderFiles }) {
  const [selected, setSelected] = useState(new Set());
  const [json, setJson] = useState(null);
  const [linkedFile, setLinkedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [refImageUrl, setRefImageUrl] = useState(null);
  const [pickerMode, setPickerMode] = useState(false);

  const browserFiles = folderFiles.filter(f => categorizeFile(f.name) === "browser");

  const handleLink = async (f) => {
    setLinkedFile(f);
    setSaveStatus(null);
    setRefImageUrl(null);
    const url = await readRefImageFromHandle(f.handle);
    setRefImageUrl(url);
  };
  const toggle = name => { setSelected(p => { const s = new Set(p); s.has(name) ? s.delete(name) : s.add(name); return s; }); setJson(null); };
  const clear = () => { setSelected(new Set()); setJson(null); };
  const generate = () => {
    const result = { important_colors: [...selected].sort() };
    setJson(result); onJson && onJson(result); setSaveStatus(null);
  };
  const saveToFile = async () => {
    if (!linkedFile || !json) return;
    setSaving(true); setSaveStatus(null);
    try {
      const w = await linkedFile.handle.createWritable();
      await w.write(JSON.stringify(json, null, 2)); await w.close();
      setSaveStatus("ok"); setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus("err"); }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
      <PalettePanel onAdd={toggle} toggleMode selected={selected} pickerMode={pickerMode} onTogglePicker={refImageUrl ? () => setPickerMode(p => !p) : undefined} />
      <div style={{ flex: 1, minWidth: 500 }}>
        <Card style={{ minHeight: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>
              Important Colors
              <span style={{ color: T.blue, marginLeft: 6, fontWeight: 800 }}>[{selected.size}]</span>
            </Label>
            <SmBtn onClick={clear} disabled={selected.size === 0} danger>✕ Clear All</SmBtn>
          </div>
          {selected.size === 0
            ? <div style={{
              color: T.textDim, fontSize: 13, textAlign: "center", padding: "20px 0",
              border: `1px dashed ${T.border}`, borderRadius: 8,
            }}>Toggle colors on the left to mark them as important</div>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...selected].sort().map(c => (
                <div key={c} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 7, padding: "5px 8px 5px 6px", fontSize: 12,
                }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: getHex(c), border: `1px solid ${T.borderHi}`, flexShrink: 0 }} />
                  <span style={{ color: T.text, fontWeight: 600 }}>{c}</span>
                  <button onClick={() => toggle(c)} style={{
                    background: "none", border: "none", color: T.textDim,
                    cursor: "pointer", padding: "0 2px", fontSize: 14, lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
            </div>
          }
        </Card>

        <Card style={{ marginTop: 10, borderColor: T.border }}>
          <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.7 }}>
            <span style={{ fontWeight: 700, color: T.text }}>ℹ Browser config</span> — Only needs a list of important colors, no sequence or tiers required. Toggle colors on the left palette.
          </div>
        </Card>

        <Divider />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <GenerateBtn onClick={generate} />
          {json && <span style={{ fontSize: 11, color: T.green }}>✓ JSON ready</span>}
        </div>

        <FileLinker files={browserFiles} linkedFile={linkedFile}
          onLink={handleLink}
          onSave={saveToFile} saveReady={!!json} saving={saving} saveStatus={saveStatus} />

        {json && <><Divider /><JsonOutput data={json} label="Output — browser.json" /></>}
      </div>
      <ReferenceImagePanel imageUrl={refImageUrl} fileName={linkedFile?.name} onColorPick={toggle} pickerMode={pickerMode} />
    </div>
  );
}

// ─── GONDOLA SECTION ─────────────────────────────────────────────────────────
// Same as BrowserSection — toggle-only, no sequence.
// JSON output: { "important_colors": [...] }
// Files: any filename containing "gondola"

function GondolaSection({ onJson, folderFiles }) {
  const [selected, setSelected] = useState(new Set());
  const [json, setJson] = useState(null);
  const [linkedFile, setLinkedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [refImageUrl, setRefImageUrl] = useState(null);
  const [pickerMode, setPickerMode] = useState(false);

  // ── Only picks up files with "gondola" in the name ──
  const gondolaFiles = folderFiles.filter(f => categorizeFile(f.name) === "gondola");

  const handleLink = async (f) => {
    setLinkedFile(f);
    setSaveStatus(null);
    setRefImageUrl(null);
    const url = await readRefImageFromHandle(f.handle);
    setRefImageUrl(url);
  };
  const toggle = name => { setSelected(p => { const s = new Set(p); s.has(name) ? s.delete(name) : s.add(name); return s; }); setJson(null); };
  const clear = () => { setSelected(new Set()); setJson(null); };
  const generate = () => {
    const result = { important_colors: [...selected].sort() };
    setJson(result); onJson && onJson(result); setSaveStatus(null);
  };
  const saveToFile = async () => {
    if (!linkedFile || !json) return;
    setSaving(true); setSaveStatus(null);
    try {
      const w = await linkedFile.handle.createWritable();
      await w.write(JSON.stringify(json, null, 2)); await w.close();
      setSaveStatus("ok"); setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus("err"); }
    setSaving(false);
  };

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
      <PalettePanel onAdd={toggle} toggleMode selected={selected} pickerMode={pickerMode} onTogglePicker={refImageUrl ? () => setPickerMode(p => !p) : undefined} />
      <div style={{ flex: 1, minWidth: 500 }}>
        <Card style={{ minHeight: 100 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Label>
              Important Colors
              <span style={{ color: T.blue, marginLeft: 6, fontWeight: 800 }}>[{selected.size}]</span>
            </Label>
            <SmBtn onClick={clear} disabled={selected.size === 0} danger>✕ Clear All</SmBtn>
          </div>
          {selected.size === 0
            ? <div style={{
              color: T.textDim, fontSize: 13, textAlign: "center", padding: "20px 0",
              border: `1px dashed ${T.border}`, borderRadius: 8,
            }}>Toggle colors on the left to mark them as important for Gondola</div>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...selected].sort().map(c => (
                <div key={c} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 7, padding: "5px 8px 5px 6px", fontSize: 12,
                }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: getHex(c), border: `1px solid ${T.borderHi}`, flexShrink: 0 }} />
                  <span style={{ color: T.text, fontWeight: 600 }}>{c}</span>
                  <button onClick={() => toggle(c)} style={{
                    background: "none", border: "none", color: T.textDim,
                    cursor: "pointer", padding: "0 2px", fontSize: 14, lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
            </div>
          }
        </Card>

        <Card style={{ marginTop: 10, borderColor: T.border }}>
          <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.7 }}>
            <span style={{ fontWeight: 700, color: T.text }}>ℹ Gondola config</span> — Only needs a list of important colors. Toggle colors on the left palette. Files named with "gondola" appear in the file linker below.
          </div>
        </Card>

        <Divider />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <GenerateBtn onClick={generate} />
          {json && <span style={{ fontSize: 11, color: T.green }}>✓ JSON ready</span>}
        </div>

        <FileLinker files={gondolaFiles} linkedFile={linkedFile}
          onLink={handleLink}
          onSave={saveToFile} saveReady={!!json} saving={saving} saveStatus={saveStatus} />

        {json && <><Divider /><JsonOutput data={json} label="Output — gondola.json" /></>}
      </div>
      <ReferenceImagePanel imageUrl={refImageUrl} fileName={linkedFile?.name} onColorPick={toggle} pickerMode={pickerMode} />
    </div>
  );
}

// ─── EXPORT ALL ───────────────────────────────────────────────────────────────

// ── Added gondolaData prop ──
function ExportAllSection({ wallData, tableData, browserData, gondolaData }) {
  const combined = {};
  if (wallData) combined.walls = wallData;
  if (tableData) combined.tables = tableData;
  if (browserData) combined.browser = browserData;
  if (gondolaData) combined.gondola = gondolaData;
  const ready = Object.keys(combined).length > 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        {[
          ["walls",   "🧱", wallData],
          ["tables",  "🪑", tableData],
          ["browser", "🪟", browserData],
          ["gondola", "🏪", gondolaData],
        ].map(([k, icon, d]) => (
          <div key={k} style={{
            background: d ? "#0F2A1A" : T.card,
            border: `1px solid ${d ? T.green + "55" : T.border}`,
            borderRadius: 9, padding: "10px 18px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: d ? T.green : T.textDim, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: d ? T.green : T.textDim }}>
              {icon} {k.charAt(0).toUpperCase() + k.slice(1)}
            </span>
            {d && <span style={{ fontSize: 10, color: T.green + "88" }}>ready</span>}
          </div>
        ))}
      </div>
      {ready
        ? <JsonOutput data={combined} label="Combined Output — config_all.json" />
        : <div style={{
          color: T.textDim, fontSize: 13, padding: "56px 0", textAlign: "center",
          border: `1px dashed ${T.border}`, borderRadius: 12,
        }}>
          Generate JSON in each section first, then return here to combine them.
        </div>
      }
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

// ── Added gondola tab ──
const TABS = [
  { id: "walls",   icon: "🧱", label: "Walls" },
  { id: "tables",  icon: "🪑", label: "Tables" },
  { id: "browser", icon: "🪟", label: "Browser" },
  { id: "gondola", icon: "🏪", label: "Gondola" },
  { id: "export",  icon: "📦", label: "Export All" },
];

const DESC = {
  walls:   "Build color sequences per wall profile. important_colors is auto-derived.",
  tables:  "Build color sequences per tier. allowed_colors is auto-derived from each tier.",
  browser: "Toggle which colors are marked as important for the browser config.",
  gondola: "Toggle which colors are marked as important for the gondola config.",
  export:  "Combine all generated configs into a single JSON output.",
};

const FSA_SUPPORTED = typeof window !== "undefined" && "showDirectoryPicker" in window;

export default function App() {
  const [tab, setTab] = useState("walls");
  const [wallJson, setWallJson] = useState(null);
  const [tableJson, setTableJson] = useState(null);
  const [browserJson, setBrowserJson] = useState(null);
  // ── Added gondola state ──
  const [gondolaJson, setGondolaJson] = useState(null);
  const [folderHandle, setFolderHandle] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderLoading, setFolderLoading] = useState(false);

  const scanDir = async (dirHandle, path = "") => {
    const files = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "directory") {
        const sub = path ? `${path}/${name}` : name;
        files.push(...await scanDir(handle, sub));
      } else if (handle.kind === "file" && name.endsWith(".json")) {
        files.push({ name, handle, folder: path || "root" });
      }
    }
    return files;
  };

  const linkFolder = async () => {
    if (!FSA_SUPPORTED) return;
    try {
      setFolderLoading(true);
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      const files = await scanDir(dir);
      const trailingNum = n => { const m = n.match(/(\d+)[^\d]*\.json$/); return m ? parseInt(m[1]) : 9999; };
      files.sort((a, b) => {
        const fc = a.folder.localeCompare(b.folder); if (fc !== 0) return fc;
        const nd = trailingNum(a.name) - trailingNum(b.name); if (nd !== 0) return nd;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });
      setFolderHandle(dir);
      setFolderFiles(files);
    } catch (e) { if (e.name !== "AbortError") console.error(e); }
    setFolderLoading(false);
  };

  const unlinkFolder = () => { setFolderHandle(null); setFolderFiles([]); };
  const accentColor = ACCENT[tab];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
      <style>{`
        @keyframes fadeOut { 0%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} 60%{opacity:1} 100%{opacity:0;transform:translate(-50%,-60%) scale(0.95)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        background: T.card, borderBottom: `1px solid ${T.border}`,
        padding: "0 28px",
        display: "flex", alignItems: "stretch", justifyContent: "space-between",
        flexWrap: "wrap", gap: 0, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 16px #00000066",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0" }}>
          <img
            src="/2867978.png" alt="logo"
            style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }}
          />
          <div style={{ width: 4, height: 36, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.04em", color: T.text }}>
              Color Config Builder
            </div>
            <div style={{
              fontSize: 10, color: T.textDim, marginTop: 2,
              letterSpacing: "0.1em", textTransform: "uppercase"
            }}>
              Walls · Tables · Browser · Gondola
            </div>
          </div>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {FSA_SUPPORTED ? (
            folderHandle ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: T.bg, border: `1px solid ${T.blue}55`,
                borderRadius: 8, padding: "7px 12px",
              }}>
                <span>📂</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#93C5FD", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {folderHandle.name}
                </span>
                <span style={{ fontSize: 10, color: T.textDim }}>({folderFiles.length})</span>
                <button onClick={unlinkFolder} style={{
                  background: "none", border: "none", color: T.textDim,
                  cursor: "pointer", fontSize: 14, padding: "0 2px",
                }}>✕</button>
              </div>
            ) : (
              <button onClick={linkFolder} disabled={folderLoading}
                style={{
                  background: T.bg, color: folderLoading ? T.textDim : "#93C5FD",
                  border: `1px solid ${T.blue}55`, borderRadius: 8,
                  padding: "9px 16px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.06em", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 7, transition: "all 0.14s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.blue}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.blue + "55"}
              >
                📁 {folderLoading ? "Opening…" : "Link Folder"}
              </button>
            )
          ) : (
            <div style={{ fontSize: 11, color: T.textDim, border: `1px solid ${T.border}`, borderRadius: 7, padding: "7px 12px" }}>
              ⚠ Chrome / Edge only
            </div>
          )}

          {/* Tabs */}
          <div style={{
            display: "flex", alignSelf: "stretch",
            borderLeft: `1px solid ${T.border}`, marginLeft: 4,
          }}>
            {TABS.map(t => {
              const isActive = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  background: isActive ? T.bg : "transparent",
                  color: isActive ? T.text : T.textSub,
                  border: "none",
                  borderBottom: isActive ? `2px solid ${ACCENT[t.id]}` : "2px solid transparent",
                  padding: "0 18px", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                  fontFamily: "inherit", transition: "all 0.14s",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                  {t.id === "export" && (wallJson || tableJson || browserJson || gondolaJson) && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "28px" }}>

        {folderHandle && folderFiles.length > 0 && (
          <FolderPanel folderName={folderHandle.name} files={folderFiles} onClear={unlinkFolder} />
        )}

        {/* Section title */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 3, height: 24, borderRadius: 2, background: accentColor }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "0.04em" }}>
              {TABS.find(t => t.id === tab)?.icon} {TABS.find(t => t.id === tab)?.label}
            </div>
          </div>
          <div style={{ fontSize: 12, color: T.textSub, marginLeft: 13, paddingLeft: 10, borderLeft: `1px solid ${T.border}` }}>
            {DESC[tab]}
          </div>
        </div>

        {tab === "walls"   && <WallsSection   onJson={setWallJson}    folderFiles={folderFiles} />}
        {tab === "tables"  && <TablesSection  onJson={setTableJson}   folderFiles={folderFiles} />}
        {tab === "browser" && <BrowserSection onJson={setBrowserJson} folderFiles={folderFiles} />}
        {tab === "gondola" && <GondolaSection onJson={setGondolaJson} folderFiles={folderFiles} />}
        {tab === "export"  && (
          <ExportAllSection
            wallData={wallJson} tableData={tableJson}
            browserData={browserJson} gondolaData={gondolaJson}
          />
        )}
      </div>
    </div>
  );
}
