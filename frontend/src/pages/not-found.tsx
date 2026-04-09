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
