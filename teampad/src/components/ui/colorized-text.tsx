import { getLetterColor } from '@/lib/letterColors';
import { cn } from '@/lib/utils';

type ColorizedTextProps = {
  text: string;
  className?: string;
  letterClassName?: string;
};

export function ColorizedText({ text, className, letterClassName }: ColorizedTextProps) {
  const resolvedLetterClassName = cn('text-[1.05em] font-semibold', letterClassName);
  return (
    <span
      className={cn('whitespace-pre-wrap font-semibold tracking-[0.02em]', className)}
      aria-label={text}
    >
      {text.split('').map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={resolvedLetterClassName}
          style={{ color: getLetterColor(char) }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}
