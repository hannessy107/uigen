"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import {
  createImportMap,
  createPreviewHTML,
} from "@/lib/transform/jsx-transformer";
import { AlertCircle } from "lucide-react";

export interface PreviewFrameHandle {
  captureScreenshot: () => Promise<string>;
}

export const PreviewFrame = forwardRef<PreviewFrameHandle>((_, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { getAllFiles, refreshTrigger } = useFileSystem();
  const [error, setError] = useState<string | null>(null);
  const [entryPoint, setEntryPoint] = useState<string>("/App.jsx");
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useImperativeHandle(ref, () => ({
    captureScreenshot: async () => {
      const iframe = iframeRef.current;
      if (!iframe?.contentDocument?.body) {
        throw new Error("Preview nicht verfügbar");
      }
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(iframe.contentDocument.body, {
        useCORS: true,
        allowTaint: false,
        width: iframe.offsetWidth,
        height: iframe.offsetHeight,
        windowWidth: iframe.offsetWidth,
        windowHeight: iframe.offsetHeight,
      });
      return canvas.toDataURL("image/png");
    },
  }));

  useEffect(() => {
    const updatePreview = () => {
      try {
        const files = getAllFiles();

        if (files.size > 0 && error) {
          setError(null);
        }

        let foundEntryPoint = entryPoint;
        const possibleEntries = [
          "/App.jsx",
          "/App.tsx",
          "/index.jsx",
          "/index.tsx",
          "/src/App.jsx",
          "/src/App.tsx",
        ];

        if (!files.has(entryPoint)) {
          const found = possibleEntries.find((path) => files.has(path));
          if (found) {
            foundEntryPoint = found;
            setEntryPoint(found);
          } else if (files.size > 0) {
            const firstJSX = Array.from(files.keys()).find(
              (path) => path.endsWith(".jsx") || path.endsWith(".tsx")
            );
            if (firstJSX) {
              foundEntryPoint = firstJSX;
              setEntryPoint(firstJSX);
            }
          }
        }

        if (files.size === 0) {
          if (isFirstLoad) {
            setError("firstLoad");
          } else {
            setError("No files to preview");
          }
          return;
        }

        if (isFirstLoad) {
          setIsFirstLoad(false);
        }

        if (!foundEntryPoint || !files.has(foundEntryPoint)) {
          setError(
            "No React component found. Create an App.jsx or index.jsx file to get started."
          );
          return;
        }

        const { importMap, styles, errors } = createImportMap(files);
        const previewHTML = createPreviewHTML(foundEntryPoint, importMap, styles, errors);

        if (iframeRef.current) {
          const iframe = iframeRef.current;
          iframe.setAttribute(
            "sandbox",
            "allow-scripts allow-same-origin allow-forms"
          );
          iframe.srcdoc = previewHTML;
          setError(null);
        }
      } catch (err) {
        console.error("Preview error:", err);
        setError(err instanceof Error ? err.message : "Unknown preview error");
      }
    };

    updatePreview();
  }, [refreshTrigger, getAllFiles, entryPoint, error, isFirstLoad]);

  if (error) {
    if (error === "firstLoad") {
      return (
        <div className="h-full flex items-center justify-center p-8 bg-gray-50">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Welcome to UI Generator
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Start building React components with AI assistance
            </p>
            <p className="text-xs text-gray-500">
              Ask the AI to create your first component to see it live here
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center p-8 bg-gray-50">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <AlertCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Preview Available
          </h3>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-xs text-gray-400 mt-2">
            Start by creating a React component using the AI assistant
          </p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-white"
      title="Preview"
    />
  );
});

PreviewFrame.displayName = "PreviewFrame";
