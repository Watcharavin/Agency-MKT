import { UserButton } from "@clerk/nextjs";

export function AppTopbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground" />
      <div className="flex items-center gap-3">
        <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
      </div>
    </header>
  );
}
