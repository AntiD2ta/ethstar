import { Check, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StarAllButtonProps {
  remaining: number;
  isStarring: boolean;
  allDone: boolean;
  onClick: () => void;
}

export function StarAllButton({
  remaining,
  isStarring,
  allDone,
  onClick,
}: StarAllButtonProps) {
  const disabled = isStarring || allDone || remaining === 0;

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="lg"
      className="rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
    >
      {isStarring ? (
        <>
          <Loader2
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Starring…
        </>
      ) : allDone ? (
        <>
          <Check aria-hidden="true" />
          All Starred!
        </>
      ) : (
        <>
          <Star
            fill="currentColor"
            strokeWidth={0}
            aria-hidden="true"
          />
          Star All {remaining} Remaining
        </>
      )}
    </Button>
  );
}
