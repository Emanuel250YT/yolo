import { BrandLogo } from "./BrandLogo";

interface AppFooterProps {
  dark?: boolean;
  className?: string;
}

export function AppFooter({ dark = false, className = "" }: AppFooterProps) {
  return (
    <footer
      className={`app-footer ${dark ? "app-footer--dark" : ""} ${className}`.trim()}
    >
      <BrandLogo
        variant="municipality"
        size="xs"
        className={dark ? "brand-on-dark" : undefined}
      />
      <span>SEM · Municipalidad de Salta</span>
    </footer>
  );
}
