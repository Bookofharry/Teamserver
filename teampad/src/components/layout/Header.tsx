import { useEffect, useRef, useState } from 'react';
import { Bell, Menu, MessageCircle } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { ColorizedText } from '@/components/ui/colorized-text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatMentionNotification, User } from '@/types';

interface HeaderProps {
  user: User;
  groupName?: string;
  onOpenAIPanel: () => void;
  onOpenChat?: () => void;
  chatUnreadCount?: number;
  chatMentionCount?: number;
  mentionNotifications?: ChatMentionNotification[];
  mentionsLoading?: boolean;
  onMentionsOpen?: () => void;
  onMentionsMarkAll?: () => void;
  onMentionSelect?: (notification: ChatMentionNotification) => void;
  onOpenSidebar?: () => void;
}

export function Header({
  user,
  groupName,
  onOpenAIPanel,
  onOpenChat,
  chatUnreadCount = 0,
  chatMentionCount = 0,
  mentionNotifications = [],
  mentionsLoading = false,
  onMentionsOpen,
  onMentionsMarkAll,
  onMentionSelect,
  onOpenSidebar,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const themeKey = `teampad-theme:${user.id}`;
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const didInitTheme = useRef(false);
  const hasUnreadMentions = mentionNotifications.some((notification) => !notification.readAt);
  useEffect(() => {
    if (didInitTheme.current) return;
    didInitTheme.current = true;
    const storedTheme = localStorage.getItem(themeKey);
    if (storedTheme && storedTheme !== theme) {
      setTheme(storedTheme);
    }
  }, [setTheme, themeKey, theme]);

  useEffect(() => {
    if (theme) {
      localStorage.setItem(themeKey, theme);
    }
  }, [theme, themeKey]);

  return (
    <header className="h-16 bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 border-b border-border">
      <div className="flex items-center gap-3">
        {onOpenSidebar && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSidebar}
            className="sm:hidden"
          >
            <Menu className="w-4 h-4" />
          </Button>
        )}
        {groupName && (
          <h1 className="text-sm sm:text-lg font-semibold text-foreground dashboard-display">{groupName}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onOpenChat && (
          <Button variant="ghost" size="icon-sm" onClick={onOpenChat} className="relative">
            <MessageCircle className="w-4 h-4" />
            {chatMentionCount > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                @{chatMentionCount > 9 ? "9+" : chatMentionCount}
              </span>
            ) : chatUnreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-secondary text-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
              </span>
            ) : null}
          </Button>
        )}
        <DropdownMenu
          open={mentionsOpen}
          onOpenChange={(open) => {
            setMentionsOpen(open);
            if (open) onMentionsOpen?.();
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <Bell className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
              Mentions
            </div>
            {mentionsLoading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading mentions...</div>
            )}
            {!mentionsLoading && mentionNotifications.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No new mentions.
              </div>
            )}
            {!mentionsLoading && mentionNotifications.length > 0 && (
              <div className="max-h-56 overflow-y-auto">
                {mentionNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="border-t border-border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {!notification.readAt && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                        )}
                        <span className="font-semibold text-foreground">
                          {notification.sender?.name || "Team member"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {notification.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {notification.deletedAt ? "Message deleted" : notification.body || "Sent a mention"}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onMentionSelect?.(notification);
                          setMentionsOpen(false);
                        }}
                      >
                        Jump to message
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onMentionsMarkAll?.();
                    setMentionsOpen(false);
                  }}
                  disabled={!hasUnreadMentions}
                >
                  Mark all read
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    onOpenChat?.();
                    setMentionsOpen(false);
                  }}
                >
                  Open chat
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="w-px h-6 bg-transparent mx-2" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-secondary rounded-xl px-2 py-1.5 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-black text-primary">
                  {user.name.charAt(0)}
                </span>
              </div>
              <ColorizedText
                text={user.name.split(' ')[0]}
                className="text-sm font-black hidden sm:block"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 pt-2 pb-1">
              <p className="text-sm font-semibold truncate">
                <ColorizedText text={user.name} />
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email || 'No email on file'}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
