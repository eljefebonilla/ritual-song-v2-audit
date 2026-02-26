export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages render without the sidebar
  return <div className="ml-0">{children}</div>;
}
