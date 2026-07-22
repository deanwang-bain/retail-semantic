export default function Placeholder({
  title,
  blurb,
}: {
  title: string;
  blurb: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{blurb}</p>
      <p className="text-sm text-muted-foreground">
        This page will be wired in a later build phase.
      </p>
    </div>
  );
}
