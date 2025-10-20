"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, User, Loader2 } from "lucide-react";

export function UsernameSetupCard() {
  const { data: session, update: updateSession } = useSession();
  const [username, setUsername] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | undefined>(undefined);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize with current username from session if available
  useEffect(() => {
    if (session?.user?.username) {
      setCurrentUsername(session.user.username);
      setUsername(session.user.username);
    }
  }, [session]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username === currentUsername) {
      setIsAvailable(null);
      return;
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setIsAvailable(false);
      setError("Username must be 3-20 characters and can only contain letters, numbers, and underscores");
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/users/username?username=${encodeURIComponent(username)}`);
        const data = await response.json();
        
        setIsAvailable(data.available);
        if (!data.available) {
          setError("Username is already taken");
        }
      } catch (err) {
        console.error("Error checking username:", err);
        setError("Failed to check username availability");
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, currentUsername]);

  const handleSaveUsername = async () => {
    if (!username || !isAvailable) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/users/username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save username");
      }

      // Update the current username
      setCurrentUsername(username);
      setSuccess(true);

      // Update the session to include the new username
      await updateSession({
        username,
      });

    } catch (err: any) {
      console.error("Error saving username:", err);
      setError(err.message || "Failed to save username");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="bg-white border-secondary shadow-sm">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center text-lg text-primary">
          <User className="w-5 h-5 mr-2" />
          {currentUsername ? "Your Username" : "Set Up Username"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {currentUsername && (
          <div className="mb-3">
            <p className="text-sm text-muted-foreground">Current username:</p>
            <p className="font-medium text-primary">{currentUsername}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pr-10"
              disabled={isSaving}
            />
            {isChecking && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {isAvailable === true && !isChecking && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Check className="w-4 h-4 text-success" />
              </div>
            )}
            {isAvailable === false && !isChecking && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <X className="w-4 h-4 text-destructive-foreground0" />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive-foreground0">{error}</p>}
          {success && <p className="text-sm text-success">Username saved successfully!</p>}

          <Button
            onClick={handleSaveUsername}
            disabled={!isAvailable || isChecking || isSaving || username === currentUsername}
            className="w-full bg-primary hover:bg-primary/90 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>Save Username</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground mt-2">
            Your username helps personalize your experience while maintaining your privacy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}