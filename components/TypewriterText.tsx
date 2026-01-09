
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onStart?: () => void;
  className?: string;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ text, speed = 10, onComplete, onStart, className }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    setDisplayedText(''); 
    if (onStart) onStart();

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => {
        if (index >= text.length) {
          clearInterval(intervalId);
          if (onComplete) onComplete();
          return prev;
        }
        const char = text.charAt(index);
        index++;
        return prev + char;
      });
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed]);

  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 font-light`}>
      <ReactMarkdown>{displayedText}</ReactMarkdown>
    </div>
  );
};
