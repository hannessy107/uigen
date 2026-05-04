"use client";

import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { FileSystemProvider, useFileSystem } from "@/lib/contexts/file-system-context";
import { ChatProvider } from "@/lib/contexts/chat-context";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ModelProgressBar } from "@/components/chat/ModelProgressBar";
import { FileTree } from "@/components/editor/FileTree";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { PreviewFrame, PreviewFrameHandle } from "@/components/preview/PreviewFrame";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeaderActions } from "@/components/HeaderActions";

interface MainContentProps {
  user?: {
    id: string;
    email: string;
  } | null;
  project?: {
    id: string;
    name: string;
    messages: any[];
    data: any;
    githubRepo?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

interface FileSystemBridgeHandle {
  getAllFiles: () => Map<string, string>;
}

// Brücke um aus MainContent heraus auf den FileSystemContext zuzugreifen
const FileSystemBridge = forwardRef<FileSystemBridgeHandle>((_, ref) => {
  const { getAllFiles } = useFileSystem();
  useImperativeHandle(ref, () => ({ getAllFiles }));
  return null;
});
FileSystemBridge.displayName = "FileSystemBridge";

export function MainContent({ user, project }: MainContentProps) {
  const [activeView, setActiveView] = useState<"preview" | "code">("preview");
  const previewRef = useRef<PreviewFrameHandle>(null);
  const fsBridgeRef = useRef<FileSystemBridgeHandle>(null);

  const handleCaptureScreenshot = async () => {
    if (!previewRef.current) throw new Error("Preview nicht verfügbar");
    return previewRef.current.captureScreenshot();
  };

  const handleGetFiles = () => {
    if (!fsBridgeRef.current) return new Map<string, string>();
    return fsBridgeRef.current.getAllFiles();
  };

  return (
    <FileSystemProvider initialData={project?.data}>
      <ChatProvider projectId={project?.id} initialMessages={project?.messages}>
        <FileSystemBridge ref={fsBridgeRef} />
        <div className="h-screen w-screen overflow-hidden bg-neutral-50">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel - Chat */}
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <div className="h-full flex flex-col bg-white">
                <div className="h-14 flex items-center justify-between gap-4 px-6 border-b border-neutral-200/60">
                  <h1 className="text-lg font-semibold text-neutral-900 tracking-tight">React Component Generator</h1>
                  <ModelProgressBar />
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatInterface />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="w-[1px] bg-neutral-200 hover:bg-neutral-300 transition-colors" />

            {/* Right Panel - Preview/Code */}
            <ResizablePanel defaultSize={65}>
              <div className="h-full flex flex-col bg-white">
                <div className="h-14 border-b border-neutral-200/60 px-6 flex items-center justify-between bg-neutral-50/50">
                  <Tabs
                    value={activeView}
                    onValueChange={(v) => setActiveView(v as "preview" | "code")}
                  >
                    <TabsList className="bg-white/60 border border-neutral-200/60 p-0.5 h-9 shadow-sm">
                      <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm text-neutral-600 px-4 py-1.5 text-sm font-medium transition-all">Preview</TabsTrigger>
                      <TabsTrigger value="code" className="data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm text-neutral-600 px-4 py-1.5 text-sm font-medium transition-all">Code</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <HeaderActions
                    user={user}
                    projectId={project?.id}
                    initialGithubRepo={project?.githubRepo}
                    onCaptureScreenshot={handleCaptureScreenshot}
                    onGetFiles={handleGetFiles}
                  />
                </div>

                <div className="flex-1 overflow-hidden bg-neutral-50">
                  {activeView === "preview" ? (
                    <div className="h-full bg-white">
                      <PreviewFrame ref={previewRef} />
                    </div>
                  ) : (
                    <ResizablePanelGroup direction="horizontal" className="h-full">
                      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                        <div className="h-full bg-neutral-50 border-r border-neutral-200">
                          <FileTree />
                        </div>
                      </ResizablePanel>
                      <ResizableHandle className="w-[1px] bg-neutral-200 hover:bg-neutral-300 transition-colors" />
                      <ResizablePanel defaultSize={70}>
                        <div className="h-full bg-white">
                          <CodeEditor />
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </ChatProvider>
    </FileSystemProvider>
  );
}
