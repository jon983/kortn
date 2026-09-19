import { SignUp } from '@clerk/nextjs';
import { RoomBackdrop } from '../../../../lib/ui/RoomBackdrop';

export default function Page() {
  return (
    <RoomBackdrop plate="room-signin">
      <div className="flex min-h-screen items-center justify-center p-6">
        <SignUp />
      </div>
    </RoomBackdrop>
  );
}
