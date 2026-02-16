interface LogoProps {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "w-8 h-8 text-lg",
  md: "w-10 h-10 text-xl",
  lg: "w-12 h-12 text-2xl",
};

export function Logo({ size = "md" }: LogoProps) {
  return (
    <div
      className={`bg-accent-blue rounded-lg flex items-center justify-center ${sizes[size]}`}
    >
      <span className="text-white font-bold">C</span>
    </div>
  );
}
