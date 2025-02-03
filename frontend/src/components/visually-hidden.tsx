interface VisuallyHiddenProps {
    children: React.ReactNode;
  }
  
  export function VisuallyHidden({ children }: VisuallyHiddenProps) {
    return <span className="sr-only">{children}</span>;
  }
  