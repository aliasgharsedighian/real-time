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
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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

const schema = z.object({ firstname: z.string(), lastname: z.string() });
type Values = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user } = useSession();
  const cache = useQueryClient();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const [pending, setPending] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstname: "", lastname: "" },
  });
  const { reset } = form;
  useEffect(() => {
    reset({
      firstname: user?.profile?.firstname ?? "",
      lastname: user?.profile?.lastname ?? "",
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
    <div className="p-4 sm:p-6">
      <Card className="mx-auto max-w-2xl">
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
                        {name === "firstname" ? "Firstname" : "Lastname"}
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
              <Button disabled={pending} type="submit" className="w-full">
                {pending ? "Saving…" : "Update"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
