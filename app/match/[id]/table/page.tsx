export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="flex min-h-screen items-center justify-center text-bone">The game table for {id} will appear here (Phase 5).</main>;
}
