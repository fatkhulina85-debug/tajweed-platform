import { CabinetShell } from "@/components/cabinet-shell";

export default function AdminLayout({ children }: LayoutProps<"/[lang]/admin">) {
  return <CabinetShell role="admin">{children}</CabinetShell>;
}
