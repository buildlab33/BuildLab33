export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl gradient-brand mx-auto mb-4 animate-pulse" />
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    </div>
  );
}
