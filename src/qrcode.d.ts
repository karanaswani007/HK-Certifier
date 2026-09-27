declare module "qrcode" {
  export interface QRCodeToStringOptions {
    type?: "svg" | "utf8" | "terminal";
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  export function toString(
    text: string,
    options?: QRCodeToStringOptions,
  ): Promise<string>;
}
