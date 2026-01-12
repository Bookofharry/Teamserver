import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { getLetterColor } from '@/lib/letterColors';
import type { User } from '@/types';

type CursorPosition = {
  line: number;
  column: number;
};

type PresenceUser = {
  userId: string;
  name: string;
  avatar?: string | null;
  color: string;
  cursor?: CursorPosition;
};

type TypingState = {
  userId: string;
  name: string;
};

type UseNotePresenceInput = {
  noteId: string | null;
  user?: User | null;
};

export function useNotePresence({ noteId, user }: UseNotePresenceInput) {
  const [participants, setParticipants] = useState<PresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingState[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelReadyRef = useRef(false);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingLocalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantsRef = useRef<PresenceUser[]>([]);

  const enabled = Boolean(isSupabaseConfigured && noteId && user?.id);

  useEffect(() => {
    if (!enabled || !noteId || !user) return;

    const channel = supabase.channel(`note:${noteId}`, {
      config: {
        presence: { key: user.id },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const existingCursor = new Map(
          participantsRef.current.map((person) => [person.userId, person.cursor]),
        );
        const nextParticipants = Object.values(state)
          .flat()
          .map((presence) => ({
            userId: presence.userId || '',
            name: presence.name || 'Someone',
            avatar: presence.avatar ?? null,
            color: presence.color || getLetterColor(presence.name || ''),
            cursor: existingCursor.get(presence.userId || ''),
          }))
          .filter((person) => Boolean(person.userId));
        setParticipants(nextParticipants);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === user.id) return;
        const name = payload.name || 'Someone';
        if (!payload.isTyping) {
          setTypingUsers((prev) => prev.filter((entry) => entry.userId !== payload.userId));
          const timer = typingTimeoutsRef.current.get(payload.userId);
          if (timer) clearTimeout(timer);
          typingTimeoutsRef.current.delete(payload.userId);
          return;
        }
        setTypingUsers((prev) => {
          if (prev.some((entry) => entry.userId === payload.userId)) return prev;
          return [...prev, { userId: payload.userId, name }];
        });
        const existingTimer = typingTimeoutsRef.current.get(payload.userId);
        if (existingTimer) clearTimeout(existingTimer);
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((entry) => entry.userId !== payload.userId));
          typingTimeoutsRef.current.delete(payload.userId);
        }, 1800);
        typingTimeoutsRef.current.set(payload.userId, timeout);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === user.id) return;
        setParticipants((prev) =>
          prev.map((person) =>
            person.userId === payload.userId
              ? {
                  ...person,
                  cursor: {
                    line: payload.line ?? 1,
                    column: payload.column ?? 1,
                  },
                }
              : person,
          ),
        );
      });

    const timeouts = typingTimeoutsRef.current;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelReadyRef.current = true;
        channel.track({
          userId: user.id,
          name: user.name,
          avatar: user.avatar ?? null,
          color: getLetterColor(user.name || user.email || user.id),
        });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        channelReadyRef.current = false;
      }
    });

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      channelReadyRef.current = false;
      channel.unsubscribe();
      timeouts.forEach((timer) => clearTimeout(timer));
      timeouts.clear();
    };
  }, [enabled, noteId, user]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const notifyTyping = () => {
    if (!channelRef.current || !user || !channelReadyRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, name: user.name, isTyping: true },
    });
    if (typingLocalRef.current) clearTimeout(typingLocalRef.current);
    typingLocalRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, name: user.name, isTyping: false },
      });
    }, 1600);
  };

  const updateCursor = (line: number, column: number) => {
    if (!channelRef.current || !user || !channelReadyRef.current) return;
    if (cursorThrottleRef.current) return;
    cursorThrottleRef.current = setTimeout(() => {
      cursorThrottleRef.current = null;
    }, 220);
    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { userId: user.id, line, column },
    });
  };

  const participantsSorted = useMemo(
    () =>
      participants
        .filter((person) => Boolean(person.userId))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [participants],
  );

  return {
    participants: participantsSorted,
    typingUsers,
    notifyTyping,
    updateCursor,
  };
}
