import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
//shadcn Component
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { authenticate } from "../api";
import { errorMessage } from "@/shared/lib/api";
import { useSessionStore } from "../session-store";

const signUpformSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const signinFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      mode,
      email,
      password,
    }: {
      mode: "signin" | "signup";
      email: string;
      password: string;
    }) => authenticate(mode, { email, password }),
  });
  const [tab, setTab] = useState("Signin");

  const signinForm = useForm<z.infer<typeof signinFormSchema>>({
    resolver: zodResolver(signinFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<z.infer<typeof signUpformSchema>>({
    resolver: zodResolver(signUpformSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const signinPending = mutation.isPending;
  const signupPending = mutation.isPending;
  const submit = async (
    mode: "signin" | "signup",
    values: { email: string; password: string },
  ) => {
    try {
      const tokens = await mutation.mutateAsync({ mode, ...values });
      cache.clear();
      useSessionStore.getState().setTokens(tokens);
      onOpenChange(false);
      const from: unknown = location.state?.from;
      navigate(
        typeof from === "string" && from.startsWith("/dashboard")
          ? from
          : "/dashboard",
        { replace: true },
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const handleSignupSubmit = (values: z.infer<typeof signUpformSchema>) =>
    submit("signup", values);
  const handleLoginSubmit = (values: z.infer<typeof signinFormSchema>) =>
    submit("signin", values);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign In/Sign Up</DialogTitle>
          <DialogDescription>
            You can Sign In to your account. if you don't have one , please Sign
            Up
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full flex-col gap-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="Signin">Signin</TabsTrigger>
              <TabsTrigger value="Signup">Signup</TabsTrigger>
            </TabsList>
            <TabsContent value="Signin">
              <Card>
                <CardHeader>
                  <CardTitle>Signin</CardTitle>
                  <CardDescription>
                    Please insert Email and password
                    <br />
                    if you haven't account yet, please{" "}
                    <span
                      onClick={() => setTab("Signup")}
                      className="text-blue-600 font-bold cursor-pointer underline"
                    >
                      signUp
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <Form {...signinForm}>
                    <form
                      onSubmit={signinForm.handleSubmit(handleLoginSubmit)}
                      className="flex flex-col gap-6"
                    >
                      <FormField
                        control={signinForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Email"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={signinForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        disabled={signinPending}
                        type="submit"
                        className="w-full"
                      >
                        Signin
                      </Button>
                    </form>
                  </Form>
                </CardContent>
                <CardFooter></CardFooter>
              </Card>
            </TabsContent>
            <TabsContent value="Signup">
              <Card>
                <CardHeader>
                  <CardTitle>Signup</CardTitle>
                  <CardDescription>
                    insert your email and choose password at least 8 character.
                    your password hashing and secure.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <Form {...signupForm}>
                    <form
                      onSubmit={signupForm.handleSubmit(handleSignupSubmit)}
                      className="flex flex-col gap-6"
                    >
                      <FormField
                        control={signupForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="Email"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={signupForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={signupForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Confirm Password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        disabled={signupPending}
                        className="w-full"
                        type="submit"
                      >
                        Signup
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuthDialog;
