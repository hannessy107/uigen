"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProjectGithubRepo } from "@/actions/update-project-github";
import { Github, Camera, ExternalLink, AlertCircle, Check, X, GitPullRequest, MessageSquare } from "lucide-react";

type View = "token" | "repo" | "home" | "issue" | "pr" | "success";

interface GitHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  githubRepo: string | null;
  onRepoSaved: (repo: string) => void;
  onCaptureScreenshot: () => Promise<string>;
  onGetFiles: () => Map<string, string>;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

export function GitHubDialog({
  open,
  onOpenChange,
  projectId,
  githubRepo,
  onRepoSaved,
  onCaptureScreenshot,
  onGetFiles,
}: GitHubDialogProps) {
  const [view, setView] = useState<View>("home");
  const [token, setToken] = useState("");
  const [repoInput, setRepoInput] = useState(githubRepo || "");

  // Issue state
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);

  // PR state
  const [prTitle, setPrTitle] = useState("");
  const [prDescription, setPrDescription] = useState("");
  const [prBranch, setPrBranch] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<"issue" | "pr">("issue");

  useEffect(() => {
    if (!open) return;
    const savedToken = localStorage.getItem("github-token") || "";
    setToken(savedToken);
    setRepoInput(githubRepo || "");
    setError(null);
    setResultUrl(null);
    setIssueTitle("");
    setIssueDescription("");
    setPrTitle("");
    setPrDescription("");
    setPrBranch("");
    setScreenshot(null);

    if (!savedToken) setView("token");
    else if (!githubRepo) setView("repo");
    else setView("home");
  }, [open, githubRepo]);

  // Branch-Name aus PR-Titel ableiten
  useEffect(() => {
    if (prTitle) setPrBranch(`uigen/${slugify(prTitle)}`);
  }, [prTitle]);

  const handleSaveToken = () => {
    if (!token.trim()) return;
    localStorage.setItem("github-token", token.trim());
    setError(null);
    if (!githubRepo) setView("repo");
    else setView("home");
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
      setView("home");
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

  const handleSubmitIssue = async () => {
    if (!issueTitle.trim()) {
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
          title: issueTitle.trim(),
          body: issueDescription.trim(),
          screenshotBase64: screenshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultUrl(data.url);
      setSuccessType("issue");
      setView("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Erstellen des Issues");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPr = async () => {
    if (!prTitle.trim()) {
      setError("Titel ist erforderlich");
      return;
    }
    if (!prBranch.trim()) {
      setError("Branch-Name ist erforderlich");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const files = onGetFiles();
      const filesObj: Record<string, string> = {};
      files.forEach((content, path) => {
        filesObj[path] = content;
      });

      const res = await fetch("/api/github/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: localStorage.getItem("github-token"),
          repo: githubRepo,
          title: prTitle.trim(),
          body: prDescription.trim(),
          branch: prBranch.trim(),
          files: filesObj,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResultUrl(data.url);
      setSuccessType("pr");
      setView("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Erstellen des Pull Requests");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIssueTitle("");
    setIssueDescription("");
    setPrTitle("");
    setPrDescription("");
    setPrBranch("");
    setScreenshot(null);
    setError(null);
    setResultUrl(null);
    setView("home");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub
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
              Wird nur lokal in deinem Browser gespeichert.
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
              Welches GitHub-Repo gehört zu diesem Projekt?
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
              <Button onClick={handleSaveRepo} disabled={loading || !repoInput.trim()} className="flex-1">
                {loading ? "Speichern..." : "Verknüpfen"}
              </Button>
            </div>
          </div>
        )}

        {view === "home" && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">
              Repo: <code className="bg-neutral-100 px-1 rounded">{githubRepo}</code>{" "}
              <button onClick={() => setView("repo")} className="underline hover:text-neutral-700">
                ändern
              </button>
            </p>
            <button
              onClick={() => setView("issue")}
              className="w-full flex items-center gap-3 rounded-lg border border-neutral-200 p-4 text-left hover:bg-neutral-50 transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-neutral-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Issue erstellen</p>
                <p className="text-xs text-neutral-500">Bug oder Feature als GitHub Issue melden</p>
              </div>
            </button>
            <button
              onClick={() => setView("pr")}
              className="w-full flex items-center gap-3 rounded-lg border border-neutral-200 p-4 text-left hover:bg-neutral-50 transition-colors"
            >
              <GitPullRequest className="h-5 w-5 text-neutral-500 shrink-0" />
              <div>
                <p className="font-medium text-sm">Pull Request erstellen</p>
                <p className="text-xs text-neutral-500">Generierten Code als PR pushen</p>
              </div>
            </button>
            <Button variant="ghost" size="sm" onClick={() => setView("token")} className="w-full text-xs text-neutral-400">
              Token ändern
            </Button>
          </div>
        )}

        {view === "issue" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                Repo: <code className="bg-neutral-100 px-1 rounded">{githubRepo}</code>
              </span>
              <button onClick={() => setView("home")} className="underline hover:text-neutral-700">
                zurück
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-title">Titel *</Label>
              <Input
                id="issue-title"
                placeholder="Kurze Beschreibung"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-description">Beschreibung</Label>
              <textarea
                id="issue-description"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Details zum Issue..."
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Screenshot</Label>
              {screenshot ? (
                <div className="relative rounded border overflow-hidden">
                  <img src={screenshot} alt="Preview-Screenshot" className="w-full max-h-36 object-cover" />
                  <button
                    onClick={() => setScreenshot(null)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <Button variant="outline" onClick={handleCapture} disabled={loading} className="w-full gap-2">
                  <Camera className="h-4 w-4" />
                  {loading ? "Lädt..." : "Screenshot aufnehmen"}
                </Button>
              )}
            </div>

            {error && <ErrorMsg text={error} />}

            <Button onClick={handleSubmitIssue} disabled={loading || !issueTitle.trim()} className="w-full">
              {loading ? "Erstelle Issue..." : "Issue erstellen"}
            </Button>
          </div>
        )}

        {view === "pr" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                Repo: <code className="bg-neutral-100 px-1 rounded">{githubRepo}</code>
              </span>
              <button onClick={() => setView("home")} className="underline hover:text-neutral-700">
                zurück
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-title">Titel *</Label>
              <Input
                id="pr-title"
                placeholder="z.B. Add landing page component"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-branch">Branch-Name</Label>
              <Input
                id="pr-branch"
                placeholder="uigen/mein-feature"
                value={prBranch}
                onChange={(e) => setPrBranch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-description">Beschreibung</Label>
              <textarea
                id="pr-description"
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Was wurde geändert?"
                value={prDescription}
                onChange={(e) => setPrDescription(e.target.value)}
              />
            </div>

            <p className="text-xs text-neutral-400">
              Alle {onGetFiles().size} Dateien aus dem aktuellen Projekt werden in den PR committed.
            </p>

            {error && <ErrorMsg text={error} />}

            <Button onClick={handleSubmitPr} disabled={loading || !prTitle.trim() || !prBranch.trim()} className="w-full gap-2">
              <GitPullRequest className="h-4 w-4" />
              {loading ? "Erstelle Pull Request..." : "Pull Request erstellen"}
            </Button>
          </div>
        )}

        {view === "success" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-medium">
              {successType === "pr" ? "Pull Request erfolgreich erstellt!" : "Issue erfolgreich erstellt!"}
            </p>
            {resultUrl && (
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                {successType === "pr" ? "PR auf GitHub öffnen" : "Issue auf GitHub öffnen"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button variant="outline" onClick={handleReset} className="w-full">
              Zurück zur Übersicht
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
