import { continueRender, delayRender, staticFile } from "remotion";

// Geist and Geist Mono (SIL Open Font License, see public/fonts/OFL-LICENSE.txt),
// the same families the SyncLab UI uses.
const FONTS = [
  { family: "Geist", file: "fonts/Geist-Variable.woff2" },
  { family: "Geist Mono", file: "fonts/GeistMono-Variable.woff2" },
];

let started = false;

export function loadFonts(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading Geist fonts");
  Promise.all(
    FONTS.map(async ({ family, file }) => {
      const face = new FontFace(family, `url(${staticFile(file)}) format("woff2")`, {
        weight: "100 900",
      });
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch((error) => {
      console.error(error);
      continueRender(handle);
    });
}
