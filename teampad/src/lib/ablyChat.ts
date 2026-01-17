import Ably from "ably";



export const getAblyKey = () => import.meta.env.VITE_ABLY_KEY as string | undefined;

export const getAblyAuthUrl = () => {
  const explicit = import.meta.env.VITE_ABLY_AUTH_URL as string | undefined;
  if (explicit) return explicit;

  const rawUrl = (import.meta.env.VITE_API_URL as string | undefined) || "/api";
  const apiUrl = rawUrl.replace(/\/+$/, "");
  return `${apiUrl}/ably/auth`;
};

const getAuthRefreshUrl = () => {
  const authUrl = getAblyAuthUrl();
  if (authUrl.endsWith("/ably/auth")) {
    return authUrl.replace(/\/ably\/auth$/, "/auth/refresh");
  }

  const rawUrl = (import.meta.env.VITE_API_URL as string | undefined) || "/api";
  const apiUrl = rawUrl.replace(/\/+$/, "");
  return `${apiUrl}/auth/refresh`;
};

export const isAblyChatEnabled = () => {
  const flag = import.meta.env.VITE_ABLY_CHAT as string | undefined;
  if (!flag) return true;
  return flag === "true";
};

let ablyDisabled = false;
let realtimeClient: Ably.Realtime | null = null;
const roomPromises = new Map<string, Promise<Ably.RealtimeChannel>>();

const createRealtimeClient = () => {
  const ablyKey = getAblyKey();
  const authUrl = getAblyAuthUrl();
  if (ablyDisabled || (!ablyKey && !authUrl)) return null;
  if (ablyKey) {
    return new Ably.Realtime({ key: ablyKey });
  }
  return new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      if (ablyDisabled) {
        callback({ message: "Ably disabled", code: 400, statusCode: 400, name: "AblyDisabled" }, null);
        return;
      }
      try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("teampad_token") : null;
        let headers = {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        let res = await fetch(authUrl, { credentials: "include", cache: "no-store", headers });
        if (res.status === 401) {
          const refreshUrl = getAuthRefreshUrl();
          const refreshRes = await fetch(refreshUrl, { credentials: "include", cache: "no-store", headers }).catch(() => null);
          if (refreshRes?.ok) {
            const payload = await refreshRes.json().catch(() => null);
            const nextToken = payload?.data?.accessToken;
            if (typeof nextToken === "string" && nextToken) {
              window.localStorage.setItem("teampad_token", nextToken);
            }
          }
          // Retry with new token if refresh succeeded? 
          // Actually refresh endpoint updates cookie AND should return new token.
          // Ideally we update local storage here too, but for now relying on Cookie or re-login flow.
          // The refresh endpoint in restApi.ts updates the token. 
          // But here we are calling fetch directly. 
          // It's safer to just retry the authUrl fetch.
          const refreshedToken = typeof window !== "undefined" ? window.localStorage.getItem("teampad_token") : null;
          headers = {
            ...(refreshedToken ? { Authorization: `Bearer ${refreshedToken}` } : {}),
          };
          res = await fetch(authUrl, { credentials: "include", cache: "no-store", headers });
        }
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload?.error?.code === "ably_missing") {
            ablyDisabled = true;
          }
          callback({ message: "Ably auth failed", code: res.status, statusCode: res.status, name: "AuthFailed" }, null);
          return;
        }
        const tokenRequest = await res.json();
        callback(null, tokenRequest);
      } catch (error) {
        callback({ message: (error as Error).message, code: 500, statusCode: 500, name: "AuthError" }, null);
      }
    },
  });
};

export const getRealtimeClient = () => {
  if (realtimeClient) return realtimeClient;
  const client = createRealtimeClient();
  if (!client) return null;
  realtimeClient = client;
  return realtimeClient;
};

export const getChatClient = () => getRealtimeClient();

export const getWorkspaceRoomName = (workspaceId: string) => `workspace:${workspaceId}`;

export const getChatRoom = async (roomName: string) => {
  const existing = roomPromises.get(roomName);
  if (existing) return existing;

  const client = getRealtimeClient();
  if (!client) return null;
  const roomPromise = Promise.resolve(client.channels.get(roomName));

  roomPromises.set(roomName, roomPromise);
  try {
    return await roomPromise;
  } catch (error) {
    roomPromises.delete(roomName);
    throw error;
  }
};

export const subscribeToChatRoomMessages = async (
  roomName: string,
  onMessage: (event: Ably.Message) => void,
) => {
  const room = await getChatRoom(roomName);
  if (!room) return null;
  const client = getRealtimeClient();
  room.subscribe(onMessage);
  return () => {
    room.unsubscribe(onMessage);
    roomPromises.delete(roomName);
    if (client) {
      const channel = client.channels.get(roomName);
      // Only release when safe; avoid releasing while attaching to prevent Ably errors.
      if (channel.state === "attached") {
        channel.detach().then(() => {
          client.channels.release(roomName);
        });
      } else if (channel.state === "initialized" || channel.state === "detached" || channel.state === "failed") {
        client.channels.release(roomName);
      }
    }
  };
};

export const publishChatEvent = async (roomName: string, payload: Record<string, unknown>) => {
  const room = await getChatRoom(roomName);
  if (!room) return false;
  await room.publish("chat-event", payload);
  return true;
};
