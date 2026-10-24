"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

type Props = { href: string; label: string };

const className =
  "block whitespace-nowrap rounded-md px-3 py-2 text-sm text-ink hover:bg-mint aria-[current=page]:bg-primary aria-[current=page]:font-medium aria-[current=page]:text-white";

// The pathname is request data on dynamic routes, so the active state
// streams in; the prerendered shell shows the same link without it.
export function NavLink(props: Props) {
  return (
    <Suspense fallback={<Link href={props.href} className={className}>{props.label}</Link>}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

function ActiveNavLink({ href, label }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {label}
    </Link>
  );
}
