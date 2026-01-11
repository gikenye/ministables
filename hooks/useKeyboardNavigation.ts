import { useCallback } from "react";

interface UseKeyboardNavigationProps {
  setActiveTab: (tab: "goals" | "groups" | "leaderboard" | "profile") => void;
  setAnnouncements: (announcements: string[]) => void;
}

export function useKeyboardNavigation({ setActiveTab, setAnnouncements }: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "g" && event.ctrlKey) {
        event.preventDefault();
        setActiveTab("goals");
        setAnnouncements(["Switched to Goals tab"]);
      } else if (event.key === "l" && event.ctrlKey) {
        event.preventDefault();
        setActiveTab("leaderboard");
        setAnnouncements(["Switched to Leaderboard tab"]);
      } else if (event.key === "p" && event.ctrlKey) {
        event.preventDefault();
        setActiveTab("profile");
        setAnnouncements(["Switched to Profile tab"]);
      }
    },
    [setActiveTab, setAnnouncements]
  );

  return { handleKeyDown };
}
