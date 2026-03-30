interface StatsCounterProps {
  repoCount: number;
  totalStars: number | null;
}

export function StatsCounter({ repoCount, totalStars }: StatsCounterProps) {
  if (totalStars === null || totalStars <= 0) return null;

  return (
    <p className="text-center text-sm text-muted-foreground">
      {repoCount} repos collected{" "}
      <span className="font-medium text-foreground">
        {totalStars.toLocaleString()}
      </span>{" "}
      stars in total
    </p>
  );
}
