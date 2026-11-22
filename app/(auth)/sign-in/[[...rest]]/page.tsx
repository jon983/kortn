import { SignIn } from '@clerk/nextjs';
import { RoomBackdrop } from '../../../../lib/ui/RoomBackdrop';

export default function Page() {
  return (
    <RoomBackdrop plate="room-home" kitchenLink={false}>
      <div className="flex min-h-screen items-center justify-center p-6">
        <SignIn />
      </div>
    </RoomBackdrop>
  );
}
