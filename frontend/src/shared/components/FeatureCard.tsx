import type { LucideIcon } from "lucide-react";

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="brand-panel group w-full rounded-3xl p-6 text-left transition-colors hover:border-primary/40">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-brand">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

export default FeatureCard;
