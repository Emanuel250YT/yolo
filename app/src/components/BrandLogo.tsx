type LogoVariant = "complete" | "municipality" | "icon";
type LogoSize = "xs" | "sm" | "md" | "lg";

const SOURCES: Record<LogoVariant, string> = {
  complete: "/logo-completo.png",
  municipality: "/logomuni.png",
  icon: "/logo.png",
};

const SIZE_CLASS: Record<LogoSize, string> = {
  xs: "brand-logo--xs",
  sm: "brand-logo--sm",
  md: "brand-logo--md",
  lg: "brand-logo--lg",
};

interface BrandLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  alt?: string;
  className?: string;
}

export function BrandLogo({
  variant = "complete",
  size = "md",
  alt = "SEM — Municipalidad de Salta",
  className = "",
}: BrandLogoProps) {
  return (
    <img
      src={SOURCES[variant]}
      alt={alt}
      className={`brand-logo ${SIZE_CLASS[size]} ${className}`.trim()}
    />
  );
}
