import QRCode from "qrcode";

export async function qrSvg(text: string, size = 256): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
    color: { dark: "#16181d", light: "#ffffff" },
  });
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function qrDataUrl(text: string, size = 256): Promise<string> {
  return svgToDataUrl(await qrSvg(text, size));
}
