import { cn } from '../../utils/cn';

interface QueryAgentLogoProps {
  className?: string;
}

/**
 * Custom Query Agent logo component.
 * Renders the branded satellite-chat-bubble logo instead of the generic Bot icon.
 * Accepts the same `className` prop as lucide icons for drop-in replacement.
 */
export function QueryAgentLogo({ className }: QueryAgentLogoProps) {
  return (
    <img
      src="/assets/query-agent-logo.jpg"
      alt="Query Agent"
      className={cn('object-contain', className)}
      draggable={false}
    />
  );
}
