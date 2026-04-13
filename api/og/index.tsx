// Copyright © 2026 Miguel Tenorio Potrony - AntiD2ta.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ImageResponse } from "@vercel/og";

/**
 * Number of repositories in the Ethstar repo list.
 * Keep in sync with frontend/src/lib/repos.ts — a Vitest test enforces this.
 */
const REPO_COUNT = 54;

const DOMAIN = "ethstar.dev";

/** Fetch a Google Font as ArrayBuffer for Satori. */
async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  const params = new URLSearchParams({
    family: `${family}:wght@${weight}`,
    text,
  });
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?${params}`)
  ).text();
  const match = css.match(/src: url\((.+?)\) format\(/);
  if (!match) throw new Error(`Failed to load font: ${family}`);
  return await (await fetch(match[1])).arrayBuffer();
}

export default async function handler() {
  const title = "Star Every Ethereum Repo";
  const subtitle = `Support ${REPO_COUNT}+ core protocol repositories in a single click`;

  const [spaceGrotesk, inter] = await Promise.all([
    loadGoogleFont("Space Grotesk", 700, title),
    loadGoogleFont("Inter", 400, subtitle + DOMAIN),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #12122a 0%, #181838 50%, #141430 100%)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Radial glow approximation */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
            width: "800px",
            height: "800px",
            borderRadius: "50%",
            background: "rgba(99, 102, 241, 0.08)",
          }}
        />

        {/* Ethereum diamond logo — exact copy from favicon.svg */}
        <svg
          viewBox="0 0 170 285"
          width="54"
          height="91"
          style={{ marginBottom: "40px" }}
        >
          {/* Upper kite */}
          <polygon points="85,0 85,120 0,120" fill="#6366f1" opacity="0.85" />
          <polygon points="85,0 170,120 85,120" fill="#4f46e5" opacity="0.80" />
          <polygon points="0,120 85,120 85,215" fill="#4338ca" opacity="0.80" />
          <polygon points="85,120 170,120 85,215" fill="#3730a3" opacity="0.75" />
          {/* Lower chevron */}
          <polygon points="0,150 85,235 85,285" fill="#5b52d6" opacity="0.80" />
          <polygon points="85,235 170,150 85,285" fill="#3730a3" opacity="0.75" />
        </svg>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontFamily: "Space Grotesk",
            fontSize: "52px",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#e4e4f0" }}>Star Every </span>
          <span style={{ color: "#6366f1" }}>Ethereum</span>
          <span style={{ color: "#e4e4f0" }}> Repo</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: "22px",
            fontWeight: 400,
            color: "#8888a8",
            marginTop: "24px",
          }}
        >
          {subtitle}
        </div>

        {/* Divider */}
        <div
          style={{
            width: "240px",
            height: "1px",
            background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.5) 50%, transparent 100%)",
            marginTop: "36px",
          }}
        />

        {/* Domain */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: "20px",
            fontWeight: 500,
            color: "#6366f1",
            marginTop: "20px",
          }}
        >
          {DOMAIN}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Space Grotesk", data: spaceGrotesk, weight: 700, style: "normal" as const },
        { name: "Inter", data: inter, weight: 400, style: "normal" as const },
      ],
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
