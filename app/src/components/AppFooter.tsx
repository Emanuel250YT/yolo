import { BrandLogo } from "./BrandLogo";

interface AppFooterProps {
  dark?: boolean;
}

export function AppFooter({ dark = false }: AppFooterProps) {
  return (
    <footer className={`app-footer ${dark ? "app-footer--dark" : ""}`}>
      <BrandLogo
        variant="municipality"
        size="xs"
        className={dark ? "brand-on-dark" : undefined}
      />
      <span>SEM · Municipalidad de Salta</span>
    </footer>
  );
}
