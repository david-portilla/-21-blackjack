import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// This machine's LAN addresses, so teammates and the peer playtest can open the dev server
// at http://<ip>:3000 (Next blocks dev resources for unknown hosts by default).
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  // The floating dev tools badge covers controls on phones during the demo; errors still show.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
