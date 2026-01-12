import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ColorizedText } from "@/components/ui/colorized-text";
import { useAuthStatus } from "@/context/auth-status";
import { useToast } from "@/hooks/use-toast";
import { useCreateUpgradeIntent, useMe } from "@/hooks/use-data";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { status: authStatus } = useAuthStatus();
  const { data: me } = useMe(authStatus === "authed");
  const createUpgradeIntent = useCreateUpgradeIntent();
  const [pendingPlan, setPendingPlan] = useState<null | "premium" | "premium_plus">(null);

  const planMeta = useMemo(
    () => ({
      free: {
        label: "Free",
        price: "$0",
        cadence: "",
        summary: "1 workspace · 5 collections · 8 notes per collection",
        features: ["Core collaboration tools", "Basic roles + invites", "Plain text editor"],
      },
      premium: {
        label: "Premium",
        price: "$15",
        cadence: "per month",
        summary: "3 workspaces · 20 collections · 200 notes per collection",
        features: ["Rich formatting tools", "Stronger team controls", "More room to scale"],
      },
      premium_plus: {
        label: "Premium+",
        price: "$25",
        cadence: "per month",
        summary: "Unlimited workspaces, collections, and notes",
        features: ["TeamPad AI", "Public notes sharing", "Advanced security + audit trail", "Priority support"],
      },
    }),
    [],
  );

  const currentPlanKey = me?.plan ?? "free";
  const currentPlan = planMeta[currentPlanKey] ?? planMeta.free;
  const recommendedPlan = currentPlanKey === "premium_plus" ? null : "premium";
  const avatarFallback = me?.name?.slice(0, 2).toUpperCase() || "TP";
  const isFreePlan = currentPlanKey === "free";

  const comparisons = [
    { label: "Workspaces", free: "1", premium: "3", premium_plus: "Unlimited" },
    { label: "Collections per workspace", free: "5", premium: "20", premium_plus: "Unlimited" },
    { label: "Notes per collection", free: "8", premium: "200", premium_plus: "Unlimited" },
    { label: "Rich formatting", free: "—", premium: "Included", premium_plus: "Included" },
    { label: "TeamPad AI", free: "—", premium: "—", premium_plus: "Included" },
    { label: "Public notes", free: "—", premium: "—", premium_plus: "Included" },
    { label: "Audit trail", free: "—", premium: "—", premium_plus: "Included" },
  ];

  const handleUpgradeIntent = async (plan: "premium" | "premium_plus") => {
    if (!me) {
      navigate("/auth?view=login");
      return;
    }
    setPendingPlan(plan);
    try {
      await createUpgradeIntent.mutateAsync({ plan, source: "pricing" });
      toast({
        title: "Request received",
        description: "We will follow up with next steps shortly.",
      });
    } catch (error) {
      toast({
        title: "Request not sent",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-semibold">
      <header className="sticky top-0 z-40 bg-white text-foreground font-black relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 via-transparent to-foreground/10" />
          <div className="absolute inset-0 opacity-[0.22] text-foreground dark:text-emerald-400">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid-pricing" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-pricing)" />
            </svg>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 relative z-10">
          <Link to="/" className="flex items-center gap-3 font-black">
            <div className="leading-tight">
              <p className="text-sm font-black text-foreground dark:text-black">Plans & billing</p>
              <p className="text-xs font-bold text-muted-foreground dark:text-black">Upgrade your TeamPad account</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="font-black bg-green-600 hover:text-green-700 dark:border-transparent"
              asChild
            >
              <Link to="/app">Back to app</Link>
            </Button>
            {me ? (
              <div
                className="flex items-center gap-3 rounded-full border border-slate-700 px-3 py-2 text-sm font-black"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={me.avatar ?? ""} alt={me.name} />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <ColorizedText
                    text={me.name}
                    className="text-sm font-black text-foreground"
                    letterClassName="font-black"
                  />
                  <p className="text-xs font-black text-muted-foreground">
                    {me.email}
                  </p>
                </div>
                <span
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-black font-display uppercase tracking-[0.25em] text-muted-foreground"
                >
                  {currentPlan.label}
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">Loading account...</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <section className="rounded-2xl border border-border bg-secondary/30 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Your plan
              </p>
              <h1 className="mt-2 text-3xl font-black font-display text-foreground md:text-4xl">
                {currentPlan.label} plan 
              </h1>
              <p className="mt-2 text-sm font-medium text-muted-foreground">{currentPlan.summary}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Current</p>
              <p className="mt-2 text-2xl font-extrabold text-foreground">{currentPlan.price}</p>
              <p className="text-xs font-medium text-muted-foreground">{currentPlan.cadence || "free"}</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            Upgrades are request-based right now. After you choose a plan, our team follows up with next steps.
          </p>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Upgrade options</h2>
            <p className="text-xs font-medium text-muted-foreground">Premium is the recommended upgrade.</p>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            {(["free", "premium", "premium_plus"] as const).map((key) => {
              const plan = planMeta[key];
              const isCurrent = key === currentPlanKey;
              const isRecommended = recommendedPlan === key;
              const isPending = pendingPlan === key;
              return (
                <div
                  key={key}
                  className={`rounded-2xl border p-6 ${
                    isRecommended ? "border-foreground bg-secondary/20" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold text-foreground">{plan.label}</p>
                    {isRecommended && (
                      <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-foreground">{plan.price}</p>
                  {plan.cadence && <p className="text-xs font-medium text-muted-foreground">{plan.cadence}</p>}
                  <p className="mt-3 text-sm font-medium text-muted-foreground">{plan.summary}</p>
                  <ul className="mt-6 space-y-3 text-sm font-medium text-muted-foreground">
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    {key === "free" ? (
                      <Button variant="outline" disabled className="w-full">
                        {isCurrent ? "Current plan" : "Free plan"}
                      </Button>
                    ) : (
                      <Button
                        variant={isRecommended ? "success" : "outline"}
                        className="w-full"
                        onClick={() => handleUpgradeIntent(key)}
                        disabled={isCurrent || isPending}
                      >
                        {isCurrent
                          ? "Current plan"
                          : isPending
                            ? "Sending..."
                            : key === "premium"
                              ? "Upgrade to Premium"
                              : "Talk to sales"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h3 className="text-sm font-extrabold text-foreground">Plan comparison</h3>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/30 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Features</th>
                  <th className="px-4 py-3 font-semibold">Free</th>
                  <th className="px-4 py-3 font-semibold">Premium</th>
                  <th className="px-4 py-3 font-semibold">Premium+</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <td className="px-4 py-3 font-extrabold text-foreground">{row.label}</td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">{row.free}</td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">{row.premium}</td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">{row.premium_plus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
