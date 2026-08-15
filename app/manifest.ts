import type { MetadataRoute } from "next";

/**
 * Makes the app installable to a phone's home screen.
 *
 * Worth the few lines: a driver decides whether to claim a pin while standing
 * in someone's front yard with a full truck. An icon they tap gets opened; a
 * bookmark buried in browser tabs does not.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mulch2You",
    short_name: "Mulch2You",
    description: "Free wood chip, straight from the truck. We deliver, you benefit.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8f5",
    theme_color: "#385020",
    categories: ["business", "utilities"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
