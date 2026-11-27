import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// Sanitize HTML/Markdown while allowing safe KaTeX math markup and safe http(s)/mailto links only
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  protocols: {
    href: ["http", "https", "mailto"],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "mfrac",
    "msup",
    "msub",
    "msubsup",
    "msqrt",
    "mroot",
    "mtable",
    "mtr",
    "mtd",
    "annotation",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": ["className", "ariaHidden", "style"],
    annotation: ["encoding"],
  },
};

export const MarkdownMath: React.FC<{ content: string; className?: string }> = ({
  content,
  className = "",
}) => {
  return (
    <div className={`prose-bhaios text-[15px] leading-relaxed break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA], rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
