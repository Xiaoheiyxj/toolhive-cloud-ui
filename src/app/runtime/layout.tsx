import { Navbar } from "@/components/navbar";

export default function RuntimeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen min-w-0 flex-col bg-sidebar dark:bg-background">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto px-8 pb-8 pt-8">
        {children}
      </main>
    </div>
  );
}
