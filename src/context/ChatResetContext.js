import { createContext, useContext } from "react";

export const ChatResetContext = createContext({ onNewSearch: () => {} });

export const useChatReset = () => useContext(ChatResetContext);
