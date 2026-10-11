import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { apiClient } from "@/api/apiClient";
import {
  Search,
  Library,
  History as HistoryIcon,
  Settings,
  MessageSquare,
} from "lucide-react";

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (open) {
      setValue("");
      apiClient.entities.Conversation
        .list()
        .then(setRecent)
        .catch(() => setRecent([]));
    }
  }, [open]);

  const close = () => onOpenChange(false);
  const go = (path) => {
    setValue("");
    close();
    navigate(path);
  };
  const run = (q) => {
    setValue("");
    close();
    navigate(`/?q=${encodeURIComponent(q)}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={value}
        onValueChange={setValue}
        placeholder="Search YouTube or jump to…  (⌘K)"
      />
      <CommandList>
        <CommandEmpty>Type a query to search the web for videos.</CommandEmpty>

        {value.trim() && (
          <CommandGroup heading="Search">
            <CommandItem onSelect={() => run(value.trim())}>
              <Search className="h-4 w-4" strokeWidth={2.5} />
              <span>
                Search for <strong>“{value.trim()}”</strong>
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <MessageSquare className="h-4 w-4" strokeWidth={2.5} /> New chat
          </CommandItem>
          <CommandItem onSelect={() => go("/library")}>
            <Library className="h-4 w-4" strokeWidth={2.5} /> Library
          </CommandItem>
          <CommandItem onSelect={() => go("/history")}>
            <HistoryIcon className="h-4 w-4" strokeWidth={2.5} /> History
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="h-4 w-4" strokeWidth={2.5} /> Settings
          </CommandItem>
        </CommandGroup>

        {recent.length > 0 && (
          <CommandGroup heading="Recent searches">
            {recent.map((r) => (
              <CommandItem
                key={r.id}
                value={`recent-${r.id} ${r.query}`}
                onSelect={() => run(r.query)}
              >
                <Search className="h-4 w-4" strokeWidth={2.5} />
                <span className="truncate">{r.query}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}