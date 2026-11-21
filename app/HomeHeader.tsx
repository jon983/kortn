import { UserButton } from '@clerk/nextjs';
import { Avatar } from '../lib/ui/Avatar';

/** Front-room top bar: logo on the left, who's signed in on the right (avatar opens account / sign-out). */
export function HomeHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-30 bg-black/55 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static svg */}
          <img src="/art/favicon.svg" alt="" width={32} height={32} className="rounded-md shadow" />
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none text-brass drop-shadow">kortn</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="max-w-[40vw] truncate text-sm font-bold text-bone">{name}</span>
          <UserButton
            fallback={<Avatar name={name} size={32} />}
            appearance={{ elements: { userButtonAvatarBox: { width: 32, height: 32, boxShadow: '0 0 0 1.5px var(--color-brass)' } } }}
          />
        </div>
      </div>
    </header>
  );
}
