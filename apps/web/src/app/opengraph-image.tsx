import { ImageResponse } from "next/og";

// Hex mirrors of the design tokens: the OG renderer does not support oklch.
const C = {
  bg: "#0b0d12",
  surface: "#12151c",
  line: "#232733",
  text: "#f3f5f8",
  muted: "#a5adbb",
  faint: "#6f7786",
  predicted: "#3fd6ee",
  server: "#b6f04a",
  remote: "#b48cf2",
  rollback: "#f4b740",
  dropped: "#f0524a",
};

export const alt = "SyncLab: client prediction, reconciliation and interpolation, made visible";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Arena({ title, naive }: { title: string; naive: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 420,
        borderRadius: 18,
        border: `1px solid ${C.line}`,
        background: C.surface,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.line}` }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: naive ? C.faint : C.predicted }} />
        <div style={{ fontSize: 20, color: C.text, fontWeight: 600 }}>{title}</div>
      </div>
      <div style={{ display: "flex", position: "relative", height: 190, background: C.bg }}>
        {/* remote player */}
        <div style={{ position: "absolute", left: 96, top: 62, width: 30, height: 30, borderRadius: 15, background: C.remote }} />
        {naive ? (
          <>
            <div style={{ position: "absolute", left: 210, top: 122, width: 34, height: 34, borderRadius: 17, background: C.predicted }} />
            <div style={{ position: "absolute", left: 272, top: 104, width: 34, height: 34, borderRadius: 17, border: `2px dashed ${C.predicted}` }} />
            <div style={{ position: "absolute", left: 246, top: 136, width: 26, height: 2, background: C.predicted, opacity: 0.6 }} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", left: 196, top: 130, width: 34, height: 34, borderRadius: 17, border: `2px dashed ${C.server}`, background: "rgba(182,240,74,0.16)" }} />
            <div style={{ position: "absolute", left: 266, top: 112, width: 34, height: 34, borderRadius: 17, background: C.predicted }} />
            <div style={{ position: "absolute", left: 252, top: 98, width: 62, height: 62, borderRadius: 31, border: `2px solid ${C.rollback}` }} />
            <div style={{ position: "absolute", left: 230, top: 64, fontSize: 15, color: C.rollback }}>−7px · replayed 5</div>
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", position: "relative", height: 54, borderTop: `1px solid ${C.line}`, padding: "0 18px" }}>
        <div style={{ fontSize: 13, color: C.predicted }}>CLIENT</div>
        <div style={{ position: "absolute", left: 120, top: 16, width: 7, height: 7, borderRadius: 4, background: C.predicted }} />
        <div style={{ position: "absolute", left: 190, top: 16, width: 7, height: 7, borderRadius: 4, background: C.predicted }} />
        <div style={{ position: "absolute", left: 250, top: 30, width: 9, height: 9, borderRadius: 5, background: C.server }} />
        <div style={{ position: "absolute", left: 160, top: 30, width: 9, height: 9, borderRadius: 5, background: C.dropped }} />
        <div style={{ marginLeft: "auto", fontSize: 13, color: C.server }}>SERVER</div>
      </div>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: `radial-gradient(900px 500px at 10% 0%, rgba(63,214,238,0.14), transparent 60%), ${C.bg}`,
          color: C.text,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 18, letterSpacing: 2, color: C.predicted }}>MULTIPLAYER NETCODE LAB</div>
            <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -4, marginTop: 6 }}>SyncLab</div>
            <div style={{ fontSize: 28, color: C.muted, marginTop: 4, maxWidth: 560 }}>
              Prediction, reconciliation and interpolation against real lag, made visible.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, alignSelf: "flex-end" }}>
          <Arena title="Naive client" naive />
          <Arena title="Predicted + reconciled" naive={false} />
        </div>
      </div>
    ),
    size,
  );
}
