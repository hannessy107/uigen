"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProjectGithubRepo } from "@/actions/update-project-github";
import { Github, Camera, ExternalLink, AlertCircle, Check, X } from "lucide-react";

type View = "token" | "repo" | "issue" | "success";

interface GitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  githubRepo: string | null;
  onRepoSaved: (repo: string) => void;
  onCaptureScreenshot: () => Promise<string>;
}

export function GitHubDialog({
  open,
  onOpenChange,
  projectId,
  githubRepo,
  onRepoSaved,
  onCaptureScreenshot,
}: GitHubDialogProps) {
  const [view, setView] = useState<View>("issue");
  const [token, setToken] = useState("");
  const [repoInput, setRepoInput] = useState(githubRepo || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueUrl, setIssueUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const savedToken = localStorage.getItem("github-token") || "";
    setToken(savedToken);
    setRepoInput(githubRepo || "");
    setError(null);
    setIssueUrl(null);
    setTitle("");
    setDescription("");
    setScreenshot(null);

    if (!savedToken) setView("token");
    else if (!githubRepo) setView("repo");
    else setView("issue");
  }, [open, githubRepo]);

  const handleSaveToken = () => {
    if (!token.trim()) return;
    localStorage.setItem("github-token", token.trim());
    setError(null);
    if (!githubRepo) setView("repo");
    else setView("issue");
  };

  const handleSaveRepo = async () => {
    const trimmed = repoInput.trim();
    if (!trimmed.includes("/") || trimmed.split("/").length !== 2) {
      setError("Format: owner/repo — z.B. hannessy107/mein-projekt");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateProjectGithubRepo(projectId, trimmed);
      onRepoSaved(trimmed);
      setView("issue");
    } catch {
      setError("Speichern fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    setLoading(true);
    setError(null);
    try {
      const dataUrl = await onCaptureScreenshot();
      setScreenshot(dataUrl);
    } catch {
      setError("Screenshot fehlgeschlagen — Preview-Tab muss aktiv sein");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Titel ist erforderlich");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: localStorage.getItem("github-token"),
          repo: githubRepo,
          title: title.trim(),
          body: description.trim(),
          screenshotBase64: screenshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIssueUrl(data.url);
      setView("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Erstellen des Issues");
    } finally {
      setLoading(false);
    }
  };

  const handleNewIssue = () => {
    setTitle("");
    setDescription("");
    setScreenshot(null);
    setError(null);
    setIssueUrl(null);
    setView("issue");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Issue erstellen
          </DialogTitle>
        </DialogHeader>

        {view === "token" && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Gib deinen GitHub Personal Access Token ein (Scope:{" "}
              <code className="bg-neutral-100 px-1 rounded text-xs">repo</code>).
            </p>
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
              />
            </div>
            <p className="text-xs text-neutral-400">
              Wird nur lokal in deinem Browser gespeichert — nie an den Server gesendet.
            </p>
            {error && <ErrorMsg text={error} />}
            <Button onClick={handleSaveToken} disabled={!token.trim()} className="w-full">
              Speichern & weiter
            </Button>
          </div>
        )}

        {view === "repo" && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Welches GitHub-Repo gehört zu diesem Projekt? Das wird einmal gespeichert und
              automatisch für alle Issues verwendet.
            </p>
            <div className="space-y-2">
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                placeholder="owner/repo"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveRepo()}
              />
            </div>
            {error && <ErrorMsg text={error} />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setView("token")} className="flex-1">
                Zurück
              </Button>
              <Button
                onClick={handleSaveRepo}
                disabled={loading || !repoInput.trim()}
                className="flex-1"
              >
                {loading ? "Speichern..." : "Verknüpfen"}
              </Button>
            </div>
          </div>
        )}

        {view === "issue" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                Repo:{" "}
                <code className="bg-neutral-100 px-1 rounded">{githubRepo}</code>
              </span>
              <button
                onClick={() => setView("repo")}
                className="underline hover:text-neutral-700"
              >
                ändern
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                placeholder="Kurze Beschreibung"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <textarea
                id="description"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Details zum Issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Screenshot</Label>
              {screenshot ? (
                <div className="relative rounded border overflow-hidden">
                  <img
                    src={screenshot}
                    alt="Preview-Screenshot"
                    className="w-full max-h-36 object-cover"
                  />
                  <button
                    onClick={() => setScreenshot(null)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleCapture}
                  disabled={loading}
                  className="w-full gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {loading ? "Lädt..." : "Screenshot aufnehmen"}
                </Button>
              )}
            </div>

            {error && <ErrorMsg text={error} />}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setView("token")}
                className="shrink-0"
              >
                Token
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !title.trim()}
                className="flex-1"
              >
                {loading ? "Erstelle Issue..." : "Issue erstellen"}
              </Button>
            </div>
          </div>
        )}

        {view === "success" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-medium">Issue erfolgreich erstellt!</p>
            {issueUrl && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                Issue auf GitHub öffnen
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button variant="outline" onClick={handleNewIssue} className="w-full">
              Weiteres Issue erstellen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}
