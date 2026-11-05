import { NotificationSettings } from "@/features/notifications/NotificationSettings";
import { AvatarEditor } from "./AvatarEditor";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { api, errorMessage, unwrap } from "@/shared/lib/api";
import type { ApiResponse, Profile, User } from "@/shared/lib/types";
import { displayName } from "@/shared/lib/types";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { ThemePicker } from "@/shared/components/ThemePicker";
import { Brand } from "@/shared/components/Brand";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/form";

const schema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  showLastSeen: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user } = useSession();
  const cache = useQueryClient();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const [pending, setPending] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstname: "", lastname: "", showLastSeen: true },
  });
  const { reset } = form;
  useEffect(() => {
    reset({
      firstname: user?.profile?.firstname ?? "",
      lastname: user?.profile?.lastname ?? "",
      showLastSeen: user?.profile?.showLastSeen ?? true,
    });
  }, [user, reset]);
  async function submit(values: Values) {
    setPending(true);
    try {
      const { data } = await api.put<ApiResponse<Profile>>(
        "auth/update-profile",
        values,
      );
      const profile = unwrap(data);
      if (!profile) throw new Error("The profile could not be saved.");
      cache.setQueryData<User>(["session", identity], (previous) =>
        previous ? { ...previous, profile } : previous,
      );
      await cache.invalidateQueries({ queryKey: ["chats", identity] });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="brand-scene flex-1 p-4 pb-8 sm:p-8">
      <div className="mx-auto mb-6 flex max-w-xl flex-col items-center gap-3 text-center">
        <IdentityAvatar
          avatarId={user?.profile?.avatarId}
          name={displayName(user)}
          className="size-24 border-2 border-primary text-3xl shadow-[0_0_35px_var(--brand-halo)]"
        />
        <AvatarEditor hasAvatar={!!user?.profile?.avatarId} />
        <h2 className="max-w-full truncate text-2xl font-semibold">
          {displayName(user)}
        </h2>
        <p className="max-w-full truncate text-sm text-muted-foreground">
          {user?.email || user?.phoneNumber || "Your BatGram account"}
        </p>
      </div>
      <Card className="brand-panel mx-auto max-w-xl rounded-3xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
              {(["firstname", "lastname"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {name === "firstname" ? "First name" : "Last name"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          autoComplete={
                            name === "firstname" ? "given-name" : "family-name"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="showLastSeen"
                render={({ field }) => (
                  <FormItem className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <FormLabel>Show my last seen</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      When off, others see only recently, within a week or
                      within a month. Online and typing are still visible. Save
                      with Update.
                    </p>
                  </FormItem>
                )}
              />
              <Button disabled={pending} type="submit" className="w-full">
                {pending ? "Saving…" : "Update"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <section className="brand-panel mx-auto mt-5 max-w-xl rounded-3xl p-6">
        <ThemePicker />
      </section>
      <NotificationSettings />
      <Brand className="mx-auto mt-8 w-32 opacity-70" />
    </div>
  );
}
