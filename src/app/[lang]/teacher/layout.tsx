import { CabinetShell } from "@/components/cabinet-shell";

export default function TeacherLayout({ children }: LayoutProps<"/[lang]/teacher">) {
  return <CabinetShell role="teacher">{children}</CabinetShell>;
}
