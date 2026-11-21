import { UserButton } from '@clerk/nextjs';
import { Avatar } from '../lib/ui/Avatar';
import { Wordmark } from '../lib/ui/deli';

/** The deli's green header: KORTN wordmark centred; who's signed in on the right (avatar opens account / sign-out). */
export function HomeHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-30 bg-deli-green text-deli-cream shadow-[0_6px_20px_rgba(0,0,0,.35)]">
      <div className="mx-auto grid h-[60px] max-w-5xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-[68px] sm:px-7">
        <span />
        <Wordmark />
        <div className="flex items-center justify-self-end gap-2.5">
          <span className="hidden max-w-[30vw] truncate font-cond text-[15px] font-extrabold uppercase tracking-[.08em] sm:inline">{name}</span>
          <UserButton
            fallback={<Avatar name={name} size={34} />}
            appearance={{ elements: { userButtonAvatarBox: { width: 34, height: 34, boxShadow: '0 0 0 2px var(--color-deli-cream)' } } }}
          />
        </div>
      </div>
    </header>
  );
}
