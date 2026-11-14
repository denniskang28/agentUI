import { createContext } from "react";
import { previewOrigin } from "../../protocol/src/browser-deployment";

/** Embedded Host supplies its own origin without rebuilding plugin artifacts. */
export const PluginAssetOrigin = createContext(previewOrigin);
