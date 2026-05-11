import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
};

const isDev = process.env.NODE_ENV === "development";

export default isDev
  ? nextConfig
  : withPWA({
      dest: "public",
      register: true,
      workboxOptions: {
        skipWaiting: true,
      },
    })(nextConfig);
