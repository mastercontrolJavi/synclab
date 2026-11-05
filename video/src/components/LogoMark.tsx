/**
 * SyncLab's mark, redrawn from apps/web/src/app/icon.svg: a solid cyan "you"
 * one step ahead of a dashed lime "server" ghost. `ghostOffset` animates the
 * prediction gap closing, which is the product in one gesture.
 */
export function LogoMark({ size, ghostOffset = 1, spin = 0 }: { size: number; ghostOffset?: number; spin?: number }) {
  const gx = 38 - 13 * ghostOffset;
  const gy = 27 + 8 * ghostOffset;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <rect width="64" height="64" rx="15" fill="#12151c" />
      <rect x="1" y="1" width="62" height="62" rx="14" fill="none" stroke="#2a2f3b" strokeWidth="2" />
      <circle
        cx={gx}
        cy={gy}
        r="12"
        fill="none"
        stroke="#b6f04a"
        strokeWidth="3.2"
        strokeDasharray="4.8 4"
        strokeDashoffset={spin}
      />
      <circle cx="38" cy="27" r="12" fill="#3fd6ee" />
      <circle cx="38" cy="27" r="3.6" fill="#0b0d12" />
    </svg>
  );
}
