import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { AppFooter } from "./AppFooter";
import { BrandLogo } from "./BrandLogo";

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  alternate?: { label: string; to: string; linkText: string };
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  alternate,
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <BrandLogo variant="icon" size="xs" className="auth-header-icon" />
          <div>
            <p className="eyebrow">SEM · Municipalidad de Salta</p>
            <h1>{title}</h1>
            {subtitle && <p className="auth-sub">{subtitle}</p>}
          </div>
        </div>

        {children}

        {alternate && (
          <p className="auth-alt">
            {alternate.label}{" "}
            <Link to={alternate.to}>{alternate.linkText}</Link>
          </p>
        )}

        {footer}

        <AppFooter />
      </div>
    </div>
  );
}
