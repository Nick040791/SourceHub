import React, { useState, useMemo } from 'react';
import { marked } from 'marked';
import { 
  FileText, 
  Copy, 
  Check, 
  Sun, 
  Moon, 
  Type, 
  Maximize2, 
  Minimize2, 
  BookOpen,
  Clock
} from 'lucide-react';

interface MarkdownDocViewProps {
  content: string;
  filename?: string;
  className?: string;
}

export const MarkdownDocView: React.FC<MarkdownDocViewProps> = ({
  content,
  filename = 'Document.md',
  className = '',
}) => {
  const [docTheme, setDocTheme] = useState<'paper' | 'dark'>('dark');
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('sans');
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compute document stats
  const stats = useMemo(() => {
    const text = content.replace(/[#*`_\[\]]/g, '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = content.length;
    const readMinutes = Math.max(1, Math.ceil(words / 220));
    return { words, chars, readMinutes };
  }, [content]);

  // Parse Markdown using marked with GFM
  const parsedHtml = useMemo(() => {
    try {
      return marked.parse(content, { gfm: true, breaks: true }) as string;
    } catch (e) {
      console.warn('Failed to parse markdown:', e);
      return `<pre>${content}</pre>`;
    }
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col bg-hub-bg min-h-full ${className}`}>
      {/* Word-Doc Style Top Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-hub-surface border-b border-hub-border text-xs shadow-sm">
        {/* Document Info */}
        <div className="flex items-center space-x-3">
          <div className="p-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-hub-text font-mono text-xs">{filename}</span>
            <div className="flex items-center space-x-2 text-[11px] text-hub-muted">
              <span>{stats.words.toLocaleString()} words</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{stats.readMinutes} min read</span>
              </span>
            </div>
          </div>
        </div>

        {/* View Controls Toolbar */}
        <div className="flex items-center space-x-2 flex-wrap">
          {/* Theme Selector (Word Doc Paper vs Dark Sheet) */}
          <div className="flex items-center bg-hub-bg border border-hub-border rounded p-0.5 text-[11px]">
            <button
              onClick={() => setDocTheme('paper')}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                docTheme === 'paper' 
                  ? 'bg-amber-100 text-gray-900 font-bold shadow-xs' 
                  : 'text-hub-muted hover:text-white'
              }`}
              title="Word Doc White Paper Mode"
            >
              <Sun className="w-3 h-3 text-amber-600" />
              <span>Paper</span>
            </button>
            <button
              onClick={() => setDocTheme('dark')}
              className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                docTheme === 'dark' 
                  ? 'bg-hub-border text-hub-text font-bold shadow-xs' 
                  : 'text-hub-muted hover:text-white'
              }`}
              title="Dark Document Sheet Mode"
            >
              <Moon className="w-3 h-3 text-blue-400" />
              <span>Dark</span>
            </button>
          </div>

          {/* Typography Font Selector (Sans vs Book Serif) */}
          <div className="flex items-center bg-hub-bg border border-hub-border rounded p-0.5 text-[11px]">
            <button
              onClick={() => setFontFamily('sans')}
              className={`px-2 py-1 rounded transition-colors ${
                fontFamily === 'sans' ? 'bg-hub-border text-hub-text font-bold' : 'text-hub-muted hover:text-white'
              }`}
              title="Modern Sans Typography"
            >
              Sans
            </button>
            <button
              onClick={() => setFontFamily('serif')}
              className={`px-2 py-1 rounded font-serif transition-colors ${
                fontFamily === 'serif' ? 'bg-hub-border text-hub-text font-bold' : 'text-hub-muted hover:text-white'
              }`}
              title="Word Doc Serif Typography"
            >
              Serif
            </button>
          </div>

          {/* Width Toggle */}
          <button
            onClick={() => setIsFullWidth(!isFullWidth)}
            className="p-1.5 bg-hub-bg border border-hub-border hover:bg-hub-subtle text-hub-muted hover:text-white rounded"
            title={isFullWidth ? 'Standard Letter Width' : 'Full Width View'}
          >
            {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 bg-hub-bg border border-hub-border hover:bg-hub-subtle text-hub-muted hover:text-white rounded transition-colors"
            title="Copy Raw Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-hub-success-text" />
                <span className="text-hub-success-text">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Desk Background & Centered Word-Doc Paper Sheet */}
      <div className="flex-1 py-8 px-3 sm:px-6 overflow-y-auto bg-[#0a0c10]">
        <div
          className={`mx-auto transition-all duration-200 rounded-md shadow-2xl border ${
            isFullWidth ? 'max-w-6xl' : 'max-w-4xl'
          } ${
            docTheme === 'paper'
              ? 'bg-[#ffffff] text-[#1f2328] border-gray-300 shadow-gray-900/40'
              : 'bg-[#0d1117] text-[#e6edf3] border-hub-border shadow-black/80'
          }`}
          style={{
            fontFamily:
              fontFamily === 'serif'
                ? 'Georgia, Cambria, "Times New Roman", Times, serif'
                : '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
          }}
        >
          {/* Document Sheet Margin Padding */}
          <div className="px-8 py-10 sm:px-14 sm:py-16 md:px-20 md:py-20">
            {/* Rendered Markdown HTML with custom Word-doc prose styles */}
            <article
              className={`doc-content prose max-w-none text-[15px] leading-[1.8] ${
                docTheme === 'paper' ? 'prose-neutral' : 'prose-invert'
              }`}
              dangerouslySetInnerHTML={{ __html: parsedHtml }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact Markdown renderer for PR descriptions, comments, and agent timeline entries
export const MarkdownContent: React.FC<{ content: string; className?: string }> = ({
  content,
  className = '',
}) => {
  const parsedHtml = useMemo(() => {
    try {
      return marked.parse(content, { gfm: true, breaks: true }) as string;
    } catch {
      return `<pre>${content}</pre>`;
    }
  }, [content]);

  return (
    <div
      className={`prose prose-invert max-w-none text-xs leading-relaxed doc-content-compact ${className}`}
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
};
