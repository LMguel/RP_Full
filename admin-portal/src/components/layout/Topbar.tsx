import { Menu, Search } from "lucide-react";
import { Button } from "../ui/button";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white/70 px-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar..."
            className="h-10 w-64 rounded-md border border-input bg-background pl-10 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          ADM
        </div>
      </div>
    </header>
  );
}
