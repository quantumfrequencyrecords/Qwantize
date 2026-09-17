type Props = {
  to: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
};

export function AppLink({ to, className, onClick, children }: Props) {
  const href = `#${to.startsWith("/") ? to : `/${to}`}`;
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
