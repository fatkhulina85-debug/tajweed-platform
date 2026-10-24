import { CabinetShell } from "@/components/cabinet-shell";

export default function StudentLayout({ children }: LayoutProps<"/[lang]/student">) {
  return <CabinetShell role="student">{children}</CabinetShell>;
}
