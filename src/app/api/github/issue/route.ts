import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token, repo, title, body, screenshotBase64 } = await req.json();

  if (!token || !repo || !title) {
    return NextResponse.json({ error: "token, repo und title sind erforderlich" }, { status: 400 });
  }

  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return NextResponse.json({ error: "Repo muss im Format owner/repo angegeben werden" }, { status: 400 });
  }
  const [owner, repoName] = parts;

  const ghHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let issueBody = body || "";

  if (screenshotBase64) {
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers: ghHeaders });
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        const branch = repoData.default_branch || "main";
        const timestamp = Date.now();
        const path = `.github/issue-screenshots/${timestamp}.png`;
        const base64Data = screenshotBase64.replace(/^data:image\/[^;]+;base64,/, "");

        const uploadRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`,
          {
            method: "PUT",
            headers: ghHeaders,
            body: JSON.stringify({
              message: `chore: add issue screenshot ${timestamp}`,
              content: base64Data,
              branch,
            }),
          }
        );

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const imageUrl = uploadData.content.download_url;
          issueBody = issueBody
            ? `${issueBody}\n\n![Screenshot](${imageUrl})`
            : `![Screenshot](${imageUrl})`;
        }
      }
    } catch {
      // Screenshot-Upload fehlgeschlagen — Issue trotzdem erstellen
    }
  }

  const issueRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
    method: "POST",
    headers: ghHeaders,
    body: JSON.stringify({ title, body: issueBody }),
  });

  if (!issueRes.ok) {
    const err = await issueRes.json();
    return NextResponse.json(
      { error: err.message || "Fehler beim Erstellen des Issues" },
      { status: issueRes.status }
    );
  }

  const issue = await issueRes.json();
  return NextResponse.json({ url: issue.html_url, number: issue.number });
}
