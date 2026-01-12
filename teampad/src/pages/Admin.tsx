import { useState } from "react";
import { useAdminUsers, useUpdateAdminUserPlan } from "@/hooks/use-data";
import type { AdminUser, PlanTier } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const PLAN_OPTIONS: { label: string; value: PlanTier }[] = [
  { label: "Set Free", value: "free" },
  { label: "Set Premium", value: "premium" },
  { label: "Set Premium+", value: "premium_plus" },
];

const getPlanBadgeVariant = (plan: PlanTier) => {
  if (plan === "free") return "outline";
  if (plan === "premium") return "secondary";
  return "default";
};

const formatPlanLabel = (plan: PlanTier) =>
  plan === "premium_plus" ? "Premium+" : plan.charAt(0).toUpperCase() + plan.slice(1);

const formatDate = (value?: Date | null) => {
  if (!value) return "—";
  return value.toLocaleDateString();
};

export default function Admin() {
  const { toast } = useToast();
  const { data: users = [], isLoading, isError, error } = useAdminUsers(true);
  const updatePlan = useUpdateAdminUserPlan();
  const [pending, setPending] = useState<{ userId: string; plan: PlanTier } | null>(null);

  const handlePlanChange = async (user: AdminUser, plan: PlanTier) => {
    if (user.plan === plan || pending) return;
    setPending({ userId: user.id, plan });
    try {
      await updatePlan.mutateAsync({ userId: user.id, plan });
      toast({
        title: "Plan updated",
        description: `${user.email} is now on ${formatPlanLabel(plan)}.`,
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Admin console
          </p>
          <h1 className="mt-2 text-3xl font-black font-display">User plans</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage plan tiers for TeamPad accounts.
          </p>
        </header>

        {isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Unable to load users."}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Subscribed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, idx) => (
                      <TableRow key={`loading-${idx}`}>
                        <TableCell>
                          <Skeleton className="h-9 w-9 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-14" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-40 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  : users.map((user) => {
                      const isPending = Boolean(pending && pending.userId === user.id);
                      const avatarFallback = user.name?.slice(0, 2).toUpperCase() || "TP";
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar ?? ""} alt={user.name} />
                              <AvatarFallback>{avatarFallback}</AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant={getPlanBadgeVariant(user.plan)}>
                              {formatPlanLabel(user.plan)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isSubscribed ? "default" : "outline"}>
                              {user.isSubscribed ? "true" : "false"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {PLAN_OPTIONS.map((option) => (
                                <Button
                                  key={option.value}
                                  size="sm"
                                  variant={user.plan === option.value ? "default" : "outline"}
                                  disabled={isPending || user.plan === option.value}
                                  onClick={() => handlePlanChange(user, option.value)}
                                >
                                  {isPending && pending?.plan === option.value ? "Saving..." : option.label}
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!isLoading && users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
