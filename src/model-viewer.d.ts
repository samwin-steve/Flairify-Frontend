import type { DetailedHTMLProps, HTMLAttributes } from "react";
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        ar?: boolean;
        "camera-controls"?: boolean;
        "ar-modes"?: string;
        "shadow-intensity"?: string;
        exposure?: string;
        "camera-orbit"?: string;
        "touch-action"?: string;
      };
    }
  }
}
