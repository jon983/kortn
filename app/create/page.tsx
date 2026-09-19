import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { RoomBackdrop } from '../../lib/ui/RoomBackdrop';
import { Framed } from '../../lib/ui/Framed';
import { CreateForm } from './CreateForm';

export default async function CreatePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return (
    <RoomBackdrop plate="room-home">
      <main className="mx-auto max-w-md px-5 py-14">
        <h1 className="text-center font-[family-name:var(--font-display)] text-3xl text-brass mb-4">Set the table</h1>
        <Framed><CreateForm /></Framed>
      </main>
    </RoomBackdrop>
  );
}
