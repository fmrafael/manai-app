import { useEffect, useState, useRef } from "react";

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export default function Typewriter({ text, speed = 60, onComplete }: TypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const index = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDisplayed((prev) => {
          if (index.current >= text.length) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimeout(() => {
              onComplete?.();
            }, 0);
            return prev;
          }
          const next = prev + text.charAt(index.current);
          index.current += 1;
          return next;
        });
      }, speed);
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed, onComplete]);

  return (
    <span style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "1rem", display: "inline-block" }}>
      {displayed}
      <span className="animate-blink" style={{ display: "inline-block", width: "10px" }}>
        |
      </span>
      <style jsx>{`
        .animate-blink {
          animation: blink 1s step-start infinite;
        }
        @keyframes blink {
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}
