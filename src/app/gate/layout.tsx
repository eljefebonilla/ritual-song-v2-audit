export default function GateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate page renders without the sidebar
  return <div className="ml-0">{children}</div>;
}
