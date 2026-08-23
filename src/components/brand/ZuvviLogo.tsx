type ZuvviLogoProps = {
  surface?: "dark" | "light";
  className?: string;
};

export function ZuvviLogo({
  surface = "dark",
  className,
}: ZuvviLogoProps) {
  return (
    <img
      src={surface === "dark" ? "/brand/zuvvi-logo-dark.svg" : "/brand/zuvvi-logo-light.svg"}
      alt="Zuvvi"
      className={className}
    />
  );
}
