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

import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-heading text-6xl font-bold tracking-tight text-primary md:text-8xl">
        404
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        This page doesn't exist. Head back to Ethstar and star some Ethereum
        repos.
      </p>
      <Button asChild size="lg" className="rounded-full px-8">
        <Link to="/">Back to Ethstar</Link>
      </Button>
    </main>
  );
}
