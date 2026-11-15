export function RichTextRenderer({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  if (!html) {
    return <p className="text-sm text-slate-500">Мазмұн әлі енгізілмеген.</p>;
  }
  return (
    <div
      className={["prose-content", className].filter(Boolean).join(" ")}
      // The API sanitizes HTML with bleach before storing and returning it.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
