import { SignUp } from '@clerk/nextjs';
import { AuthShell } from '../../AuthShell';

export default function Page() {
  return (
    <AuthShell>
      {/* Clerk's own logo is off: our KORTN sign hangs above the box instead. */}
      <SignUp appearance={{ options: { logoPlacement: 'none' } }} />
    </AuthShell>
  );
}
