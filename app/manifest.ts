import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InfraSync-AI",
    short_name: "InfraSync-AI",
    description: "From field updates to verified schedule actuals.",
    start_url: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#0f2a4a",
    orientation: "any",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
    ]
  };
}
