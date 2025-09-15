"use client";

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
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { useSignin, useSignup } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import UserButton from "./UserButton";
import { useDispatch, useSelector } from "react-redux";
import {
  login,
  selectIsLoggedIn,
  setToken,
  setUser,
} from "@/store/redux/authSlice";

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

function AuthButton({ type }: { type: string }) {
  const dispatch = useDispatch();
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const [tab, setTab] = useState("Signin");
  const [openSignDialog, setOpenSignDialog] = useState(false);

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

  const { mutateAsync: signin, isPending: signinPending } = useSignin();

  const { mutateAsync: signup, isPending: signupPending } = useSignup();

  const handleSignupSubmit = async (
    values: z.infer<typeof signUpformSchema>
  ) => {
    const email = values.email;
    const password = values.password;
    try {
      await signup(
        { email, password, role: "USER" },
        {
          onSuccess: (response) => {
            const res = response.data;
            if (res.statusCode === 201) {
              dispatch(setToken(res.data.token.accessToken));
              setTimeout(() => {
                getUserInfo(res.data.token.accessToken);
              }, 1000);
            } else {
              toast.error("something went wrong");
            }
          },
        }
      );
    } catch (error) {
      console.error("Login failed", error);
      toast.error("error");
    }
  };

  const handleLoginSubmit = async (
    values: z.infer<typeof signinFormSchema>
  ) => {
    const email = values.email;
    const password = values.password;
    try {
      await signin(
        { email, password },
        {
          onSuccess: (response) => {
            const res = response.data;
            if (res.statusCode === 200) {
              setToken(res.data.accessToken);
              setTimeout(() => {
                getUserInfo(res.data.accessToken);
              }, 1000);
            } else {
              toast.error("something went wrong");
            }
          },
        }
      );
    } catch (error) {
      console.error("Login failed", error);
      toast.error("error");
    }
  };

  const getUserInfo = async (token: string) => {
    try {
      const response = await api.get("auth/user-info", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const user = response.data.data;
      // Save user in redux
      dispatch(setUser(user));
      dispatch(login({ token, user }));
      toast.success("login successfully");
      // push("/polling");
    } catch (error) {
      console.error("Failed to fetch user info:", error);
      throw error;
    }
  };

  if (isLoggedIn && type === "header") {
    return <UserButton />;
  }

  if (isLoggedIn && type === "button") {
    return null;
  }
  if (!isLoggedIn) {
    return (
      <>
        <Dialog onOpenChange={setOpenSignDialog} open={openSignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign In/Sign Up</DialogTitle>
              <DialogDescription>
                You can Sign In to your account. if you don't have one , please
                Sign Up
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
                                    id="signin-email"
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
                                    id="signin-password"
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
                        insert your email and choose password at least 8
                        character. your password hashing and secure.
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
                                    id="signup-email"
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
                                    id="signup-password"
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
                                    id="signup-confirm-password"
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
        <Button
          onClick={() => setOpenSignDialog((prev) => !prev)}
          variant="outline"
        >
          {type === "header" && "Sign In/Sign Up"}
          {type === "button" && "Start Chatting Free"}
        </Button>
      </>
    );
  }
}

export default AuthButton;
