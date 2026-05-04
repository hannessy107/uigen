import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token, repo, title, body, branch, files } = await req.json();

  if (!token || !repo || !title || !branch || !files) {
    return NextResponse.json(
      { error: "token, repo, title, branch und files sind erforderlich" },
      { status: 400 }
    );
  }

  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return NextResponse.json(
      { error: "Repo muss im Format owner/repo angegeben werden" },
      { status: 400 }
    );
  }
  const [owner, repoName] = parts;

  const ghHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Default-Branch + letzten Commit ermitteln
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
    headers: ghHeaders,
  });
  if (!repoRes.ok) {
    return NextResponse.json({ error: "Repo nicht gefunden oder kein Zugriff" }, { status: 404 });
  }
  const repoData = await repoRes.json();
  const defaultBranch: string = repoData.default_branch;

  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`,
    { headers: ghHeaders }
  );
  if (!refRes.ok) {
    return NextResponse.json({ error: "Branch-Referenz nicht gefunden" }, { status: 404 });
  }
  const baseSha: string = (await refRes.json()).object.sha;

  // Basis-Tree des letzten Commits holen
  const commitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`,
    { headers: ghHeaders }
  );
  if (!commitRes.ok) {
    return NextResponse.json({ error: "Basis-Commit nicht gefunden" }, { status: 404 });
  }
  const baseTreeSha: string = (await commitRes.json()).tree.sha;

  // Neuen Tree mit allen VFS-Dateien erstellen
  const treeEntries = Object.entries(files as Record<string, string>).map(
    ([path, content]) => ({
      path: path.startsWith("/") ? path.slice(1) : path,
      mode: "100644",
      type: "blob",
      content,
    })
  );

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
    {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    }
  );
  if (!treeRes.ok) {
    return NextResponse.json({ error: "Tree konnte nicht erstellt werden" }, { status: 500 });
  }
  const newTreeSha: string = (await treeRes.json()).sha;

  // Commit erstellen
  const newCommitRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
    {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ message: title, tree: newTreeSha, parents: [baseSha] }),
    }
  );
  if (!newCommitRes.ok) {
    return NextResponse.json({ error: "Commit konnte nicht erstellt werden" }, { status: 500 });
  }
  const newCommitSha: string = (await newCommitRes.json()).sha;

  // Branch erstellen
  const branchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/refs`,
    {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: newCommitSha }),
    }
  );
  if (!branchRes.ok) {
    const err = await branchRes.json();
    return NextResponse.json(
      { error: err.message || "Branch konnte nicht erstellt werden" },
      { status: 500 }
    );
  }

  // Pull Request erstellen
  const prRes = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/pulls`,
    {
      method: "POST",
      headers: ghHeaders,
      body: JSON.stringify({ title, body: body || "", head: branch, base: defaultBranch }),
    }
  );
  if (!prRes.ok) {
    const err = await prRes.json();
    return NextResponse.json(
      { error: err.message || "Pull Request konnte nicht erstellt werden" },
      { status: prRes.status }
    );
  }
  const prData = await prRes.json();
  return NextResponse.json({ url: prData.html_url, number: prData.number });
}
