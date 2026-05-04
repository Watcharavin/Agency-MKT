export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-start justify-center px-4 py-16">
      {children}
    </div>
  );
}
